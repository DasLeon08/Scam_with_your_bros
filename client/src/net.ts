import { CLOSE, type ClientMsg, type GameEvent, type RoomState, type ServerMsg } from "@bros/shared";

declare const __SERVER_URL__: string;

/** Where the game server runs: ?server=… wins, then the build setting, then localhost. */
export function serverUrl(): string {
  try {
    const q = new URLSearchParams(location.search).get("server");
    if (q && /^https?:\/\//.test(q)) return q.replace(/\/+$/, "");
  } catch {}
  const built = (typeof __SERVER_URL__ === "string" && __SERVER_URL__) || "";
  return (built || "http://127.0.0.1:8787").replace(/\/+$/, "");
}

/** Free hosting puts the server to sleep: knock early so it is awake when the player clicks. */
export function wakeServer() {
  fetch(`${serverUrl()}/api/health`, { cache: "no-store" }).catch(() => {});
}

export interface AiTestResult {
  ok: boolean;
  reason?: string;
  ms?: number;
  model?: string;
  /** The address that answered (maybe with /v1 added). */
  baseUrl?: string;
  /** Models the endpoint offers, if it lists them. */
  models?: string[];
}

/** "Verbindung testen": the server sends one tiny request to the endpoint and reports back. */
export async function testAiEndpoint(body: { baseUrl: string; auth: string; key: string; model: string }): Promise<AiTestResult> {
  const res = await fetch(`${serverUrl()}/api/ai/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, reason: "server_offline" };
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  return ((await res.json().catch(() => null)) as AiTestResult | null) ?? { ok: false, reason: "unreachable" };
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${serverUrl()}/api/rooms`, { method: "POST" }).catch(() => null);
  if (!res) throw new Error("offline");
  if (res.status === 429) throw new Error("rate_limited");
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !data.code) throw new Error(data.error || "offline");
  return data.code;
}

export interface Profile {
  name: string;
  color: string;
  hair: string;
}

export interface ConnHandlers {
  onWelcome(you: string, state: RoomState): void;
  onState(state: RoomState): void;
  onEvent(event: GameEvent): void;
  onError(code: string): void;
  onClosed(reason: "not_found" | "full" | "offline" | "replaced"): void;
}

const tokenKey = (code: string) => `bros.token.${code}`;

/** One WebSocket to one room, with automatic reconnects that keep the player's seat. */
export class Connection {
  private ws: WebSocket | null = null;
  private closedByUs = false;
  private retries = 0;
  private welcomed = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  offset = 0;

  constructor(readonly code: string, private profile: Profile, private h: ConnHandlers) {
    this.open();
  }

  private open() {
    const url = `${serverUrl().replace(/^http/, "ws")}/ws/${this.code}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.h.onClosed("offline");
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      let token: string | undefined;
      try {
        token = sessionStorage.getItem(tokenKey(this.code)) ?? undefined;
      } catch {}
      this.send({ t: "hello", ...this.profile, token });
      this.pingTimer = setInterval(() => this.send({ t: "ping", c: Date.now() }), 5000);
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (msg.t) {
        case "welcome":
          this.welcomed = true;
          this.retries = 0;
          try {
            sessionStorage.setItem(tokenKey(this.code), msg.token);
          } catch {}
          this.offset = msg.state.now - Date.now();
          this.h.onWelcome(msg.you, msg.state);
          break;
        case "state":
          this.offset = msg.state.now - Date.now();
          this.h.onState(msg.state);
          break;
        case "event":
          this.h.onEvent(msg.event);
          break;
        case "error":
          this.h.onError(msg.code);
          break;
        case "pong":
          this.offset = msg.now - (msg.c + Date.now()) / 2;
          break;
      }
    };
    ws.onclose = (e) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.closedByUs) return;
      if (e.code === CLOSE.notFound) return this.h.onClosed("not_found");
      if (e.code === CLOSE.full) return this.h.onClosed("full");
      if (e.reason === "replaced") return this.h.onClosed("replaced");
      // keep the seat: try again a few times
      if (this.welcomed && this.retries < 6) {
        this.retries++;
        setTimeout(() => !this.closedByUs && this.open(), 600 * this.retries);
        return;
      }
      this.h.onClosed("offline");
    };
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  close() {
    this.closedByUs = true;
    try {
      sessionStorage.removeItem(tokenKey(this.code));
    } catch {}
    try {
      this.ws?.close(1000, "bye");
    } catch {}
  }
}

/* ---------------- Toki ---------------- */

interface TokiApi {
  room?: (code: string | null) => void;
  score?: (n: number) => void;
  onHost?: (fn: () => void) => void;
  onName?: (fn: (name: string) => void) => void;
  name?: string | null;
}
const toki = () => (window as unknown as { toki?: TokiApi }).toki;

/** Puts the team's Bro-Bucks of a day on the game's Toki leaderboard (higher is better). */
export function tokiScore(points: number) {
  try {
    toki()?.score?.(points);
  } catch {}
}

/** Toki's "Invite friends" before a room is open: Toki asks the game to open one. */
export function onTokiHost(fn: () => void) {
  try {
    toki()?.onHost?.(fn);
  } catch {}
}

/** The name the player goes by on Toki (now if known, and again when it changes). */
export function onTokiName(fn: (name: string) => void) {
  try {
    toki()?.onName?.(fn);
  } catch {}
}

/** Lets Toki offer "Invite friends" for this room. Joining still needs the code. */
export function tellToki(code: string | null) {
  try {
    toki()?.room?.(code);
  } catch {}
}

export const inToki = (() => {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
})();

/** A room code in the address (?room=K7QX2) from a Toki invite. It fills in the field; the player joins with one click. */
export function linkCode(): string {
  try {
    return (new URLSearchParams(location.search).get("room") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  } catch {
    return "";
  }
}
