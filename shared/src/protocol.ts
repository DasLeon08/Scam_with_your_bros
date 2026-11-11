/** Messages between the game client and the room server (JSON over WebSocket). */

export type Phase = "lobby" | "day" | "review" | "shop";

export interface PlayerStats {
  calls: number;
  wins: number;
  bucks: number;
  hacks: number;
  hangups: number;
  baited: number;
}

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  hair: string;
  host: boolean;
  connected: boolean;
  status: string;
  stats: PlayerStats;
}

export interface QueueItem {
  id: string;
  personaId: string;
  name: string;
  tagline: string;
  avatar: string;
  expiresAt: number;
}

export interface CallMsg {
  from: "caller" | "player" | "system";
  playerId?: string;
  text: string;
  delta?: number;
  at: number;
}

export interface FoundIntel {
  id: string;
  label: string;
  by: string;
  used: boolean;
}

export type CallOutcome = "paid" | "hangup" | "timeout" | "dropped" | "baited" | "exposed";

export interface CallView {
  id: string;
  personaId: string;
  name: string;
  tagline: string;
  traits: string[];
  avatar: string;
  bg: string;
  playerId: string;
  schemeId: string | null;
  trust: number;
  mood: string;
  thinking: boolean;
  messages: CallMsg[];
  intel: FoundIntel[];
  /** How many intel files are still hidden on the caller's computer. */
  hiddenIntel: number;
  endsAt: number;
  ended: boolean;
  outcome?: CallOutcome;
  amount?: number;
  turns: number;
  patience: number;
}

export interface HackView {
  callId: string;
  playerId: string;
  grid: string[];
  sequence: string[];
  progress: number;
  endsAt: number;
  result: "win" | "fail" | null;
  found?: string;
}

export interface ChatMsg {
  id: number;
  playerId: string | null;
  text: string;
  at: number;
}

export interface ReviewRow {
  playerId: string;
  name: string;
  color: string;
  hair: string;
  stats: PlayerStats;
  award: string;
}

export interface Review {
  day: number;
  quota: number;
  bucks: number;
  stars: number;
  line: string;
  calls: number;
  wins: number;
  hangups: number;
  baited: number;
  rows: ReviewRow[];
  notes: string[];
  nextQuota: number;
}

export interface RoomState {
  code: string;
  phase: Phase;
  hostId: string;
  daySeconds: number;
  day: number;
  quota: number;
  bucks: number;
  wallet: number;
  dayEndsAt: number;
  now: number;
  players: PlayerView[];
  queue: QueueItem[];
  calls: CallView[];
  hacks: HackView[];
  chat: ChatMsg[];
  bossLine: string;
  review: Review | null;
  owned: string[];
  votes: Record<string, string[]>;
  schemes: string[];
  ai: boolean;
}

export type ClientMsg =
  | { t: "hello"; name: string; color: string; hair: string; token?: string }
  | { t: "settings"; daySeconds: number }
  | { t: "start" }
  | { t: "endDay" }
  | { t: "chat"; text: string }
  | { t: "answer"; callId: string }
  | { t: "scheme"; callId: string; schemeId: string }
  | { t: "say"; callId: string; text: string }
  | { t: "hangup"; callId: string }
  | { t: "hack"; callId: string }
  | { t: "tap"; index: number }
  | { t: "closeHack" }
  | { t: "toShop" }
  | { t: "vote"; itemId: string }
  | { t: "buy"; itemId: string }
  | { t: "nextDay" }
  | { t: "ping"; c: number };

export type GameEvent =
  | { kind: "paid"; callId: string; playerId: string; amount: number; name: string }
  | { kind: "lost"; callId: string; playerId: string; name: string; outcome: CallOutcome }
  | { kind: "baited"; callId: string; playerId: string; penalty: number; name: string }
  | { kind: "exposed"; callId: string; playerId: string; bonus: number }
  | { kind: "intel"; callId: string; playerId: string; label: string }
  | { kind: "missed"; name: string }
  | { kind: "bought"; itemId: string }
  | { kind: "filtered" };

export type ServerMsg =
  | { t: "welcome"; you: string; token: string; state: RoomState }
  | { t: "state"; state: RoomState }
  | { t: "event"; event: GameEvent }
  | { t: "error"; code: string }
  | { t: "pong"; c: number; now: number };

/** WebSocket close codes the server uses. */
export const CLOSE = {
  notFound: 4004,
  full: 4009,
  badRequest: 4000,
} as const;

export const COLORS = ["#ffc63b", "#ff5d8f", "#5be3b0", "#7cc8ff", "#9b7bff", "#ff9a3c"];
export const HAIRS = ["cap", "bun", "glasses", "none"];
