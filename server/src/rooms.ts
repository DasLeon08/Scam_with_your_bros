import { CLOSE, randomCode, type ClientMsg, type ServerMsg } from "@bros/shared";
import { SmartBrain } from "./brain";
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

  constructor(readonly code: string, cfg: ServerConfig, private onGone: (code: string) => void) {
    // callers think for a moment before they answer (shorter in tests)
    const brain = new SmartBrain({ delay: () => cfg.thinkMs ?? 500 + Math.random() * 900 });
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
