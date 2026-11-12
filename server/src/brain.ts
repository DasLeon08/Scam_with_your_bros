/**
 * The callers' "brain": a rule-based conversation engine, no AI service involved.
 *
 * It reads what the player wrote (intents, topics, tone, numbers; tolerant to typos and word forms),
 * remembers the conversation (topics, questions it asked, pressure, compliments, prices), reacts in
 * the caller's own voice, takes up the player's words, asks questions back, never repeats itself,
 * and decides how much the message changed the caller's trust.
 */
import { PITCH_WORDS, RULES, sanitizeText, type Intel, type Persona, type Scheme } from "@bros/shared";

/* ================================================================== */
/* interfaces used by the game engine                                  */
/* ================================================================== */

export interface BrainContext {
  persona: Persona;
  scheme: Scheme;
  trust: number;
  turn: number;
  /** The conversation before the new message. */
  history: { from: "caller" | "player"; text: string }[];
  message: string;
  /** Intel the player just used correctly in this message. */
  intelHit: Intel | null;
  /** The call's memory (kept by the engine, changed by the brain). */
  mind: CallerMind;
  playerName?: string;
}

export interface BrainReply {
  reply: string;
  delta: number;
  hangUp: boolean;
}

export interface CallerBrain {
  respond(ctx: BrainContext): Promise<BrainReply>;
}

/** What a caller remembers about one call. */
export interface CallerMind {
  topics: string[];
  used: string[];
  asked: { q: string; expects: Intent[]; words: string[]; turn: number } | null;
  askedBefore: string[];
  flatter: number;
  pressure: number;
  polite: number;
  greeted: boolean;
  introduced: boolean;
  price: number | null;
  lastPlayer: string[];
}

export const createMind = (): CallerMind => ({
  topics: [],
  used: [],
  asked: null,
  askedBefore: [],
  flatter: 0,
  pressure: 0,
  polite: 0,
  greeted: false,
  introduced: false,
  price: null,
  lastPlayer: [],
});

/* ================================================================== */
/* text understanding                                                  */
/* ================================================================== */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[“”„«»"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(/[^a-z0-9äöüéèà]+/).filter(Boolean);
}

const fold = (w: string) => w.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
export function stem(w: string): string {
  let s = fold(w);
  for (const end of ["ungen", "ung", "chen", "en", "er", "es", "em", "e", "n", "s"]) {
    if (s.length - end.length >= 4 && s.endsWith(end)) {
      s = s.slice(0, -end.length);
      break;
    }
  }
  return s;
}

/** Edit distance with swapped neighbours counting as one edit (the most common typo). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Which of `words` the text contains: exact, as a word form, in a compound or with a small typo. */
export function findWords(text: string, toks: string[], words: string[]): string[] {
  const hits: string[] = [];
  const norm = normalize(text);
  for (const w of words) {
    const lw = normalize(w);
    if (lw.includes(" ")) {
      if (norm.includes(lw)) hits.push(w);
      continue;
    }
    const sw = stem(lw);
    const ok = toks.some((t) => {
      if (t === lw || stem(t) === sw) return true;
      if (sw.length >= 4 && fold(t).includes(sw)) return true; // compounds: "Toastervirus", "Möwenfutter"
      return lw.length >= 6 && t.length >= 5 && levenshtein(fold(t), fold(lw)) <= (lw.length >= 9 ? 2 : 1);
    });
    if (ok) hits.push(w);
  }
  return hits;
}

export type Intent =
  | "greet" | "introduce" | "pitch" | "price" | "close" | "pressure" | "flatter" | "empathy" | "joke"
  | "rude" | "data" | "question" | "reassure" | "gift" | "bye" | "polite" | "numbers" | "slang"
  | "like" | "dislike" | "apology";

const LEX: Record<Exclude<Intent, "pitch" | "like" | "dislike" | "numbers" | "question">, string[]> = {
  greet: ["hallo", "guten tag", "grüezi", "gruezi", "hoi", "servus", "moin", "salut", "guten morgen", "guten abend", "hi", "hey", "tag auch"],
  introduce: ["bros inc", "abteilung", "ich bin", "mein name", "wir sind", "im auftrag", "kundendienst", "kundenservice", "service", "hier spricht", "ich rufe", "ich arbeite", "firma"],
  price: ["kostet", "kosten", "preis", "gebühr", "gebuehr", "bro-bucks", "bucks", "bezahlen", "zahlen", "betrag", "euro", "franken"],
  close: ["abschliessen", "abschluss", "deal", "abgemacht", "einverstanden", "unterschreiben", "bestätigen", "buchen", "überweisen", "ueberweisen", "jetzt zahlen", "zahlen sie", "sind wir uns einig", "machen wir", "schlagen sie ein", "sagen sie ja", "kaufen"],
  pressure: ["sofort", "dringend", "schnell", "nur heute", "letzte chance", "eilig", "gefahr", "explodiert", "notfall", "beeilen", "keine zeit", "jetzt sofort", "läuft ab", "lauft ab", "katastrophe"],
  flatter: ["toll", "super", "klug", "schlau", "sympathisch", "charmant", "wunderbar", "beeindruckend", "genial", "kompliment", "grossartig", "fantastisch", "wunderschön", "intelligent", "angenehm", "lieb", "nett"],
  empathy: ["verstehe", "verständlich", "keine sorge", "ich höre", "nachvollziehbar", "tut mir leid", "beruhigen", "keine angst", "ich weiss", "kenne das", "geht mir auch so", "ganz ruhig"],
  joke: ["haha", "hihi", "lol", "witz", "😂", "😄", "🤣", "xd", "lustig", "spass"],
  rude: ["dumm", "idiot", "blöd", "bloed", "halt die klappe", "klappe", "du spinnst", "lächerlich", "trottel", "depp", "nervig", "verpiss", "schnauze", "doof"],
  data: ["passwort", "password", "pin", "iban", "kontonummer", "kreditkarte", "karte", "cvv", "ausweis", "ahv", "sozialversicherung", "tan", "zugangsdaten", "login", "bankdaten", "geheimzahl", "sicherheitscode", "adresse"],
  reassure: ["seriös", "serioes", "garantiert", "offiziell", "zertifiziert", "sicher", "vertrauen", "versprochen", "geprüft", "geprueft", "echt", "ehrlich", "wirklich"],
  gift: ["gratis", "rabatt", "geschenk", "bonus", "sonderangebot", "extra", "umsonst", "aktion", "prämie", "praemie"],
  bye: ["tschüss", "tschuess", "auf wiederhören", "bye", "ciao", "adieu", "bis bald", "schönen tag"],
  polite: ["bitte", "danke", "gerne", "freundlich", "herzlich", "merci"],
  slang: ["lol", "krass", "digga", "alter", "chillig", "cringe", "bro", "geil", "safe", "wild", "lit"],
  apology: ["entschuldigung", "sorry", "verzeihung", "entschuldigen"],
};

