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
  beforeAll(async () => {
    srv = startServer({ ...configFromEnv({ NO_DOTENV: "1" }), port: 0, host: "127.0.0.1", env: {} });
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
});
