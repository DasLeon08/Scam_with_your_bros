import { CLOSE, randomCode, type ClientMsg, type ServerMsg } from "@bros/shared";
import { DEFAULT_MODEL, HybridBrain, LlmBrain, OPENAI_BASE_URL, OPENAI_KEY_RE, RoomLimiter, ScriptedBrain, llmConfigFromEnv, verifyOpenAiKey, type LlmConfig } from "./brain";
import type { ServerConfig } from "./config";
import { GameEngine } from "./engine";

/** A room lives this long after its last player left. */
const EMPTY_TTL = 5 * 60_000;
/** A created room that nobody joins is given up after this. */
const CREATE_TTL = 10 * 60_000;
const MAX_MSG_BYTES = 2048;

/** What a room needs from a WebSocket (works with the `ws` package and browsers alike). */
export interface Socket {
  send(text: string): void;
  close(code?: number, reason?: string): void;
}

interface Conn {
  ws: Socket;
  playerId: string | null;
  budget: number;
  last: number;
}

/** One game room: holds the whole game in memory and is the only authority. */
export class Room {
  readonly engine: GameEngine;
  private conns = new Set<Conn>();
  private timer: ReturnType<typeof setInterval>;
  private expiry: ReturnType<typeof setTimeout> | null = null;

  private limiter: RoomLimiter;
  /** The player whose own key the room uses right now. */
  private keyOwner: string | null = null;
  private serverLlm: LlmConfig | null;

  constructor(readonly code: string, private cfg: ServerConfig, private onGone: (code: string) => void) {
    this.serverLlm = llmConfigFromEnv(cfg.env);
    // one limit per room, also when the host swaps in their own key
    this.limiter = new RoomLimiter(cfg.rateLimitPerMinute, cfg.rateLimitPerRoom);
    const brain = this.makeBrain(this.serverLlm);
    this.engine = new GameEngine(code, {
      now: Date.now,
      random: Math.random,
      brain,
      daySecondsOverride: cfg.testDaySeconds,
      send: (id, msg) => this.sendTo(id, msg),
      broadcast: (msg) => this.broadcast(msg),
    });
    this.timer = setInterval(() => this.engine.tick(), 1000);
    this.expireIn(CREATE_TTL);
  }

  private makeBrain(llm: LlmConfig | null) {
    return new HybridBrain(llm ? new LlmBrain(llm, this.cfg.fetchFn) : null, new ScriptedBrain(), this.limiter, Date.now, (m) =>
      console.warn(`[${this.code}] ${m}`),
    );
  }

  /**
   * The host's own OpenAI key for this room. It lives only in this room's memory: never stored,
   * never logged, never sent to other players. null switches back to the server's setting.
   */
  private async setRoomKey(conn: Conn, rawKey: unknown, rawModel: unknown) {
    const reply = (ok: boolean, reason?: "bad_key" | "unreachable" | "not_host" | "bad_format") =>
      this.send(conn, { t: "event", event: { kind: "aiKey", ok, reason } });
    if (!conn.playerId || !this.engine.isHost(conn.playerId)) return reply(false, "not_host");
    if (rawKey === null) {
      this.keyOwner = null;
      this.engine.setBrain(this.makeBrain(this.serverLlm));
      return reply(true);
    }
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!OPENAI_KEY_RE.test(key)) return reply(false, "bad_format");
    const model = typeof rawModel === "string" && /^[A-Za-z0-9._:\/-]{1,64}$/.test(rawModel.trim()) ? rawModel.trim() : DEFAULT_MODEL;
    const check = await verifyOpenAiKey(key, this.cfg.fetchFn);
    if (check !== "ok") return reply(false, check);
    if (!this.conns.has(conn)) return; // left while the key was checked
    this.keyOwner = conn.playerId;
    this.engine.setBrain(this.makeBrain({ baseUrl: OPENAI_BASE_URL, apiKey: key, model, temperature: 0.9, timeoutMs: 15000 }));
    reply(true);
  }

  get size() {
    return this.conns.size;
  }

  attach(ws: Socket): Conn {
    const conn: Conn = { ws, playerId: null, budget: 20, last: Date.now() };
    this.conns.add(conn);
    if (this.expiry) clearTimeout(this.expiry);
    this.expiry = null;
    return conn;
  }

  message(conn: Conn, data: string) {
    if (data.length > MAX_MSG_BYTES) return;
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
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "ping") {
      this.send(conn, { t: "pong", c: Number(msg.c) || 0, now: Date.now() });
      return;
    }
    if (msg.t === "aiKey") {
      this.setRoomKey(conn, msg.key, msg.model).catch(() => {});
      return;
    }
    if (msg.t === "hello") {
      if (conn.playerId) return;
      const seat = this.engine.join(msg);
      if (!seat) {
        this.conns.delete(conn);
        conn.ws.close(CLOSE.full, "full");
        return;
      }
      // the same seat from another tab: the old connection goes
      for (const other of this.conns) {
        if (other !== conn && other.playerId === seat.id) {
          other.playerId = null;
          this.conns.delete(other);
          try {
            other.ws.close(1000, "replaced");
          } catch {}
        }
      }
      conn.playerId = seat.id;
      this.send(conn, { t: "welcome", you: seat.id, token: seat.token, state: this.engine.snapshot() });
      return;
    }
    if (!conn.playerId) return;
    this.engine.handle(conn.playerId, msg).catch((e) => console.error(`[${this.code}] handle failed`, e));
  }

  close(conn: Conn) {
    if (!this.conns.delete(conn)) return;
    if (conn.playerId) this.engine.disconnect(conn.playerId);
    // the key's owner left: stop spending their key
    if (conn.playerId && conn.playerId === this.keyOwner) {
      this.keyOwner = null;
      this.engine.setBrain(this.makeBrain(this.serverLlm));
    }
    if (this.conns.size === 0) this.expireIn(EMPTY_TTL);
  }

  private expireIn(ms: number) {
    if (this.expiry) clearTimeout(this.expiry);
    this.expiry = setTimeout(() => {
      if (this.conns.size === 0) this.dispose();
    }, ms);
    this.expiry.unref?.();
  }

  dispose() {
    clearInterval(this.timer);
    if (this.expiry) clearTimeout(this.expiry);
    for (const c of this.conns) c.ws.close(1001, "gone");
    this.conns.clear();
    this.onGone(this.code);
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

/** All rooms of this server. There is deliberately no way to list them: you only get in with a code. */
export class RoomRegistry {
  private rooms = new Map<string, Room>();
  constructor(private cfg: ServerConfig, private maxRooms = 2000) {}

  create(): Room | null {
    if (this.rooms.size >= this.maxRooms) return null;
    for (let i = 0; i < 20; i++) {
      const code = randomCode();
      if (this.rooms.has(code)) continue;
      const room = new Room(code, this.cfg, (c) => this.rooms.delete(c));
      this.rooms.set(code, room);
      return room;
    }
    return null;
  }

  get(code: string) {
    return this.rooms.get(code);
  }

  get count() {
    return this.rooms.size;
  }

  closeAll() {
    for (const r of [...this.rooms.values()]) r.dispose();
  }
}
