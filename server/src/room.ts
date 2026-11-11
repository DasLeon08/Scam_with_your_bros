import { CLOSE, type ClientMsg, type ServerMsg } from "@bros/shared";
import { HybridBrain, LlmBrain, RoomLimiter, ScriptedBrain, llmConfigFromEnv } from "./brain";
import { GameEngine } from "./engine";
import type { Env } from "./env";

/** A room lives this long after its last player left. */
const EMPTY_TTL = 5 * 60_000;
/** A created room that nobody joins is given up after this. */
const CREATE_TTL = 10 * 60_000;
const MAX_MSG_BYTES = 2048;

interface Conn {
  ws: WebSocket;
  playerId: string | null;
  budget: number;
  last: number;
}

/** One Durable Object per room code. It holds the whole game in memory and is the only authority. */
export class Room {
  private engine: GameEngine | null = null;
  private conns = new Set<Conn>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/init") return this.init(url.searchParams.get("code") ?? "");
    if (url.pathname === "/ws") return this.connect(req, url.searchParams.get("code") ?? "");
    return new Response("not found", { status: 404 });
  }

  private async init(code: string): Promise<Response> {
    if (this.engine || (await this.state.storage.get<number>("created"))) return new Response("taken", { status: 409 });
    await this.state.storage.put("created", Date.now());
    this.start(code);
    await this.state.storage.setAlarm(Date.now() + CREATE_TTL);
    return new Response("ok");
  }

  private start(code: string) {
    const env = this.env;
    const cfg = llmConfigFromEnv(env as unknown as Record<string, unknown>);
    const limiter = new RoomLimiter(Number(env.RATE_LIMIT_PER_MINUTE ?? 20) || 20, Number(env.RATE_LIMIT_PER_ROOM ?? 400) || 400);
    const brain = new HybridBrain(cfg ? new LlmBrain(cfg) : null, new ScriptedBrain(), limiter, Date.now, (m) => console.warn(`[${code}] ${m}`));
    const override = Number(env.TEST_DAY_SECONDS ?? 0);
    this.engine = new GameEngine(code, {
      now: Date.now,
      random: Math.random,
      brain,
      daySecondsOverride: override > 0 ? override : undefined,
      send: (id, msg) => this.sendTo(id, msg),
      broadcast: (msg) => this.broadcast(msg),
    });
    this.timer ??= setInterval(() => this.engine?.tick(), 1000);
  }

  private async connect(req: Request, code: string): Promise<Response> {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    if (!this.engine) {
      // a room that was created a moment ago survives an object restart; anything else does not exist
      const created = await this.state.storage.get<number>("created");
      if (created && Date.now() - created < CREATE_TTL) this.start(code);
    }
    if (!this.engine) {
      server.close(CLOSE.notFound, "not_found");
      return new Response(null, { status: 101, webSocket: client });
    }

    const conn: Conn = { ws: server, playerId: null, budget: 20, last: Date.now() };
    this.conns.add(conn);
    await this.state.storage.deleteAlarm();

    server.addEventListener("message", (e) => this.onMessage(conn, e.data));
    const bye = () => this.onClose(conn);
    server.addEventListener("close", bye);
    server.addEventListener("error", bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(conn: Conn, data: unknown) {
    const engine = this.engine;
    if (!engine || typeof data !== "string" || data.length > MAX_MSG_BYTES) return;
    // simple flood guard: 20 messages, refilling 10 per second
    const now = Date.now();
    conn.budget = Math.min(20, conn.budget + ((now - conn.last) / 1000) * 10);
    conn.last = now;
    if (conn.budget < 1) return;
    conn.budget--;

    let msg: ClientMsg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.t === "ping") {
      this.send(conn, { t: "pong", c: msg.c, now: Date.now() });
      return;
    }
    if (msg.t === "hello") {
      if (conn.playerId) return;
      const seat = engine.join(msg);
      if (!seat) {
        conn.ws.close(CLOSE.full, "full");
        this.conns.delete(conn);
        return;
      }
      // the same seat from another tab: the old connection goes
      for (const other of this.conns) {
        if (other !== conn && other.playerId === seat.id) {
          other.playerId = null;
          try {
            other.ws.close(1000, "replaced");
          } catch {}
          this.conns.delete(other);
        }
      }
      conn.playerId = seat.id;
      this.send(conn, { t: "welcome", you: seat.id, token: seat.token, state: engine.snapshot() });
      return;
    }
    if (!conn.playerId) return;
    engine.handle(conn.playerId, msg).catch((e) => console.error("handle failed", e));
  }

  private onClose(conn: Conn) {
    if (!this.conns.delete(conn)) return;
    if (conn.playerId) this.engine?.disconnect(conn.playerId);
    if (this.conns.size === 0) this.state.storage.setAlarm(Date.now() + EMPTY_TTL);
  }

  /** Cleans up a room nobody is in any more. */
  async alarm() {
    if (this.conns.size > 0) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.engine = null;
    await this.state.storage.deleteAll();
  }

  private send(conn: Conn, msg: ServerMsg) {
    try {
      conn.ws.send(JSON.stringify(msg));
    } catch {}
  }

  private sendTo(playerId: string, msg: ServerMsg) {
    for (const c of this.conns) if (c.playerId === playerId) this.send(c, msg);
  }

  private broadcast(msg: ServerMsg) {
    const text = JSON.stringify(msg);
    for (const c of this.conns) {
      if (!c.playerId) continue;
      try {
        c.ws.send(text);
      } catch {}
    }
  }
}