export interface Reading {
  intents: Set<Intent>;
  hits: Partial<Record<Intent, string[]>>;
  number: number | null;
  isQuestion: boolean;
  shouting: boolean;
  length: number;
  gibberish: boolean;
}

/** Reads a player message: what it does, which words it uses, its tone. */
export function read(text: string, persona: Persona, scheme: Scheme): Reading {
  const toks = tokens(text);
  const hits: Partial<Record<Intent, string[]>> = {};
  const intents = new Set<Intent>();
  const add = (i: Intent, words: string[]) => {
    if (words.length) {
      intents.add(i);
      hits[i] = words;
    }
  };
  for (const [i, words] of Object.entries(LEX) as [Intent, string[]][]) add(i, findWords(text, toks, words));
  add("pitch", findWords(text, toks, scheme.keywords));
  const schemeHits = hits.pitch ?? [];
  add("like", findWords(text, toks, persona.likes).filter((l) => !schemeHits.some((p) => normalize(p).includes(normalize(l)) || normalize(l).includes(normalize(p)))));
  add("dislike", findWords(text, toks, persona.dislikes));
  // "Bitte" alone is politeness, "zahlen" alone is the price topic, not yet a deal
  if (hits.price && hits.close) hits.price = hits.price.filter((w) => !hits.close!.some((c) => c.includes(w)));
  const num = text.match(/(\d+(?:[.,]\d+)?)\s*(%|prozent)?/);
  const number = num ? Number(num[1].replace(",", ".")) : null;
  if (number !== null) add("numbers", [num![0]]);
  const trimmed = text.trim();
  const isQuestion = /\?\s*$/.test(trimmed) || /^(wer|was|wie|wo|wann|warum|wieso|weshalb|welche|haben sie|können sie|mögen sie|sind sie|kennen sie|darf ich)\b/i.test(trimmed);
  if (isQuestion) intents.add("question");
  const letters = text.replace(/[^A-Za-zÄÖÜäöü]/g, "");
  const shouting = letters.length > 8 && letters.replace(/[^A-ZÄÖÜ]/g, "").length / letters.length > 0.6;
  const vowels = (letters.match(/[aeiouäöüAEIOUÄÖÜ]/g) ?? []).length;
  const gibberish = letters.length < 3 || (letters.length > 6 && vowels / letters.length < 0.15);
  return { intents, hits, number, isQuestion, shouting, length: trimmed.length, gibberish };
}

/* ================================================================== */
/* the callers' voices                                                 */
/* ================================================================== */

type Slots = { w?: string; goal: string; amount: number; scheme: string; player: string; q?: string; name: string };
type Lines = string[];

interface Voice {
  /** How strongly the persona reacts to an intent (multiplies the base delta; 0 = ignores it). */
  weights: Partial<Record<Intent | "long" | "short", number>>;
  react: Partial<Record<Intent | "repeat" | "gibberish" | "answered" | "ignored" | "closeEarly" | "closeNearly" | "priceHigh" | "priceOk" | "intel" | "neutralLow" | "neutralMid" | "neutralHigh" | "greetAgain" | "flatterTooMuch" | "pressureAgain", Lines>>;
  /** Questions the caller asks back, with what counts as an answer. */
  questions: { q: string; expects: Intent[]; words?: string[] }[];
  /** Answers when the player asks the caller something. */
  facts: Lines;
  /** A personal touch added to some replies. */
  quirk?: (reply: string, msg: string, rnd: () => number, s: Slots) => string;
}

const GENERIC_QUESTIONS: Voice["questions"] = [
  { q: "Woher haben Sie überhaupt meine Nummer?", expects: ["introduce", "reassure", "joke", "empathy"] },
  { q: "Und was kostet mich das Ganze?", expects: ["price", "numbers", "gift"] },
  { q: "Ist das auch wirklich seriös?", expects: ["reassure", "introduce", "numbers"] },
  { q: "Was genau hat das mit der {goal} zu tun?", expects: ["pitch"] },
];

const MISHEAR: Record<string, string> = {
  toaster: "Toast-Ester", virus: "Walross", impfung: "Kimpfung", kühlschrank: "Kühlschwank", heimweh: "Heimwerk",
  nordpol: "Nordpool", wolke: "Molke", goldfisch: "Goldfrisch", gewonnen: "geschwommen", gebühr: "Gemüse",
  bro: "Brot", bucks: "Box", krümel: "Krümelmonster", schnell: "Schnecke", sofort: "Sofa", sicher: "Sichel",
  garantiert: "garniert", offiziell: "offenziell", seriös: "Sauerteig",
};

