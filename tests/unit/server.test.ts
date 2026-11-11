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
});
