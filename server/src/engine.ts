import {
  BOSS,
  COLORS,
  HAIRS,
  PERSONAS,
  RULES,
  SCHEMES,
  nextQuota,
  personaById,
  sanitizeName,
  sanitizeText,
  schemeById,
  shopItemById,
  starsFor,
  type CallMsg,
  type CallOutcome,
  type CallView,
  type ChatMsg,
  type ClientMsg,
  type FoundIntel,
  type GameEvent,
  type HackView,
  type Persona,
  type Phase,
  type PlayerStats,
  type PlayerView,
  type QueueItem,
  type Review,
  type RoomState,
  type ServerMsg,
} from "@bros/shared";
import type { CallerBrain } from "./brain";

export interface EngineIO {
  now(): number;
  random(): number;
  send(playerId: string, msg: ServerMsg): void;
  broadcast(msg: ServerMsg): void;
  brain: CallerBrain;
  /** Forces every day to this length (used by tests). */
  daySecondsOverride?: number;
}

interface Player {
  id: string;
  token: string;
  name: string;
  color: string;
  hair: string;
  connected: boolean;
  joinedAt: number;
  lastSay: number;
  callId: string | null;
  stats: PlayerStats;
}

interface Call {
  id: string;
  persona: Persona;
  playerId: string;
  schemeId: string | null;
  trust: number;
  messages: CallMsg[];
  intel: FoundIntel[];
  endsAt: number;
  ended: boolean;
  endedAt: number;
  outcome?: CallOutcome;
  amount?: number;
  turns: number;
  thinking: boolean;
}

interface Hack extends HackView {
  closeAt: number;
}