const VOICES: Record<string, Voice> = {
  gustav: {
    weights: { pressure: 1.6, flatter: 0.8, empathy: 1.5, joke: 0.4, slang: 1.2, polite: 1.5, long: 0, short: 1 },
    react: {
      greet: ["Ja, ja, guten Tag. Sprechen Sie lauter, ich höre nicht mehr so gut.", "Grüss Gott. Wer stört?"],
      greetAgain: ["Sie haben mich schon begrüsst, junger Mensch. Kommen Sie zur Sache."],
      introduce: ["Bros Inc.? Nie gehört. Aber gut, erzählen Sie.", "Aha. Und das soll ich Ihnen glauben?"],
      pitch: ["{w}? Hm. Das klingt ja beinahe vernünftig.", "Moment… {w}. Davon hat meine Helga auch schon gekrächzt.", "{w}, sagen Sie. Früher gab es so was nicht."],
      like: ["{w}! Jetzt reden wir! Damit kenne ich mich aus.", "Ach, {w}… da werden Erinnerungen wach. Weiter, weiter.", "Sie mögen auch {w}? Sie sind mir ja direkt sympathisch."],
      dislike: ["{w}? Hören Sie mir auf mit {w}!", "Mit {w} brauchen Sie mir gar nicht zu kommen."],
      pressure: ["Nicht so hektisch! Ich bin 71, ich renne nirgendwo mehr hin.", "Hetzen Sie mich nicht, sonst lege ich auf!"],
      pressureAgain: ["Schon WIEDER dieses Gehetze! Mein Puls!"],
      flatter: ["Na, na. Schmeicheln können Sie ja.", "Hm. Das hat mir lange keiner mehr gesagt."],
      flatterTooMuch: ["Jetzt tragen Sie aber dick auf. Das riecht nach Seemannsgarn."],
      empathy: ["Endlich hört mir mal jemand zu.", "Ja, genau so ist es. Sie verstehen das."],
      joke: ["Hä? Ach so, ein Witz. Hehe.", "Haha. Früher hat man noch richtig gelacht."],
      rude: ["WIE BITTE?! So redet man nicht mit einem alten Seemann!", "Frechdachs! Ich hetze gleich die Möwen auf Sie!"],
      data: ["Mein Passwort? Das steht auf einem Zettel im Leuchtturm, und da kommen Sie nicht hin!", "Persönliche Daten gebe ich am Telefon nicht raus. Das hat mir meine Tochter eingebläut."],
      reassure: ["Seriös, sagen Sie… Hm. Wenn Sie es sagen.", "Versprochen? Ein Seemann hält sein Wort. Sie hoffentlich auch."],
      gift: ["Gratis? Da ist doch ein Haken dran.", "Ein Geschenk für mich? Hm, das ist ja nett."],
      apology: ["Na gut, Schwamm drüber.", "Entschuldigung angenommen. Für dieses Mal."],
      bye: ["Wie, Sie gehen schon? Und was ist jetzt mit der {goal}?"],
      priceOk: ["{amount} Bro-Bucks… Das ist ja noch im Rahmen.", "Hm, {amount}. Das kriege ich zusammen."],
      priceHigh: ["{w} Bro-Bucks?! Dafür bekomme ich ja zehn neue Leuchttürme!", "So viel? Da muss ich ja meine Möwen verkaufen!"],
      closeEarly: ["Langsam, langsam! Ich unterschreibe doch nichts, was ich nicht verstehe."],
      closeNearly: ["Fast hätten Sie mich. Erklären Sie mir noch einmal, warum das sein muss."],
      answered: ["Ah, so ist das. Na gut, das beruhigt mich.", "Hm. Das klingt ehrlich."],
      ignored: ["Sie haben meine Frage nicht beantwortet: {q}", "Und meine Frage? {q}"],
      repeat: ["Das haben Sie schon gesagt. Ich bin alt, aber nicht vergesslich.", "Sie wiederholen sich, junger Mensch."],
      gibberish: ["Was? Die Leitung rauscht. Sprechen Sie deutlich!", "Hä? Das habe ich nicht verstanden."],
      neutralLow: ["Ich höre. Aber ich glaube Ihnen noch kein Wort.", "Hm. Weiter."],
      neutralMid: ["Na, erzählen Sie weiter.", "Aha. Und dann?"],
      neutralHigh: ["Sie gefallen mir. Erzählen Sie weiter.", "Ja, ja, das klingt alles gut."],
    },
    questions: [
      { q: "Kennen Sie sich eigentlich mit Möwen aus?", expects: ["like", "joke"], words: ["möwe", "möwen", "vogel", "ja"] },
      { q: "Haben Sie auch so einen alten Toaster?", expects: ["pitch", "joke"], words: ["toaster", "ja", "nein"] },
    ],
    facts: [
      "Ich? Ich war 40 Jahre Leuchtturmwärter. Da sieht man viel Meer und wenig Menschen.",
      "Meine Lieblingsmöwe heisst Helga. Sie klaut mir jeden Tag das Brot.",
      "Mein Toaster ist von 1974 und läuft immer noch. Fast immer.",
    ],
    quirk: (reply, msg, rnd) => {
      if (rnd() > 0.35) return reply;
      for (const t of tokens(msg)) {
        const m = MISHEAR[t] ?? MISHEAR[stem(t)];
        // only words the reply doesn't already take up, so it doesn't sound like an echo
        if (m && !reply.toLowerCase().includes(t)) return `${m}? Ach so, ${t[0].toUpperCase()}${t.slice(1)}! ${reply}`;
      }
      return reply;
    },
  },

  kiki: {
    weights: { pressure: -0.5, flatter: 1.6, joke: 1.2, slang: -0.6, gift: 1.6, polite: 0.5, long: 1.5, empathy: 0.8 },
    react: {
      greet: ["Hiii! Mach schnell, ich bin live! 📸", "Heyyy! Wer bist du und warum bist du nicht viral?"],
      greetAgain: ["Ja hi, hatten wir schon. Weiter! ⏩"],
      introduce: ["Bros Inc.? Klingt wie ein Startup. Seid ihr verifiziert? ✔️", "Okay, und hast du Follower?"],
      pitch: ["Waaas, {w}?! Das ist so random, ich liebe es! #{w}", "{w}… warte, ist das ein Trend? Klingt nach Trend.", "Omg, {w}. Mein Kaktus hatte das auch fast."],
      like: ["{w}!!! Endlich redet jemand meine Sprache! 💅", "Stopp. {w}? Ich bin sooo dabei.", "{w} ist literally mein Lieblingswort."],
      dislike: ["Ugh, {w}. Das ist so 2019.", "{w}? Gähn. 😴"],
      pressure: ["Uh, Zeitdruck! Ich liebe Drama! 🔥", "Nur heute?! Ich hab FOMO, erzähl weiter!"],
      pressureAgain: ["Okay, okay, ich hab's verstanden, es ist dringend. Chill."],
      flatter: ["Awww, danke!! 🥹 Du darfst in meine Story.", "Stopp, ich werd rot. Sag das nochmal, ich nehm's auf."],
      flatterTooMuch: ["Okay, das ist jetzt ein bisschen cringe."],
      empathy: ["Endlich versteht mich mal jemand! 😭", "Danke, das tut gut. Meine 3 Follower sind auch so lieb."],
      joke: ["HAHAHA 😂 du bist lustig, das wird ein Reel.", "Lol, okay, du darfst bleiben."],
      rude: ["Wow. Blockiert. Fast. 🙄", "Sag das nochmal und ich mach einen Callout-Post!"],
      data: ["Mein Passwort?? Das ist mein Kaktus-Name rückwärts, und den verrate ich nicht! 🌵", "Daten? Nope. Das hab ich in einem Video gelernt: niemals am Telefon."],
      reassure: ["Seriös ist so langweilig, aber okay. Ich glaub dir. Fast.", "Garantiert? Dann post ich das safe."],
      gift: ["GRATIS?! Ich bin sooo dabei! 🎁", "Ein Geschenk? Das unboxe ich live!"],
      apology: ["Okay, verziehen. Aber nur, weil du süss klingst."],
      bye: ["Was, du legst auf?! Und meine {goal}?! 😱"],
      priceOk: ["{amount} Bro-Bucks? Das ist weniger als mein Ringlicht!", "Okay, {amount} geht klar, wenn es viral wird."],
      priceHigh: ["{w}?! Bin ich ein Influencer mit Millionen Followern oder was?! (Noch nicht.)"],
      closeEarly: ["Wait, wait, nicht so schnell, ich muss erst eine Umfrage in der Story machen."],
      closeNearly: ["Ich bin fast überzeugt. Sag mir noch, warum das viral geht."],
      answered: ["Okay, das macht Sinn. Glaub ich. ✨", "Oh, nice, danke!"],
      ignored: ["Hallo?! Du hast meine Frage ignoriert: {q} 🙄", "Ähm, meine Frage? {q}"],
      repeat: ["Das hast du schon gesagt. Copy-Paste ist so 2010.", "Du wiederholst dich, das gibt null Engagement."],
      gibberish: ["Hä? Bist du ein Bot? 🤖", "Was war das? Autokorrektur?"],
      neutralLow: ["Mega langweilig bis jetzt. Mach was draus!", "Hm. Erzähl was Spannendes!"],
      neutralMid: ["Okay, ich hör zu. Kurz und knackig bitte!", "Und dann? Schnell!"],
      neutralHigh: ["Ich bin hooked! Weiter!", "Das wird so viral, ich spür's!"],
    },
    questions: [
      { q: "Wird das viral?", expects: ["like", "reassure", "pressure"], words: ["viral", "ja", "sicher", "garantiert", "trend"] },
      { q: "Darf ich das in meine Story posten?", expects: ["reassure", "gift"], words: ["ja", "klar", "natürlich", "gerne", "story"] },
    ],
    facts: [
      "Ich bin Influencerin! 3 Follower, davon 2 Bots. Aber die Bots sind sehr treu.",
      "Mein Kaktus Prickelpit hat mehr Follower als ich. Das ist okay. Nicht.",
      "Ich träume von einer Glitzer-Yacht. Mit Ringlicht.",
    ],
    quirk: (reply, msg, rnd) => {
      if (rnd() > 0.45 || reply.includes("#")) return reply;
      const tags = tokens(msg).filter((t) => t.length >= 5).slice(0, 2);
      return tags.length ? `${reply} ${tags.map((t) => `#${t}`).join(" ")}` : reply;
    },
  },

  balduin: {
    weights: { pressure: 1.2, flatter: 0.3, joke: -0.6, slang: 1.8, numbers: 1.8, reassure: 0.5, long: -1, short: 1.5, polite: 1, empathy: 0.6 },
    react: {
      greet: ["Guten Tag. Bitte kommen Sie präzise zum Punkt.", "Knopf. Professor Doktor Knopf. Ihr Anliegen?"],
      greetAgain: ["Eine zweite Begrüssung ist redundant."],
      introduce: ["Bros Inc. Ich notiere das. Welche Rechtsform?", "Interessant. Seit wann existiert diese Abteilung?"],
      pitch: ["{w}. Faszinierend. Erläutern Sie den Mechanismus.", "{w}? Dazu gibt es keine Literatur. Noch nicht.", "Das Phänomen «{w}» wäre einer Studie würdig."],
      like: ["{w}! Endlich ein Mensch mit Bildung.", "«{w}» – ein exzellentes Wort. Fahren Sie fort.", "{w}. Davon verstehe ich etwas."],
      dislike: ["«{w}»? Das ist wissenschaftlich unhaltbar.", "Bitte vermeiden Sie das Wort «{w}»."],
      pressure: ["Zeitdruck ist ein klassisches Manipulationsmuster. Ich notiere das.", "Eile ist der Feind der Präzision."],
      pressureAgain: ["Sie erhöhen den Druck zum wiederholten Mal. Statistisch auffällig."],
      flatter: ["Komplimente sind keine Argumente.", "Danke. Das ist dennoch kein Beleg."],
      flatterTooMuch: ["Ihre Komplimentdichte ist verdächtig hoch."],
      empathy: ["Ich schätze Ihre Umsicht.", "Ein vernünftiger Gedanke."],
      joke: ["Humor. Ich habe davon gehört.", "Das war ein Witz? Ich lache später, nach der Analyse."],
      rude: ["Ihr Ton ist inakzeptabel. Ich notiere das im Protokoll.", "Beleidigungen sind das Ende jeder Argumentation."],
      data: ["Meine Kontodaten? Selbstverständlich nicht. Das wäre methodisch grob fahrlässig.", "Persönliche Daten am Telefon? Nein. Das lehrt jedes Grundlagenseminar."],
      reassure: ["«Seriös» ist eine Behauptung. Wo sind die Zahlen?", "Garantien bitte schriftlich und mit Quellenangabe."],
      gift: ["Nichts ist gratis. Das ist Thermodynamik.", "Ein Bonus? Wie wird er berechnet?"],
      apology: ["Entschuldigung zur Kenntnis genommen."],
      bye: ["Sie verabschieden sich vor Abschluss der Untersuchung? Bemerkenswert."],
      numbers: ["{w}? Endlich Zahlen! Das gefällt mir.", "Eine Zahl. Präzise. Sehr gut."],
      slang: ["«{w}»? Bitte drücken Sie sich wissenschaftlich aus.", "Jugendsprache. Ich bin enttäuscht."],
      priceOk: ["{amount} Bro-Bucks. Ein angemessener Betrag, sofern belegt.", "{amount}. Das ist rechnerisch vertretbar."],
      priceHigh: ["{w} Bro-Bucks? Das übersteigt jede Kosten-Nutzen-Rechnung."],
      closeEarly: ["Ein Abschluss ohne vollständige Datenlage? Ausgeschlossen."],
      closeNearly: ["Die Beweislage ist fast hinreichend. Ein letztes Argument, bitte."],
      answered: ["Eine präzise Antwort. Danke.", "Das ist nachvollziehbar."],
      ignored: ["Sie sind meiner Frage ausgewichen: {q}", "Ich wiederhole meine Frage: {q}"],
      repeat: ["Diese Aussage ist redundant. Sie haben sie bereits getätigt.", "Wiederholung ersetzt keine Evidenz."],
      gibberish: ["Das war kein grammatikalisch vollständiger Satz.", "Bitte formulieren Sie das in ganzen Sätzen."],
      neutralLow: ["Ihre Argumentation ist bisher dürftig.", "Ich bin nicht überzeugt. Weiter."],
      neutralMid: ["Fahren Sie fort.", "Ich notiere. Und weiter?"],
      neutralHigh: ["Ihre Argumente sind bemerkenswert schlüssig.", "Das deckt sich mit meiner Forschung."],
    },
    questions: [
      { q: "Gibt es dazu eine Studie?", expects: ["numbers", "reassure"], words: ["studie", "forschung", "ja", "prozent", "wissenschaft", "daten"] },
      { q: "Wie hoch ist die Erfolgsquote in Prozent?", expects: ["numbers"], words: ["prozent"] },
    ],
    facts: [
      "Ich erforsche Knöpfe. Seit 38 Jahren. Ich besitze exakt 4711 Stück.",
      "Meine Katze heisst Doktor Schnurr. Sie hat promoviert. Inoffiziell.",
      "Ich zähle alles doppelt. Sicher ist sicher.",
    ],
    quirk: (reply, msg, rnd) => {
      const r = rnd();
      if (r < 0.18 && !/[.!?]$/.test(msg.trim())) return `${reply} Übrigens fehlt am Ende Ihres Satzes ein Satzzeichen.`;
      if (r > 0.82) return `${reply} (Ihre Nachricht hatte exakt ${tokens(msg).length} Wörter.)`;
      return reply;
    },
  },

  wilma: {
    weights: { pressure: 0.4, joke: 1.8, flatter: 1, empathy: 0.8, slang: 0, long: 1.2, polite: 0.8 },
    react: {
      greet: ["Hallo-hallo! Schnell, die Schnecken trainieren gerade!", "Wirbelwind! Wer da? Haha!"],
      greetAgain: ["Ja, hallo nochmal! Haha, wir sind ja schon Freunde!"],
      introduce: ["Bros Inc.! Klingt sportlich! Habt ihr auch eine Mannschaft?", "Aha, und was macht ihr so, ausser telefonieren?"],
      pitch: ["{w}? Haha, das ist ja verrückt!", "Was, {w}? Moment, das muss ich Blitz erzählen!", "{w}! Gibt es dafür einen Pokal?"],
      like: ["{w}! Jetzt wird's spannend!", "Oh, {w}! Davon kann ich stundenlang erzählen!", "{w}? Da bin ich Weltmeisterin! Fast."],
      dislike: ["Uff, {w}. Das ist mir zu kompliziert.", "{w}? Da schlafen mir die Schnecken ein."],
      pressure: ["Schnell? Schnell mag ich! Wie Blitz!", "Zack, zack, ich mag Tempo!"],
      pressureAgain: ["Ja, ja, schnell, hab ich verstanden! Haha!"],
      flatter: ["Ach, Sie Charmeur! Haha!", "Hihi, das sagt meine Schnecke auch immer. Also, sie denkt es."],
      flatterTooMuch: ["Haha, jetzt übertreiben Sie aber!"],
      empathy: ["Genau! Sie verstehen das!", "Ach, Sie sind lieb."],
      joke: ["HAHAHA! Der war gut! Noch einen!", "Haha, Sie gefallen mir! Erzählen Sie weiter!", "Hihihi! Den muss ich mir merken!"],
      rude: ["Na hören Sie mal! Das ist ja unsportlich!", "So nicht! Da lacht ja nicht mal meine Schnecke."],
      data: ["Meine Kontonummer? Haha, nein! Die kennt nicht mal Blitz!", "Daten am Telefon? Niemals! Das ist mein goldenes Gesetz."],
      reassure: ["Na gut, ich vertraue Ihnen. Fast!", "Wenn Sie das versprechen, dann okay!"],
      gift: ["Ein Geschenk?! Haha, ist heute schon mein Geburtstag?", "Gratis? Super! Gewonnen!"],
      apology: ["Schon vergessen! Haha!"],
      bye: ["Was, schon fertig? Und die {goal}?"],
      priceOk: ["{amount} Bro-Bucks? Das ist ja weniger als ein Pokal!", "Okay, {amount}, das geht!"],
      priceHigh: ["{w}?! Dafür kriege ich ja eine ganze Schneckenfarm!"],
      closeEarly: ["Hoppla, nicht so schnell! Ich bin doch keine Rennschnecke! Also schon, aber trotzdem."],
      closeNearly: ["Fast im Ziel! Noch ein kleiner Sprint!"],
      answered: ["Ah, super, danke!", "Perfekt, das wollte ich hören!"],
      ignored: ["Und meine Frage? {q} Haha!", "Sie haben meine Frage überholt: {q}"],
      repeat: ["Das hatten wir schon! Haha, Sie laufen im Kreis!", "Déjà-vu! Haha!"],
      gibberish: ["Hä? Haha, was war das?", "Ist Ihnen die Katze über die Tastatur gelaufen?"],
      neutralLow: ["Hm, das ist noch nicht so lustig.", "Na ja. Und weiter?"],
      neutralMid: ["Ja? Ja! Weiter!", "Und dann, und dann?"],
      neutralHigh: ["Haha, Sie sind ja grossartig!", "Das macht Spass! Weiter so!"],
    },
    questions: [
      { q: "Ist das schneller als meine Schnecke Blitz?", expects: ["joke", "like", "pressure"], words: ["ja", "schneller", "blitz", "schnell"] },
      { q: "Gibt es dafür einen Pokal?", expects: ["gift", "like"], words: ["ja", "pokal", "preis", "gewinn"] },
    ],
    facts: [
      "Ich trainiere Rennschnecken! Mein Champion heisst Blitz.",
      "Morgen ist mein Geburtstag! Haha, ich werde 58. Oder 59?",
      "Ich lache gern. Haha. Sehen Sie?",
    ],
    quirk: (reply, _msg, rnd) => (rnd() < 0.2 ? `Moment, eine Schnecke büxt aus… So! ${reply}` : reply),
  },

  bluemchen: {
    weights: { pressure: -0.5, flatter: 1.2, joke: 1, empathy: 1, rude: 0.5, slang: 0, long: 1 },
    react: {
      greet: ["Oh, guten Tag! Wie schön! Ich war gerade bei den Tomaten.", "Hallo! Ich habe so gern Besuch am Telefon."],
      greetAgain: ["Guten Tag nochmal! Ich grüsse auch gern zweimal."],
      introduce: ["Bros Inc.! Wie aufregend! Können Sie das buchstabieren?", "Oh, und was macht Bros Inc. genau? Erzählen Sie alles!"],
      pitch: ["{w}? Oh, wie interessant! Erklären Sie das ganz langsam.", "{w}… ja, ja! Und was noch?", "Das mit dem {w} müssen Sie mir genau erzählen."],
      like: ["{w}! Ach, Sie sind ja ein Gartenfreund!", "Oh, {w}! Wie schön!"],
      dislike: ["Oh. {w}. Hm. Davon halte ich mich fern.", "{w}? Lieber nicht."],
      pressure: ["Oh, ganz in Ruhe, wir haben doch Zeit.", "Dringend? Ach, im Garten wächst auch alles langsam."],
      pressureAgain: ["Ganz ruhig, wir haben alle Zeit der Welt."],
      flatter: ["Oh, wie lieb von Ihnen!", "Sie sind aber nett!"],
      flatterTooMuch: ["Hihi, jetzt werde ich ganz verlegen."],
      empathy: ["Ja, genau so ist es.", "Sie verstehen mich wirklich."],
      joke: ["Hihi, wie lustig!", "Haha, der war gut! Nochmal, ganz langsam?"],
      rude: ["Oh. Das war aber nicht nett.", "Na, na. Ganz ruhig."],
      data: ["Meine Daten? Nein, nein, die gebe ich nicht raus. Die liegen sicher im Gartenhaus.", "Oh, so etwas sage ich am Telefon nie. Niemals."],
      reassure: ["Ja, ich vertraue Ihnen völlig!", "Natürlich ist das seriös, das höre ich ja."],
      gift: ["Ein Geschenk! Oh, wie wunderbar!", "Gratis? Wie schön!"],
      apology: ["Aber nicht doch, alles gut."],
      bye: ["Oh, schon? Ich hätte noch so viele Fragen!"],
      priceOk: ["{amount} Bro-Bucks, ja, ja, natürlich. Wohin genau?", "Kein Problem! Wie schreibt man {amount}?"],
      priceHigh: ["{w}? Ach, Geld ist nur Dünger. Erzählen Sie weiter!"],
      closeEarly: ["Ja! Gleich! Nur noch ein paar kleine Fragen vorher."],
      closeNearly: ["Fast! Ich hole nur schnell meine Gartenschere."],
      answered: ["Ach so! Danke! Und was ist dann?", "Wunderbar. Und weiter?"],
      ignored: ["Und meine Frage? {q}", "Sie haben meine Frage vergessen: {q}"],
      repeat: ["Das haben Sie schon gesagt, aber ich höre es gern nochmal!"],
      gibberish: ["Wie bitte? Nochmal, ganz langsam?"],
      neutralLow: ["Ja? Erzählen Sie mehr!", "Hm, und weiter?"],
      neutralMid: ["Wie spannend! Weiter!", "Ja, ja! Und dann?"],
      neutralHigh: ["Ich bin ganz Ohr!", "Wunderbar, erzählen Sie alles!"],
    },
    questions: [
      { q: "Können Sie das bitte buchstabieren?", expects: ["polite", "joke"], words: ["ja", "nein"] },
      { q: "Und wie heissen Sie eigentlich mit vollem Namen?", expects: ["introduce"], words: ["heisse", "name", "ich bin"] },
      { q: "Darf ich kurz meinen Stift holen?", expects: ["polite", "empathy"], words: ["ja", "klar", "natürlich"] },
    ],
    facts: ["Ich bin Hobby-Gärtner! Tomaten, Rosen, alles.", "Ich habe sehr viel Zeit. Wirklich sehr viel Zeit.", "Dünger ist meine Leidenschaft."],
    quirk: (reply, _msg, rnd) =>
      rnd() < 0.5 ? `${reply} ${["Moment, ich hole einen Tee.", "Wie schreibt man das?", "Können Sie das wiederholen?", "Ich notiere mir das. Langsam."][Math.floor(rnd() * 4)]}` : reply,
  },
};

