import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { ServerMsg } from "../../shared/src";
import { configFromEnv, originAllowed } from "../../server/src/config";
import { startServer } from "../../server/src/main";

describe("origins", () => {
  const list = configFromEnv({}).allowedOrigins;
  it("allows Toki and local dev, blocks the rest", () => {
    expect(originAllowed("https://scam-with-your-bros.playtoki.app", list)).toBe(true);
    expect(originAllowed("http://localhost:5173", list)).toBe(true);
    expect(originAllowed("https://evil.example", list)).toBe(false);
    expect(originAllowed("https://playtoki.app.evil.example", list)).toBe(false);
  });
});

describe("Node game server", () => {
  let srv: ReturnType<typeof startServer>;
  let base = "";
  // stands in for OpenAI: one good key, everything else is rejected
  const GOOD = "sk-test-good-key-1234567890abcdef";
  const llmCalls: { url: string; auth: string | null }[] = [];
  const fakeOpenAi = (async (url: string, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get("authorization");
    llmCalls.push({ url, auth });
    if (auth !== `Bearer ${GOOD}`) return new Response("{}", { status: 401 });
    // like Open WebUI one level deeper: only …/api/v1 answers, and it knows two models
    if (url.startsWith("https://webui.example.test/")) {
      if (!url.startsWith("https://webui.example.test/api/v1/")) return new Response("Not Found", { status: 404 });
      if (url.endsWith("/models")) return new Response('{"data":[{"id":"llama3"},{"id":"gpt-4o"}]}');
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (!["llama3", "gpt-4o"].includes(body.model)) return new Response('{"detail":"Model not found"}', { status: 404 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
    }
    if (url.endsWith("/models")) return new Response('{"data":[]}');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"KI hier!","trust_delta":3}' } }] }));
  }) as unknown as typeof fetch;

  beforeAll(async () => {
    srv = startServer({ ...configFromEnv({ NO_DOTENV: "1" }), port: 0, host: "127.0.0.1", env: {}, fetchFn: fakeOpenAi });
    await new Promise((r) => srv.http.once("listening", r));
    const addr = srv.http.address() as { port: number };
    base = `127.0.0.1:${addr.port}`;
  });
  afterAll(() => srv.stop());

  const connect = (code: string) =>
    new Promise<{ ws: WebSocket; msgs: ServerMsg[]; closed: Promise<number> }>((resolve, reject) => {
      const ws = new WebSocket(`ws://${base}/ws/${code}`);
      const msgs: ServerMsg[] = [];
      const closed = new Promise<number>((r) => ws.on("close", (c) => r(c)));
      ws.on("message", (d) => msgs.push(JSON.parse(d.toString())));
      ws.on("open", () => resolve({ ws, msgs, closed }));
      ws.on("error", reject);
    });
  const until = async (fn: () => boolean) => {
    for (let i = 0; i < 100 && !fn(); i++) await new Promise((r) => setTimeout(r, 20));
    expect(fn()).toBe(true);
  };

  it("health has no room list", async () => {
    const h = await (await fetch(`http://${base}/api/health`)).json();
    expect(h).toEqual({ ok: true, ai: false, rooms: 0 });
  });

  it("rejects foreign origins", async () => {
    const res = await fetch(`http://${base}/api/rooms`, { method: "POST", headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("creates a room, two players join by code, the host starts", async () => {
    const { code } = await (await fetch(`http://${base}/api/rooms`, { method: "POST" })).json();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
    const a = await connect(code);
    a.ws.send(JSON.stringify({ t: "hello", name: "Leon", color: "", hair: "" }));
    const b = await connect(code.toLowerCase());
    b.ws.send(JSON.stringify({ t: "hello", name: "Mia", color: "", hair: "" }));
    await until(() => b.msgs.some((m) => m.t === "welcome"));
    a.ws.send(JSON.stringify({ t: "start" }));
    await until(() => b.msgs.some((m) => m.t === "state" && m.state.phase === "day"));
    a.ws.close();
    b.ws.close();
  });

  it("an unknown code is closed with 4004", async () => {
    const c = await connect("ZZZZZ");
    expect(await c.closed).toBe(4004);
  });

  it("the host's own OpenAI key: checked, used only in this room, dropped when the host leaves", async () => {
    const { code } = await (await fetch(`http://${base}/api/rooms`, { method: "POST" })).json();
    const a = await connect(code);
    a.ws.send(JSON.stringify({ t: "hello", name: "Host", color: "", hair: "" }));
    const b = await connect(code);
    b.ws.send(JSON.stringify({ t: "hello", name: "Gast", color: "", hair: "" }));
    await until(() => b.msgs.some((m) => m.t === "welcome"));
    const events = (c: { msgs: ServerMsg[] }) => c.msgs.flatMap((m) => (m.t === "event" && m.event.kind === "aiKey" ? [m.event] : []));
    const lastState = (c: { msgs: ServerMsg[] }) => [...c.msgs].reverse().find((m) => m.t === "state" || m.t === "welcome") as any;

    b.ws.send(JSON.stringify({ t: "aiKey", key: GOOD })); // not the host
    await until(() => events(b).length === 1);
    expect(events(b)[0]).toEqual({ kind: "aiKey", ok: false, reason: "not_host" });

    a.ws.send(JSON.stringify({ t: "aiKey", key: "nope" }));
    await until(() => events(a).length === 1);
    expect(events(a)[0].reason).toBe("bad_format");
    a.ws.send(JSON.stringify({ t: "aiKey", key: "sk-wrong-key-000000000000000000" }));
    await until(() => events(a).length === 2);
    expect(events(a)[1].reason).toBe("bad_key");

    a.ws.send(JSON.stringify({ t: "aiKey", key: GOOD, model: "gpt-4o-mini" }));
    await until(() => events(a).length === 3);
    expect(events(a)[2]).toEqual({ kind: "aiKey", ok: true });
    await until(() => lastState(b)?.state.ai === true);
    expect(JSON.stringify(b.msgs)).not.toContain(GOOD); // never sent to other players
    expect(JSON.stringify(a.msgs)).not.toContain(GOOD); // nor back to the host

    a.ws.close(); // the key's owner leaves → back to scripted callers
    await until(() => lastState(b)?.state.ai === false);
    b.ws.close();
  });

  it("any OpenAI-compatible endpoint: own base URL, api-key header, blocked internal addresses", async () => {
    const { code } = await (await fetch(`http://${base}/api/rooms`, { method: "POST" })).json();
    const a = await connect(code);
    a.ws.send(JSON.stringify({ t: "hello", name: "Host", color: "", hair: "" }));
    await until(() => a.msgs.some((m) => m.t === "welcome"));
    const events = () => a.msgs.flatMap((m) => (m.t === "event" && m.event.kind === "aiKey" ? [m.event] : []));
    const send = (x: object) => a.ws.send(JSON.stringify({ t: "aiKey", ...x }));

    send({ key: GOOD, baseUrl: "https://127.0.0.1:4000/v1" });
    await until(() => events().length === 1);
    expect(events()[0].reason).toBe("blocked_url");
    send({ key: GOOD, baseUrl: "http://my-proxy.example.com/v1" });
    await until(() => events().length === 2);
    expect(events()[1].reason).toBe("bad_url");

    llmCalls.length = 0;
    send({ key: GOOD, baseUrl: "https://my-proxy.example.com/openai/v1/", model: "firma/gpt-4o-mini", auth: "bearer" });
    await until(() => events().length === 3);
    expect(events()[2]).toEqual({ kind: "aiKey", ok: true });
    expect(llmCalls.map((c) => c.url)).toContain("https://my-proxy.example.com/openai/v1/chat/completions");
    a.ws.close();
  });

  it("finds the endpoint with /v1 added and lists the models (e.g. Open WebUI)", async () => {
    const test = async (body: object) =>
      (await fetch(`http://${base}/api/ai/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    const wrongModel = await test({ key: GOOD, baseUrl: "https://webui.example.test/api", model: "gpt-4o-mini" });
    expect(wrongModel).toMatchObject({ ok: false, reason: "bad_model", baseUrl: "https://webui.example.test/api/v1", models: ["gpt-4o", "llama3"] });
    const right = await test({ key: GOOD, baseUrl: "https://webui.example.test/api", model: "llama3" });
    expect(right).toMatchObject({ ok: true, baseUrl: "https://webui.example.test/api/v1" });
  });

  it("model list for the picker: finds …/v1, sorted, free (no chat request)", async () => {
    const models = async (body: object) =>
      (await fetch(`http://${base}/api/ai/models`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    llmCalls.length = 0;
    expect(await models({ key: GOOD, baseUrl: "https://webui.example.test/api" })).toMatchObject({
      ok: true,
      baseUrl: "https://webui.example.test/api/v1",
      models: ["gpt-4o", "llama3"],
    });
    expect(llmCalls.every((c) => c.url.endsWith("/models"))).toBe(true);
    expect(await models({ key: "sk-wrong-key-000000000000000000", baseUrl: "https://webui.example.test/api/v1" })).toMatchObject({ ok: false, reason: "bad_key" });
    expect(await models({ key: GOOD, baseUrl: "https://10.0.0.1/v1" })).toMatchObject({ ok: false, reason: "blocked_url" });
  });

  it("\"Verbindung testen\": checks an endpoint without a room", async () => {
    const test = async (body: object) =>
      (await fetch(`http://${base}/api/ai/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    expect(await test({ key: GOOD, baseUrl: "https://api.example.com/v1", model: "m1" })).toMatchObject({ ok: true, model: "m1" });
    expect(await test({ key: "sk-wrong-key-000000000000000000", baseUrl: "https://api.example.com/v1" })).toMatchObject({ ok: false, reason: "bad_key" });
    expect(await test({ key: GOOD, baseUrl: "https://192.168.1.10/v1" })).toMatchObject({ ok: false, reason: "blocked_url" });
    expect(await test({ key: "x", baseUrl: "https://api.example.com/v1" })).toMatchObject({ ok: false, reason: "bad_format" });
    // limited per IP
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await fetch(`http://${base}/api/ai/test`, { method: "POST", body: "{}" })).status);
    expect(codes).toContain(429);
  });


});