const emptyStats = (): PlayerStats => ({ calls: 0, wins: 0, bucks: 0, hacks: 0, hangups: 0, baited: 0 });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export class GameEngine {
  readonly code: string;
  private io: EngineIO;
  private phase: Phase = "lobby";
  private players = new Map<string, Player>();
  private order: string[] = [];
  private hostId = "";
  private daySeconds: number = RULES.defaultDaySeconds;
  private day = 0;
  private quota: number = RULES.quotaStart;
  private bucks = 0;
  private wallet = 0;
  private dayEndsAt = 0;
  private queue: QueueItem[] = [];
  private calls: Call[] = [];
  private hacks = new Map<string, Hack>();
  private chat: ChatMsg[] = [];
  private chatId = 0;
  private bossLine: string;
  private bossAt = 0;
  private review: Review | null = null;
  private owned: string[] = [];
  private votes: Record<string, string[]> = {};
  private schemes: string[] = SCHEMES.filter((s) => !s.shop).map((s) => s.id);
  private nextSpawnAt = 0;
  private spawned = 0;
  private baiterSpawned = false;
  private seq = 0;
  private dirty = false;

  constructor(code: string, io: EngineIO) {
    this.code = code;
    this.io = io;
    this.bossLine = this.pick(BOSS.lobby);
  }

  /** Swaps how callers answer (e.g. the host added their own AI key). */
  setBrain(brain: CallerBrain) {
    this.io.brain = brain;
    this.touch();
    this.flush();
  }

  isHost(id: string) {
    return id === this.hostId;
  }

  /* ---------------- players ---------------- */

  get connectedCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.connected) n++;
    return n;
  }

  /** Adds a player (or takes back a seat with its token). Returns null if the room is full. */
  join(hello: { name: unknown; color: unknown; hair: unknown; token?: unknown }): { id: string; token: string } | null {
    const back = typeof hello.token === "string" ? [...this.players.values()].find((p) => p.token === hello.token) : undefined;
    if (back) {
      back.connected = true;
      this.ensureHost();
      this.touch();
      this.flush();
      return { id: back.id, token: back.token };
    }
    if (this.connectedCount >= RULES.maxPlayers) return null;
    // drop seats of players who left, so the room never holds more than max seats
    if (this.players.size >= RULES.maxPlayers) {
      for (const p of [...this.players.values()]) if (!p.connected) this.removePlayer(p.id);
    }
    const id = `p${++this.seq}`;
    const token = this.randomToken();
    const color = typeof hello.color === "string" && COLORS.includes(hello.color) ? hello.color : COLORS[this.players.size % COLORS.length];
    const hair = typeof hello.hair === "string" && HAIRS.includes(hello.hair) ? hello.hair : HAIRS[this.players.size % HAIRS.length];
    this.players.set(id, {
      id,
      token,
      name: this.uniqueName(sanitizeName(hello.name)),
      color,
      hair,
      connected: true,
      joinedAt: this.io.now(),
      lastSay: 0,
      callId: null,
      stats: emptyStats(),
    });
    this.order.push(id);
    this.ensureHost();
    this.systemChat(`${this.players.get(id)!.name} ist der Schicht beigetreten.`);
    this.touch();
    this.flush();
    return { id, token };
  }

  disconnect(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    if (p.callId) {
      const call = this.calls.find((c) => c.id === p.callId);
      if (call && !call.ended) this.endCall(call, "dropped");
    }
    this.hacks.delete(id);
    if (this.phase === "lobby") this.removePlayer(id);
    this.ensureHost();
    this.touch();
    this.flush();
  }

  private removePlayer(id: string) {
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    for (const k of Object.keys(this.votes)) this.votes[k] = this.votes[k].filter((x) => x !== id);
  }

  private ensureHost() {
    const host = this.players.get(this.hostId);
    if (host?.connected) return;
    const next = this.order.map((id) => this.players.get(id)!).find((p) => p.connected);
    if (next) this.hostId = next.id;
    else if (!host) this.hostId = this.order[0] ?? "";
  }

  private uniqueName(name: string) {
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`.toLowerCase())) return `${name} ${i}`;
  }

  /* ---------------- messages ---------------- */

  async handle(id: string, msg: ClientMsg): Promise<void> {
    const p = this.players.get(id);
    if (!p || !msg || typeof msg !== "object") return;
    const host = id === this.hostId;
    switch (msg.t) {
      case "settings":
        if (host && this.phase === "lobby" && (RULES.dayOptions as readonly number[]).includes(msg.daySeconds)) {
          this.daySeconds = msg.daySeconds;
          this.touch();
        }
        break;
      case "start":
        if (!host || this.phase !== "lobby") break;
        if (this.connectedCount < RULES.minPlayers) {
          this.io.send(id, { t: "error", code: "need_players" });
          break;
        }
        this.day = 1;
        this.quota = RULES.quotaStart;
        this.startDay();
        break;
      case "endDay":
        if (host && this.phase === "day") this.endDay();
        break;
      case "chat":
        this.onChat(p, msg.text);
        break;
      case "answer":
        this.onAnswer(p, msg.callId);
        break;
      case "scheme":
        this.onScheme(p, msg.callId, msg.schemeId);
        break;
      case "say":
        await this.onSay(p, msg.callId, msg.text);
        break;
      case "hangup": {
        const call = this.calls.find((c) => c.id === msg.callId && c.playerId === id && !c.ended);
        if (call) {
          call.messages.push(this.sys(`${p.name} hat aufgelegt.`));
          this.endCall(call, "dropped");
        }
        break;
      }
      case "hack":
        this.onHack(p, msg.callId);
        break;
      case "tap":
        this.onTap(p, msg.index);
        break;
      case "closeHack":
        if (this.hacks.delete(id)) this.touch();
        break;
      case "toShop":
        if (host && this.phase === "review") {
          this.phase = "shop";
          this.touch();
        }
        break;
      case "vote":
        this.onVote(p, msg.itemId);
        break;
      case "buy":
        if (host) this.onBuy(msg.itemId);
        break;
      case "nextDay":
        if (host && (this.phase === "review" || this.phase === "shop") && this.review) {
          this.day++;
          this.quota = this.review.nextQuota;
          this.startDay();
        }
        break;
    }
    this.flush();
  }

  private onChat(p: Player, raw: unknown) {
    const { text, removed } = sanitizeText(raw, 200);
    if (!text) return;
    if (removed) this.io.send(p.id, { t: "event", event: { kind: "filtered" } });
    this.chat.push({ id: ++this.chatId, playerId: p.id, text, at: this.io.now() });
    if (this.chat.length > RULES.chatHistory) this.chat.shift();
    this.touch();
  }

  private systemChat(text: string) {
    this.chat.push({ id: ++this.chatId, playerId: null, text, at: this.io.now() });
    if (this.chat.length > RULES.chatHistory) this.chat.shift();
  }

  /* ---------------- day flow ---------------- */

  private startDay() {
    const now = this.io.now();
    this.phase = "day";
    this.bucks = 0;
    this.review = null;
    this.votes = {};
    this.queue = [];
    this.calls = [];
    this.hacks.clear();
    this.spawned = 0;
    this.baiterSpawned = false;
    const seconds = this.io.daySecondsOverride ?? this.daySeconds;
    this.dayEndsAt = now + seconds * 1000;
    for (const p of this.players.values()) {
      p.stats = emptyStats();
      p.callId = null;
    }
    this.spawnCaller();
    this.nextSpawnAt = now + 3000;
    this.setBoss(`Tag ${this.day}! Quote: ${this.quota} Bro-Bucks. An die Telefone!`);
    this.systemChat(`☎️ Tag ${this.day} beginnt. Quote: ${this.quota} Bro-Bucks.`);
    this.touch();
  }

  private endDay() {
    for (const c of this.calls) if (!c.ended) this.endCall(c, "dropped", true);
    this.hacks.clear();
    this.queue = [];
    const rows = this.order.map((id) => this.players.get(id)!).filter(Boolean);
    const total = (k: keyof PlayerStats) => rows.reduce((n, p) => n + p.stats[k], 0);
    const stars = starsFor(this.bucks, this.quota);

    const top = (k: keyof PlayerStats) => {
      let best: Player | null = null;
      for (const p of rows) if (p.stats[k] > 0 && (!best || p.stats[k] > best.stats[k])) best = p;
      return best;
    };
    const awards = new Map<string, string>();
    const give = (p: Player | null, award: string) => {
      if (p && !awards.has(p.id)) awards.set(p.id, award);
    };
    give(top("bucks"), "🍞 Goldener Toaster");
    give(top("hacks"), "💻 Hacker-Hamster");
    for (const p of rows) if (p.stats.baited > 0) give(p, "🐱 Opfer von Agent Brösel");
    give(top("hangups"), "😤 Meist aufgelegt");

    const notes: string[] = [];
    const earner = top("bucks");
    if (earner) notes.push(`+ ${earner.name}: Echtes Telefon-Talent.`);
    const hacker = top("hacks");
    if (hacker) notes.push(`+ ${hacker.name}: Die Hack-Infos waren Gold wert.`);
    const victim = rows.find((p) => p.stats.baited > 0);
    if (victim) notes.push(`− ${victim.name}: Bitte keine Katzen mehr abonnieren.`);
    const hung = top("hangups");
    if (hung && notes.length < 3) notes.push(`− ${hung.name}: Weniger auflegen lassen!`);
    if (!notes.length) notes.push("− Alle: Mehr telefonieren, weniger Kaffee trinken!");

    let line = BOSS.review[stars];
    if (this.bucks >= this.quota) line = `${this.bucks} Bro-Bucks! ${line}`;
    else line = `Nur ${this.bucks} von ${this.quota} Bro-Bucks?! ${line}`;

    this.review = {
      day: this.day,
      quota: this.quota,
      bucks: this.bucks,
      stars,
      line,
      calls: total("calls"),
      wins: total("wins"),
      hangups: total("hangups"),
      baited: total("baited"),
      rows: rows.map((p) => ({ playerId: p.id, name: p.name, color: p.color, hair: p.hair, stats: { ...p.stats }, award: awards.get(p.id) ?? "☕ Solide Schicht" })),
      notes: notes.slice(0, 3),
      nextQuota: nextQuota(this.quota),
    };
    this.wallet += this.bucks;
    this.phase = "review";
    this.setBoss(line);
    this.systemChat(`🔔 Feierabend! ${this.bucks} / ${this.quota} Bro-Bucks.`);
    this.touch();
  }

  /* ---------------- ticking ---------------- */

  tick() {
    const now = this.io.now();
    if (this.phase === "day") {
      if (now >= this.dayEndsAt) {
        this.endDay();
        this.flush();
        return;
      }
      // callers who waited too long give up
      for (const q of [...this.queue]) {
        if (now >= q.expiresAt) {
          this.queue = this.queue.filter((x) => x !== q);
          this.event({ kind: "missed", name: q.name });
          this.setBoss(this.pick(BOSS.missed));
          this.touch();
        }
      }
      if (now >= this.nextSpawnAt && this.queue.length < RULES.maxQueue) {
        this.spawnCaller();
        const players = Math.max(2, this.connectedCount);
        this.nextSpawnAt = now + (RULES.spawnEvery * 1000 * 2) / players;
      }
      for (const c of this.calls) {
        if (!c.ended && !c.thinking && now >= c.endsAt) {
          c.messages.push({ from: "caller", text: this.pick(c.persona.lines.timeout), at: now });
          this.endCall(c, "timeout");
        }
      }
      const before = this.calls.length;
      this.calls = this.calls.filter((c) => !c.ended || now - c.endedAt < RULES.callLinger * 1000);
      if (this.calls.length !== before) this.touch();

      for (const [pid, h] of this.hacks) {
        if (h.result === null && now >= h.endsAt) {
          h.result = "fail";
          h.closeAt = now + 3000;
          this.touch();
        } else if (h.result !== null && now >= h.closeAt) {
          this.hacks.delete(pid);
          this.touch();
        }
      }
      if (now - this.bossAt > 20_000) this.setBoss(this.pick(BOSS.idle));
    }
    this.flush();
  }

  private spawnCaller() {
    const now = this.io.now();
    const busy = new Set([...this.queue.map((q) => q.personaId), ...this.calls.filter((c) => !c.ended).map((c) => c.persona.id)]);
    const regular = PERSONAS.filter((p) => !p.baiter && !busy.has(p.id));
    const baiter = PERSONAS.find((p) => p.baiter && !busy.has(p.id));
    let persona: Persona | undefined;
    if (baiter && !this.baiterSpawned && this.spawned >= 2 && (this.spawned >= 5 || this.io.random() < 0.35)) persona = baiter;
    else persona = regular.length ? this.pick(regular) : undefined;
    if (!persona) return;
    if (persona.baiter) this.baiterSpawned = true;
    this.spawned++;
    this.queue.push({
      id: `c${++this.seq}`,
      personaId: persona.id,
      name: persona.name,
      tagline: persona.tagline,
      avatar: persona.avatar,
      expiresAt: now + RULES.queueWait * 1000,
    });
    this.touch();
  }

  /* ---------------- calls ---------------- */

  private onAnswer(p: Player, callId: string) {
    if (this.phase !== "day" || p.callId) return;
    const q = this.queue.find((x) => x.id === callId);
    const persona = q && personaById(q.personaId);
    if (!q || !persona) return;
    this.queue = this.queue.filter((x) => x !== q);
    this.hacks.delete(p.id);
    const now = this.io.now();
    const bonus = this.owned.includes("headset") ? RULES.headsetBonus : 0;
    this.calls.push({
      id: q.id,
      persona,
      playerId: p.id,
      schemeId: null,
      trust: clamp(persona.startTrust + bonus, 5, 95),
      messages: [],
      intel: [],
      endsAt: now + RULES.callSeconds * 1000,
      ended: false,
      endedAt: 0,
      turns: 0,
      thinking: false,
    });
    p.callId = q.id;
    this.touch();
  }

  private onScheme(p: Player, callId: string, schemeId: string) {
    const call = this.activeCallOf(p, callId);
    const scheme = schemeById(schemeId);
    if (!call || call.schemeId || !scheme || !this.schemes.includes(scheme.id)) return;
    call.schemeId = scheme.id;
    call.trust = clamp(call.trust + (call.persona.schemeAffinity[scheme.id] ?? 0), 5, 95);
    call.messages.push(this.sys(`Masche gewählt: «${scheme.title}»`));
    call.messages.push({ from: "caller", text: this.pick(call.persona.lines.greet), at: this.io.now() });
    this.touch();
  }

  private async onSay(p: Player, callId: string, raw: unknown) {
    const call = this.activeCallOf(p, callId);
    if (!call || !call.schemeId || call.thinking) return;
    const now = this.io.now();
    if (now - p.lastSay < RULES.sayCooldown * 1000) return;
    const { text, removed } = sanitizeText(raw, 220);
    if (!text) return;
    if (removed) this.io.send(p.id, { t: "event", event: { kind: "filtered" } });
    p.lastSay = now;
    const scheme = schemeById(call.schemeId)!;
    const persona = call.persona;
    const history = call.messages
      .filter((m) => m.from !== "system")
      .map((m) => ({ from: m.from as "caller" | "player", text: m.text }));
    const mine: CallMsg = { from: "player", playerId: p.id, text, at: now };
    call.messages.push(mine);
    call.turns++;

    const lower = text.toLowerCase();
    // the team found out this is a scambaiter and says so
    const badge = call.intel.find((i) => persona.intel.find((x) => x.id === i.id)?.exposes);
    if (persona.baiter && badge && persona.intel.find((x) => x.id === badge.id)!.keywords.some((k) => lower.includes(k))) {
      call.messages.push({ from: "caller", text: this.pick(persona.baiter.exposed), at: now });
      const bonus = 50;
      call.amount = bonus;
      this.bucks += bonus;
      p.stats.bucks += bonus;
      this.event({ kind: "exposed", callId: call.id, playerId: p.id, bonus });
      this.setBoss(this.pick(BOSS.exposed));
      this.endCall(call, "exposed");
      return;
    }

    // intel the team found and the player now uses
    let intelHit = null;
    let bonus = 0;
    for (const f of call.intel) {
      if (f.used) continue;
      const intel = persona.intel.find((x) => x.id === f.id);
      if (intel && !intel.exposes && intel.keywords.some((k) => lower.includes(k))) {
        f.used = true;
        intelHit = intel;
        bonus = intel.bonus;
        break;
      }
    }

    call.thinking = true;
    this.touch();
    this.flush();

    let reply;
    try {
      reply = await this.io.brain.respond({ persona, scheme, trust: call.trust, turn: call.turns, history, message: text, intelHit });
    } catch {
      reply = { reply: this.pick(persona.lines.neutral), delta: 0, hangUp: false, source: "script" as const };
    }
    call.thinking = false;
    if (call.ended) return; // day ended or player left meanwhile

    let delta = reply.delta;
    if (delta < 0 && this.owned.includes("cactus")) delta = Math.round(delta * RULES.cactusFactor);
    delta += bonus;
    mine.delta = delta;
    call.trust = clamp(call.trust + delta, 0, 100);
    const at = this.io.now();
    call.messages.push({ from: "caller", text: reply.reply, at });

    if (persona.baiter && (call.turns >= persona.baiter.revealAtTurn || call.trust >= persona.baiter.revealAtTrust)) {
      call.messages.push({ from: "caller", text: this.pick(persona.baiter.reveal), at });
      const penalty = Math.min(this.bucks, persona.baiter.penalty);
      this.bucks -= penalty;
      p.stats.bucks -= penalty;
      this.event({ kind: "baited", callId: call.id, playerId: p.id, penalty: persona.baiter.penalty, name: persona.baiter.realName });
      this.setBoss(this.pick(BOSS.baited));
      this.endCall(call, "baited");
    } else if (call.trust >= 100) {
      const amount = Math.round((scheme.amount * persona.wallet) / 10) * 10;
      call.amount = amount;
      call.messages.push({ from: "caller", text: this.pick(persona.lines.pay), at });
      call.messages.push(this.sys(`💸 ${persona.name} zahlt ${amount} Bro-Bucks!`));
      this.bucks += amount;
      p.stats.bucks += amount;
      this.event({ kind: "paid", callId: call.id, playerId: p.id, amount, name: persona.name });
      this.setBoss(this.pick(BOSS.paid));
      this.endCall(call, "paid");
    } else if (call.trust <= 0 || reply.hangUp) {
      call.messages.push({ from: "caller", text: this.pick(persona.lines.hangup), at });
      this.setBoss(this.pick(BOSS.lost));
      this.endCall(call, "hangup");
    } else if (call.turns >= persona.patience) {
      call.messages.push({ from: "caller", text: this.pick(persona.lines.timeout), at });
      this.setBoss(this.pick(BOSS.lost));
      this.endCall(call, "timeout");
    }
    this.touch();
    this.flush();
  }

  private endCall(call: Call, outcome: CallOutcome, quiet = false) {
    call.ended = true;
    call.thinking = false;
    call.endedAt = this.io.now();
    call.outcome = outcome;
    const p = this.players.get(call.playerId);
    if (p) {
      if (p.callId === call.id) p.callId = null;
      if (outcome !== "dropped") p.stats.calls++;
      if (outcome === "paid") p.stats.wins++;
      if (outcome === "hangup" || outcome === "timeout") p.stats.hangups++;
      if (outcome === "baited") p.stats.baited++;
    }
    for (const [pid, h] of this.hacks) if (h.callId === call.id && h.result === null) this.hacks.delete(pid);
    if (!quiet && p && (outcome === "hangup" || outcome === "timeout" || outcome === "dropped")) {
      this.event({ kind: "lost", callId: call.id, playerId: p.id, name: call.persona.name, outcome });
    }
    this.touch();
  }

  private activeCallOf(p: Player, callId: string) {
    return this.calls.find((c) => c.id === callId && c.playerId === p.id && !c.ended);
  }

  /* ---------------- hacking minigame ---------------- */

  private onHack(p: Player, callId: string) {
    if (this.phase !== "day" || p.callId) return;
    const call = this.calls.find((c) => c.id === callId && !c.ended);
    if (!call || this.hiddenIntel(call).length === 0) return;
    const cur = this.hacks.get(p.id);
    if (cur && cur.result === null) return;
    const codes = new Set<string>();
    while (codes.size < RULES.hackGrid) {
      codes.add(Math.floor(this.io.random() * 256).toString(16).toUpperCase().padStart(2, "0"));
    }
    const grid = [...codes];
    const pool = [...grid];
    const sequence: string[] = [];
    for (let i = 0; i < RULES.hackSequence; i++) sequence.push(pool.splice(Math.floor(this.io.random() * pool.length), 1)[0]);
    const secs = RULES.hackSeconds + (this.owned.includes("coffee") ? RULES.hackCoffeeBonus : 0);
    this.hacks.set(p.id, { callId, playerId: p.id, grid, sequence, progress: 0, endsAt: this.io.now() + secs * 1000, result: null, closeAt: 0 });
    this.touch();
  }

  private onTap(p: Player, index: unknown) {
    const h = this.hacks.get(p.id);
    if (!h || h.result !== null || typeof index !== "number") return;
    const now = this.io.now();
    if (now >= h.endsAt) return;
    if (h.grid[index] === h.sequence[h.progress]) {
      h.progress++;
      if (h.progress >= h.sequence.length) {
        const call = this.calls.find((c) => c.id === h.callId && !c.ended);
        const intel = call && this.hiddenIntel(call)[0];
        h.result = intel ? "win" : "fail";
        h.closeAt = now + 4000;
        if (call && intel) {
          call.intel.push({ id: intel.id, label: intel.label, by: p.name, used: false });
          h.found = intel.label;
          p.stats.hacks++;
          call.messages.push(this.sys(`🔓 ${p.name} hat etwas gefunden: ${intel.label}`));
          this.event({ kind: "intel", callId: call.id, playerId: p.id, label: intel.label });
        }
      }
    } else {
      h.endsAt -= RULES.hackMissPenalty * 1000;
    }
    this.touch();
  }

  private hiddenIntel(call: Call) {
    return call.persona.intel.filter((i) => !call.intel.some((f) => f.id === i.id));
  }

  /* ---------------- shop ---------------- */

  private onVote(p: Player, itemId: string) {
    if ((this.phase !== "shop" && this.phase !== "review") || !shopItemById(itemId) || this.owned.includes(itemId)) return;
    const list = (this.votes[itemId] ??= []);
    const i = list.indexOf(p.id);
    if (i >= 0) list.splice(i, 1);
    else list.push(p.id);
    this.touch();
  }

  private onBuy(itemId: string) {
    const item = shopItemById(itemId);
    if (this.phase !== "shop" || !item || this.owned.includes(item.id) || this.wallet < item.price) return;
    this.wallet -= item.price;
    this.owned.push(item.id);
    if (item.scheme && !this.schemes.includes(item.scheme)) this.schemes.push(item.scheme);
    delete this.votes[item.id];
    this.event({ kind: "bought", itemId: item.id });
    this.systemChat(`🛒 Gekauft: ${item.title}`);
    this.touch();
  }

  /* ---------------- helpers ---------------- */

  private setBoss(line: string) {
    this.bossLine = this.owned.includes("earmuffs") ? `(gedämpft) ${line.toLowerCase()}` : line;
    this.bossAt = this.io.now();
    this.touch();
  }

  private sys(text: string): CallMsg {
    return { from: "system", text, at: this.io.now() };
  }

  private event(event: GameEvent) {
    this.io.broadcast({ t: "event", event });
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(this.io.random() * arr.length) % arr.length];
  }

  private randomToken() {
    let s = "";
    for (let i = 0; i < 24; i++) s += Math.floor(this.io.random() * 36).toString(36);
    return s;
  }

  private touch() {
    this.dirty = true;
  }

  /** Sends the state to everyone if something changed. */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.io.broadcast({ t: "state", state: this.snapshot() });
  }

  snapshot(): RoomState {
    const status = (p: Player): string => {
      if (!p.connected) return "📴 Offline";
      if (this.phase !== "day") return p.id === this.hostId ? "Host" : "Bereit";
      const call = p.callId && this.calls.find((c) => c.id === p.callId);
      if (call) return call.schemeId ? `☎️ Telefoniert mit ${call.persona.name}` : "🤔 Wählt eine Masche…";
      const h = this.hacks.get(p.id);
      if (h && h.result === null) {
        const c = this.calls.find((x) => x.id === h.callId);
        return `💻 Hackt ${c ? c.persona.name.split(" ")[0] : "einen"}s PC · ${Math.round((h.progress / h.sequence.length) * 100)} %`;
      }
      return "☕ Wartet aufs nächste Telefon";
    };
    const players: PlayerView[] = this.order
      .map((id) => this.players.get(id)!)
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, hair: p.hair, host: p.id === this.hostId, connected: p.connected, status: status(p), stats: { ...p.stats } }));
    const calls: CallView[] = this.calls.map((c) => ({
      id: c.id,
      personaId: c.persona.id,
      name: c.persona.name,
      tagline: c.persona.tagline,
      traits: c.persona.traits,
      avatar: c.persona.avatar,
      bg: c.persona.bg,
      playerId: c.playerId,
      schemeId: c.schemeId,
      trust: c.trust,
      mood: moodFor(c.trust),
      thinking: c.thinking,
      messages: c.messages.slice(-30),
      intel: c.intel,
      hiddenIntel: this.hiddenIntel(c).length,
      endsAt: c.endsAt,
      ended: c.ended,
      outcome: c.outcome,
      amount: c.amount,
      turns: c.turns,
      patience: c.persona.patience,
    }));
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      daySeconds: this.io.daySecondsOverride ?? this.daySeconds,
      day: this.day,
      quota: this.quota,
      bucks: this.bucks,
      wallet: this.wallet,
      dayEndsAt: this.dayEndsAt,
      now: this.io.now(),
      players,
      queue: this.queue,
      calls,
      hacks: [...this.hacks.values()].map(({ closeAt: _c, ...h }) => h),
      chat: this.chat,
      bossLine: this.bossLine,
      review: this.review,
      owned: this.owned,
      votes: this.votes,
      schemes: this.schemes,
      ai: this.io.brain.ai,
    };
  }
}

export function moodFor(trust: number): string {
  if (trust < 20) return "stinksauer";
  if (trust < 40) return "misstrauisch";
  if (trust < 60) return "skeptisch, aber neugierig";
  if (trust < 80) return "angetan";
  return "begeistert";
}