/* ================================================================== */
/* the brain                                                           */
/* ================================================================== */

const BASE: Partial<Record<Intent, number>> = {
  greet: 2, introduce: 3, flatter: 4, empathy: 5, joke: 2, rude: -15, data: -12, reassure: 3, gift: 3,
  bye: -3, polite: 2, numbers: 1, slang: -2, apology: 3, question: 2,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface SmartBrainOptions {
  random?: () => number;
  /** Pause before answering, in ms ("denkt nach…"). */
  delay?: () => number;
}

export class SmartBrain implements CallerBrain {
  private random: () => number;
  private delay: () => number;
  constructor(opts: SmartBrainOptions = {}) {
    this.random = opts.random ?? Math.random;
    this.delay = opts.delay ?? (() => 0);
  }

  async respond(ctx: BrainContext): Promise<BrainReply> {
    const ms = this.delay();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return this.respondSync(ctx);
  }

  respondSync(ctx: BrainContext): BrainReply {
    const { persona, scheme, mind } = ctx;
    const voice = VOICES[persona.id] ?? VOICES.gustav;
    const r = read(ctx.message, persona, scheme);
    const slots: Slots = { goal: scheme.goal, amount: scheme.amount, scheme: scheme.title, player: ctx.playerName ?? "", name: persona.name };
    const w = (i: Intent | "long" | "short") => voice.weights[i] ?? 1;
    const fresh = (words: string[] = []) => words.filter((x) => !mind.topics.includes(normalize(x)));
    const reactions: { key: string; w?: string; prio: number }[] = [];
    let delta = Math.round(this.random() * 4) - 2; // a little mood noise: -2 … +2
    let hangUp = false;

    // --- repetition: the same (or nearly the same) as before
    const msgNorm = normalize(ctx.message);
    const repeated = mind.lastPlayer.some((p) => p === msgNorm || (p.length > 12 && levenshtein(p.slice(0, 40), msgNorm.slice(0, 40)) <= 3));
    if (repeated) {
      delta -= 8;
      reactions.push({ key: "repeat", prio: 90 });
    }

    // --- safety: asking for real data is refused, always
    if (r.intents.has("data")) {
      delta += BASE.data!;
      reactions.push({ key: "data", prio: 100 });
    }
    if (r.intents.has("rude")) {
      delta += Math.round(BASE.rude! * w("rude"));
      reactions.push({ key: "rude", prio: 95 });
      if (ctx.trust < 25) hangUp = true;
    }

    // --- the question the caller asked last time
    const asksCaller = r.isQuestion && /\b(sie|ihr|ihre|ihnen|du|dein|deine)\b/i.test(ctx.message) && !r.intents.has("data");
    let openQuestion: string | null = null;
    if (mind.asked && mind.asked.turn === ctx.turn - 1) {
      const q = mind.asked;
      const answered = q.expects.some((i) => r.intents.has(i)) || (q.words?.length ? findWords(ctx.message, tokens(ctx.message), q.words).length > 0 : false);
      if (answered) {
        delta += 7;
        reactions.push({ key: "answered", prio: 70 });
      } else {
        // a question back is fair, ignoring it is not
        delta -= asksCaller ? 2 : 6;
        openQuestion = q.q;
      }
      mind.asked = null;
    }

    // --- intel (bonus is added by the game engine)
    if (ctx.intelHit) reactions.push({ key: "intel", prio: 85 });

    // --- closing the deal
    if (r.intents.has("close")) {
      if (ctx.trust >= 80) delta += 18;
      else if (ctx.trust >= 60) {
        delta += 3;
        reactions.push({ key: "closeNearly", prio: 80 });
      } else {
        delta -= 7;
        reactions.push({ key: "closeEarly", prio: 80 });
      }
    }

    // --- prices: a number near the scheme's amount is fine, much more is not
    if (r.intents.has("price") || (r.number !== null && /bucks|bb|kost|preis|gebühr|zahl/i.test(ctx.message))) {
      if (r.number !== null && r.number > 0) {
        mind.price = r.number;
        if (r.number > scheme.amount * 1.5) {
          delta -= 6;
          reactions.push({ key: "priceHigh", w: String(r.number), prio: 78 });
        } else {
          delta += 4;
          slots.amount = Math.round(r.number);
          reactions.push({ key: "priceOk", prio: 60 });
        }
      } else if (mind.price === null) {
        delta += 1;
      }
    }

    // --- topics: the scheme, what the caller likes and dislikes (each counts once per call)
    const pitch = fresh(r.hits.pitch);
    if (pitch.length) {
      const affinity = persona.schemeAffinity[scheme.id] ?? 0;
      delta += Math.min(2, pitch.length) * (affinity < 0 ? 2 : 4);
      reactions.push({ key: "pitch", w: pitch[0], prio: 50 });
    }
    const likes = fresh(r.hits.like);
    if (likes.length) {
      delta += Math.min(2, likes.length) * 6;
      reactions.push({ key: "like", w: likes[0], prio: 55 });
    }
    const dislikes = r.hits.dislike ?? [];
    if (dislikes.length) {
      // "schnell" is both hurry and a pet hate: one reaction (the hurry one), half the extra penalty
      const isPressure = dislikes.every((x) => (r.hits.pressure ?? []).includes(x));
      delta -= (isPressure ? 4 : 8) * Math.min(2, dislikes.length);
      if (!isPressure) reactions.push({ key: "dislike", w: dislikes[0], prio: 65 });
    }
    const pitchWords = fresh(findWords(ctx.message, tokens(ctx.message), PITCH_WORDS));
    delta += Math.min(2, pitchWords.length) * 2;
    for (const t of [...pitch, ...likes, ...pitchWords]) mind.topics.push(normalize(t));

    // --- tone and moves
    if (r.intents.has("pressure")) {
      mind.pressure++;
      const base = mind.pressure > 1 ? -6 : -4;
      delta += Math.round(base * w("pressure"));
      reactions.push({ key: mind.pressure > 1 ? "pressureAgain" : "pressure", prio: 45 });
    }
    if (r.intents.has("flatter")) {
      mind.flatter++;
      if (mind.flatter >= 3) {
        delta -= 3;
        reactions.push({ key: "flatterTooMuch", prio: 44 });
      } else {
        delta += Math.round((mind.flatter === 1 ? BASE.flatter! : 2) * w("flatter"));
        reactions.push({ key: "flatter", prio: 40 });
      }
    }
    for (const i of ["empathy", "joke", "reassure", "gift", "apology"] as Intent[]) {
      if (!r.intents.has(i)) continue;
      delta += Math.round(BASE[i]! * w(i));
      reactions.push({ key: i, prio: { empathy: 38, joke: 36, reassure: 34, gift: 33, apology: 37 }[i as "empathy"] ?? 30 });
    }
    if (r.intents.has("numbers") && voice.weights.numbers) {
      delta += Math.round(3 * w("numbers"));
      if (!reactions.some((x) => x.key.startsWith("price"))) reactions.push({ key: "numbers", w: r.hits.numbers?.[0], prio: 42 });
    }
    if (r.intents.has("slang")) {
      delta += Math.round(BASE.slang! * w("slang"));
      const alsoDisliked = (r.hits.slang ?? []).some((x) => dislikes.includes(x));
      if (voice.react.slang && !alsoDisliked) reactions.push({ key: "slang", w: r.hits.slang?.[0], prio: 46 });
    }
    if (r.intents.has("polite") && mind.polite < 3) {
      mind.polite++;
      delta += Math.round(BASE.polite! * w("polite"));
    }
    if (r.intents.has("greet")) {
      if (!mind.greeted && ctx.turn <= 2) delta += BASE.greet!;
      reactions.push({ key: mind.greeted ? "greetAgain" : "greet", prio: 20 });
      mind.greeted = true;
    }
    if (r.intents.has("introduce")) {
      if (!mind.introduced) delta += BASE.introduce!;
      mind.introduced = true;
      reactions.push({ key: "introduce", prio: 22 });
    }
    if (r.intents.has("bye")) {
      delta += BASE.bye!;
      reactions.push({ key: "bye", prio: 30 });
    }
    // the player asks the caller something personal: the caller likes to talk about themself
    if (asksCaller) {
      delta += BASE.question!;
      reactions.push({ key: "fact", prio: 58 });
    }
    if (r.shouting) delta -= 5;
    if (r.length > 160) delta += Math.round(-2 * w("long"));
    if (r.length < 12) delta -= Math.round(2 * w("short"));
    if (r.gibberish && reactions.length === 0) {
      delta -= 4;
      reactions.push({ key: "gibberish", prio: 10 });
    }

    // --- build the reply: the strongest reaction, then maybe a question back
    reactions.sort((a, b) => b.prio - a.prio);
    const trustAfter = ctx.trust + delta + (ctx.intelHit?.bonus ?? 0);
    let reply = "";
    const top = reactions[0];
    if (top?.key === "intel") reply = this.say(mind, [`WOHER wissen Sie das?! … Na gut, jetzt bin ich neugierig. Erzählen Sie mehr über die ${scheme.goal}.`, `Moment… das stimmt ja! Woher wissen Sie das? Hm. Sie scheinen mich zu kennen.`, `Das… das weiss doch fast niemand! Na schön, ich höre Ihnen zu.`], slots);
    else if (top?.key === "fact") reply = this.say(mind, voice.facts, slots);
    else if (top) reply = this.say(mind, voice.react[top.key as keyof Voice["react"]] ?? [], { ...slots, w: top.w ?? slots.w });
    if (!reply && !openQuestion) {
      const band = trustAfter < 40 ? "neutralLow" : trustAfter < 70 ? "neutralMid" : "neutralHigh";
      reply = this.say(mind, voice.react[band] ?? [], slots);
    }

    if (openQuestion) {
      slots.q = openQuestion;
      const back = asksCaller ? `Aber zurück zu meiner Frage: ${openQuestion}` : this.say(mind, voice.react.ignored ?? [], slots);
      reply = reactions.length ? `${reply} ${back}` : back;
    }

    // a second, smaller thought when it fits (agreeing to two things at once feels human)
    const second = reactions.find((x, i) => i > 0 && x.prio >= 40 && x.key !== top?.key && x.key !== "repeat");
    if (!openQuestion && second && this.random() < 0.45) {
      const extra = this.say(mind, voice.react[second.key as keyof Voice["react"]] ?? [], { ...slots, w: second.w });
      if (extra && extra.length < 90) reply = `${reply} ${extra}`;
    }

    // ready to pay: the caller asks how; otherwise sometimes a question back
    if (!hangUp && trustAfter >= 85 && trustAfter < 100 && !r.intents.has("close")) {
      const q = `Und wie genau bezahle ich die ${scheme.goal}?`;
      if (!mind.askedBefore.includes(q)) {
        mind.askedBefore.push(q);
        mind.asked = { q, expects: ["close", "price", "numbers"], words: ["bro-bucks", "bucks", "überweis", "zahl"], turn: ctx.turn };
        reply = `${reply} ${q}`;
      }
    } else if (!hangUp && !mind.asked && !openQuestion && !reply.includes("?") && ctx.turn >= 1 && this.random() < 0.38) {
      const pool = [...voice.questions, ...GENERIC_QUESTIONS].filter((x) => !mind.askedBefore.includes(x.q));
      if (pool.length) {
        const pick = pool[Math.floor(this.random() * pool.length)];
        const q = fill(pick.q, slots);
        mind.askedBefore.push(pick.q);
        mind.asked = { q, expects: pick.expects, words: pick.words ?? [], turn: ctx.turn };
        reply = `${reply} ${q}`;
      }
    }

    if (voice.quirk && !reactions.some((x) => x.key === "data" || x.key === "rude")) reply = voice.quirk(reply, ctx.message, this.random, slots);

    mind.lastPlayer.push(msgNorm);
    if (mind.lastPlayer.length > 4) mind.lastPlayer.shift();
    return { reply: sanitizeText(reply, 300).text, delta: clamp(Math.round(delta), -RULES.maxDelta, RULES.maxDelta), hangUp };
  }

  /** A line the caller hasn't said in this call yet (falls back to any when all are used). */
  private say(mind: CallerMind, lines: Lines, slots: Slots): string {
    if (!lines.length) return "";
    const unused = lines.filter((l) => !mind.used.includes(l));
    const pool = unused.length ? unused : lines;
    const line = pool[Math.floor(this.random() * pool.length) % pool.length];
    mind.used.push(line);
    return fill(line, slots);
  }
}

function fill(line: string, s: Partial<Slots>): string {
  return line.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = (s as Record<string, unknown>)[k];
    if (v === undefined || v === "") return k === "w" ? "Das" : "";
    return k === "w" ? cap(String(v)) : String(v);
  });
}
const cap = (x: string) => (x ? x[0].toUpperCase() + x.slice(1) : x);
