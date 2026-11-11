/** Tunable numbers of the game. */
export const RULES = {
  maxPlayers: 8,
  minPlayers: 2,
  dayOptions: [180, 360, 600] as const,
  defaultDaySeconds: 360,
  quotaStart: 1000,
  quotaGrowth: 1.5,
  /** Seconds a caller waits in the queue before giving up. */
  queueWait: 45,
  /** Max seconds of one call. */
  callSeconds: 150,
  /** Seconds a finished call stays visible. */
  callLinger: 6,
  /** A new caller every N seconds (when the queue has room). */
  spawnEvery: 9,
  maxQueue: 4,
  /** Minimum seconds between two messages of one player to a caller. */
  sayCooldown: 1.5,
  hackSeconds: 25,
  hackCoffeeBonus: 5,
  hackGrid: 18,
  hackSequence: 5,
  hackMissPenalty: 2,
  headsetBonus: 5,
  cactusFactor: 0.75,
  maxDelta: 20,
  chatHistory: 40,
};

export function starsFor(bucks: number, quota: number): number {
  const r = quota > 0 ? bucks / quota : 0;
  if (r < 0.4) return 1;
  if (r < 0.75) return 2;
  if (r < 1.1) return 3;
  if (r < 1.5) return 4;
  return 5;
}

export function nextQuota(quota: number): number {
  return Math.round((quota * RULES.quotaGrowth) / 50) * 50;
}

export const BOSS = {
  name: "Chef Bruno Brüllmann",
  lobby: [
    "Ich will heute TAUSEND Bro-Bucks sehen! Und wer seinen Kaffee verschüttet, putzt die Möwen!",
    "Willkommen bei Bros Inc.! Hier wird nicht geschlafen, hier wird TELEFONIERT!",
  ],
  idle: [
    "Mehr Toaster! MEHR!",
    "Das Telefon klingelt! Warum klingelt das Telefon noch?!",
    "Ich zahle euch nicht fürs Blinzeln!",
    "Wer zuletzt auflegt, kriegt einen Keks. Vielleicht.",
    "Lächeln beim Telefonieren! Die Anrufer HÖREN das!",
    "Quote! Quote! QUOTE!",
  ],
  paid: ["Sehr gut! So mag ich das!", "Ka-tsching! Weiter so!", "Na also, geht doch!"],
  lost: ["Aufgelegt?! Schon wieder?!", "Das war nix. Nächster!", "Ich hab das gehört. ALLE haben das gehört."],
  missed: ["Ein Anrufer ist eingeschlafen! Nehmt gefälligst ab!", "Klingeln lassen ist hier verboten!"],
  baited: ["WAS?! Ein Scambaiter?! Wer hat den reingelassen?!"],
  exposed: ["Ha! Einen Scambaiter enttarnt! Bonus für alle!"],
  review: {
    1: "Das war… nichts. Gar nichts. Morgen will ich Taten sehen, oder ihr sortiert Büroklammern!",
    2: "Mittelmässig. Sehr mittelmässig. Ich hatte schon Praktikanten, die mehr geschafft haben. Einen.",
    3: "Nicht schlecht, Bros. Aber nicht schlecht ist nicht GUT!",
    4: "Respekt! Das war ein starker Tag. Morgen will ich trotzdem mehr!",
    5: "UNGLAUBLICH! Ihr seid die besten Bros, die Bros Inc. je hatte! Keks für alle!",
  } as Record<number, string>,
};
