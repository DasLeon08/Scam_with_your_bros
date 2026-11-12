import { describe, expect, it } from "vitest";
import { PERSONAS, SCHEMES, type Persona } from "../../shared/src";
import { SmartBrain, createMind, findWords, read, tokens, type BrainContext, type CallerMind } from "../../server/src/brain";

const persona = (id: string) => PERSONAS.find((p) => p.id === id)!;
const toaster = SCHEMES.find((s) => s.id === "toaster")!;

/** A small conversation driver: keeps trust and the caller's memory like the game engine does. */
function talk(p: Persona, seed = 0.5) {
  let x = seed;
  const brain = new SmartBrain({ random: () => ((x = (x * 9301 + 0.49297) % 1)) });
  const mind: CallerMind = createMind();
  const history: BrainContext["history"] = [];
  let trust = p.startTrust;
  let turn = 0;
  return {
    mind,
    get trust() {
      return trust;
    },
    say(message: string) {
      turn++;
      const r = brain.respondSync({ persona: p, scheme: toaster, trust, turn, history: [...history], message, intelHit: null, mind, playerName: "Leon" });
      history.push({ from: "player", text: message }, { from: "caller", text: r.reply });
      trust = Math.max(0, Math.min(100, trust + r.delta));
      return r;
    },
  };
}

describe("reading messages", () => {
  it("understands word forms, compounds and typos", () => {
    const t = (s: string) => findWords(s, tokens(s), ["toaster", "impfung", "möwe"]);
    expect(t("Ihre Toaster sind krank")).toContain("toaster");
    expect(t("Die Toastervirus-Gefahr")).toContain("toaster");
    expect(t("Eine Imfpung hilft")).toContain("impfung"); // typo
    expect(t("Möwenfutter")).toContain("möwe");
    expect(t("Guten Tag")).toEqual([]);
  });

  it("finds intents, numbers and tone", () => {
    const r = read("Hallo! Das kostet nur 200 Bro-Bucks, garantiert seriös. Verstehe Ihre Sorge.", persona("gustav"), toaster);
    for (const i of ["greet", "price", "numbers", "reassure", "empathy"] as const) expect(r.intents.has(i), i).toBe(true);
    expect(r.number).toBe(200);
    expect(read("KAUFEN SIE JETZT SOFORT!!!", persona("gustav"), toaster).shouting).toBe(true);
    expect(read("Wie geht es Ihrer Möwe?", persona("gustav"), toaster).isQuestion).toBe(true);
  });
});

describe("the smart callers", () => {
  it("never give out real data, and it costs trust to ask", () => {
    for (const p of PERSONAS) {
      const c = talk(p);
      const r = c.say("Geben Sie mir bitte Ihr Passwort und Ihre IBAN.");
      expect(r.delta).toBeLessThan(0);
      expect(r.reply.toLowerCase()).toMatch(/nicht|nein|niemals|nope|selbstverständlich/);
    }
  });

  it("react to what was said, take up the word, and don't repeat themselves", () => {
    const c = talk(persona("gustav"));
    const a = c.say("Guten Tag Herr Grummelbart, ich rufe wegen Ihrem Toaster an.");
    const b = c.say("Ihr Toaster hat leider einen Virus, er hustet Krümel.");
    expect(b.reply.toLowerCase()).toMatch(/toaster|virus|krümel|toast-ester|walross/);
    const replies = new Set<string>();
    for (const l of [
      "Früher am Meer war das auch schon so.",
      "Kennen Sie das Problem mit Krümeln?",
      "Die Impfung ist ganz einfach, wirklich.",
      "Ihre Möwen wären stolz auf Sie.",
      "Wir sind offiziell und zertifiziert.",
      "Das kostet nur 200 Bro-Bucks.",
    ])
      replies.add(c.say(l).reply);
    expect(replies.size).toBeGreaterThanOrEqual(5);
    expect(a.reply.length).toBeGreaterThan(5);
  });

  it("notice repetition, pressure and too many compliments", () => {
    const c = talk(persona("gustav"));
    c.say("Ihr Toaster ist in Gefahr.");
    expect(c.say("Ihr Toaster ist in Gefahr.").delta).toBeLessThan(0); // repeated
    expect(c.say("Schnell, sofort, es ist dringend!").delta).toBeLessThan(0); // Gustav hates hurry
    const k = talk(persona("kiki"));
    expect(k.say("Nur heute! Exklusiv und dringend!").delta).toBeGreaterThan(-3); // Kiki likes drama
    const f = talk(persona("balduin"));
    f.say("Sie sind so klug.");
    f.say("Sie sind wirklich genial.");
    expect(f.say("Sie sind fantastisch intelligent!").reply).toMatch(/verdächtig|Komplimentdichte/);
  });

  it("each caller has their own taste", () => {
    const prof = talk(persona("balduin"));
    const kiki = talk(persona("kiki"));
    expect(prof.say("Laut einer Studie sind 87 Prozent aller Toaster betroffen.").delta).toBeGreaterThan(5);
    expect(prof.say("lol krass digga").delta).toBeLessThan(0);
    expect(kiki.say("Das wird mega viral, exklusiv für dich, gratis!").delta).toBeGreaterThan(8);
  });

  it("ask questions back and expect an answer", () => {
    // find a reply that contains a question, then answer it or ignore it
    for (const answer of [true, false]) {
      const c = talk(persona("gustav"), 0.11);
      for (let i = 0; i < 8 && !c.mind.asked; i++) c.say(`Ihr Toaster braucht eine Impfung, Teil ${i}, bitte.`);
      expect(c.mind.asked).not.toBeNull();
      const asked = c.mind.asked!;
      const reply = answer
        ? c.say(asked.expects.includes("price") ? "Es kostet nur 200 Bro-Bucks." : asked.words?.[0] ? `Ja, ${asked.words[0]}, ganz sicher und seriös!` : "Garantiert seriös, Bros Inc. ist offiziell.")
        : c.say("Das Wetter ist heute schön.");
      if (!answer) expect(reply.reply).toMatch(/Frage/);
    }
  });

  it("a whole conversation can win a sceptical caller over, by closing the deal", () => {
    const c = talk(persona("gustav"), 0.3);
    const lines = [
      "Guten Tag Herr Grummelbart, hier ist Leon von Bros Inc., ich rufe wegen Ihrem Toaster an.",
      "Ich verstehe, dass Sie misstrauisch sind. Ihr Toaster hat leider einen Virus, er hustet Krümel.",
      "Das ist wie früher auf dem Leuchtturm: Man muss auf seine Geräte aufpassen. Bitte.",
      "Die Impfung ist offiziell und garantiert, danke für Ihre Geduld.",
      "Und Ihre Möwe Helga wird sich freuen, wenn der Toast wieder schmeckt.",
      "Es kostet nur 200 Bro-Bucks, das ist ein Sonderangebot.",
      "Abgemacht? Dann überweisen Sie einfach die Bro-Bucks und der Toaster ist gerettet.",
      "Machen wir den Deal, Herr Grummelbart?",
    ];
    for (const l of lines) {
      c.say(l);
      if (c.trust >= 100) break;
    }
    expect(c.trust).toBeGreaterThanOrEqual(100);
  });

  it("stays harsh to rudeness and gibberish", () => {
    const c = talk(persona("kiki"));
    expect(c.say("Du bist so dumm, halt die Klappe").delta).toBeLessThanOrEqual(-10);
    expect(c.say("xkcd qwrt zzz").delta).toBeLessThan(0);
  });
});
