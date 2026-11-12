import { beforeEach, describe, expect, it } from "vitest";
import { PERSONAS, type RoomState, type ServerMsg } from "../../shared/src";
import { SmartBrain } from "../../server/src/brain";
import { GameEngine } from "../../server/src/engine";

function setup(daySeconds = 120) {
  let t = 1_000_000;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sent: { to: string; msg: ServerMsg }[] = [];
  let last: RoomState | null = null;
  const events: ServerMsg[] = [];
  const eng = new GameEngine("K7QX2", {
    now: () => t,
    random,
    brain: new SmartBrain({ random: () => 0.6 }),
    daySecondsOverride: daySeconds,
    send: (to, msg) => sent.push({ to, msg }),
    broadcast: (msg) => {
      if (msg.t === "state") last = msg.state;
      else events.push(msg);
    },
  });
  return {
    eng,
    sent,
    events,
    state: () => last!,
    advance: (ms: number) => {
      for (let i = 0; i < ms; i += 1000) {
        t += 1000;
        eng.tick();
      }
    },
    skip: (ms: number) => (t += ms),
  };
}

describe("GameEngine", () => {
  let g: ReturnType<typeof setup>;
  let a: string, b: string;
  beforeEach(() => {
    g = setup();
    a = g.eng.join({ name: "Leon", color: "#ffc63b", hair: "cap" })!.id;
    b = g.eng.join({ name: "Mia", color: "#ff5d8f", hair: "bun" })!.id;
  });

  it("first player is host; host needs 2 players to start", async () => {
    expect(g.state().hostId).toBe(a);
    const solo = setup();
    const s = solo.eng.join({ name: "X", color: "", hair: "" })!.id;
    await solo.eng.handle(s, { t: "start" });
    expect(solo.state().phase).toBe("lobby");
    expect(solo.sent.at(-1)?.msg).toEqual({ t: "error", code: "need_players" });
    await g.eng.handle(b, { t: "start" }); // not host
    expect(g.state().phase).toBe("lobby");
    await g.eng.handle(a, { t: "start" });
    expect(g.state().phase).toBe("day");
    expect(g.state().queue.length).toBe(1);
  });

  it("rejects a 9th player and gives a seat back by token", () => {
    const tokens: string[] = [];
    for (let i = 0; i < 6; i++) tokens.push(g.eng.join({ name: `P${i}`, color: "", hair: "" })!.token);
    expect(g.eng.join({ name: "Nine", color: "", hair: "" })).toBeNull();
    const seat = g.eng.join({ name: "?", color: "", hair: "", token: tokens[0] });
    expect(seat?.token).toBe(tokens[0]);
  });

  it("a whole day: call, hack intel, pay, quota, review, shop, next day", async () => {
    await g.eng.handle(a, { t: "start" });
    // make sure Gustav is in the queue
    let q = g.state().queue.find((x) => x.personaId === "gustav");
    for (let i = 0; !q && i < 40; i++) {
      g.advance(1000);
      q = g.state().queue.find((x) => x.personaId === "gustav");
      const other = g.state().queue.find((x) => x.personaId !== "gustav");
      if (!q && other) {
        await g.eng.handle(b, { t: "answer", callId: other.id });
        await g.eng.handle(b, { t: "hangup", callId: other.id });
      }
    }
    expect(q).toBeTruthy();
    await g.eng.handle(a, { t: "answer", callId: q!.id });
    let call = g.state().calls.find((c) => c.id === q!.id)!;
    expect(call.playerId).toBe(a);
    await g.eng.handle(a, { t: "scheme", callId: call.id, schemeId: "cloud" }); // not unlocked yet
    expect(g.state().calls[0].schemeId).toBeNull();
    await g.eng.handle(a, { t: "scheme", callId: call.id, schemeId: "toaster" });
    call = g.state().calls.find((c) => c.id === q!.id)!;
    expect(call.schemeId).toBe("toaster");
    expect(call.messages.at(-1)!.from).toBe("caller");

    // Mia hacks Gustav's computer
    await g.eng.handle(b, { t: "hack", callId: call.id });
    const hack = g.state().hacks.find((h) => h.playerId === b)!;
    await g.eng.handle(b, { t: "tap", index: hack.grid.indexOf(hack.sequence[0]) === 0 ? 1 : 0 }); // a miss costs time
    expect(g.state().hacks[0].endsAt).toBe(hack.endsAt - 2000);
    for (const code of hack.sequence) await g.eng.handle(b, { t: "tap", index: hack.grid.indexOf(code) });
    const done = g.state().hacks.find((h) => h.playerId === b)!;
    expect(done.result).toBe("win");
    call = g.state().calls.find((c) => c.id === q!.id)!;
    expect(call.intel[0].label).toContain("Knabberton");

    // Leon talks Gustav into it, using the intel
    const lines = [
      "Guten Tag Herr Grummelbart, bitte hören Sie: Ihr Toaster hat einen Virus, er hustet Krümel!",
      "Sir Knabberton war gefährlich nah am Toaster, die Möwe Helga hat es gesehen, bitte danke!",
      "Die Toaster-Impfung schützt auch den Leuchtturm und das Meer, wie früher, bitte!",
      "Ein echter Seemann wie Sie impft seinen Toaster, danke für Ihr Vertrauen, bitte!",
      "Wie früher am Meer: Möwe, Leuchtturm, Toast. Die Impfung gegen den Virus ist gleich fertig!",
      "Danke, Herr Grummelbart, Ihr Toaster wird wieder brummen wie früher am Leuchtturm, bitte!",
    ];
    for (const text of lines) {
      if (g.state().calls.find((c) => c.id === q!.id)!.ended) break;
      g.skip(2000);
      await g.eng.handle(a, { t: "say", callId: call.id, text });
    }
    call = g.state().calls.find((c) => c.id === q!.id)!;
    expect(call.outcome).toBe("paid");
    expect(call.intel[0].used).toBe(true);
    expect(g.state().bucks).toBeGreaterThan(0);
    expect(g.events.some((e) => e.t === "event" && e.event.kind === "paid")).toBe(true);

    // chat filter
    await g.eng.handle(b, { t: "chat", text: "Gratis-Code: ABCD-1234-EFGH auf free.gift.com" });
    expect(g.state().chat.at(-1)!.text).not.toMatch(/ABCD|gift\.com/);

    // the day runs out
    g.advance(130_000);
    const s = g.state();
    expect(s.phase).toBe("review");
    expect(s.review!.stars).toBeGreaterThanOrEqual(1);
    expect(s.review!.rows.find((r) => r.playerId === a)!.award).toBe("🍞 Goldener Toaster");
    expect(s.review!.rows.find((r) => r.playerId === b)!.award).toBe("💻 Hacker-Hamster");
    expect(s.wallet).toBe(s.review!.bucks);

    // shop: only the host buys, and only what the wallet allows
    await g.eng.handle(a, { t: "toShop" });
    expect(g.state().phase).toBe("shop");
    await g.eng.handle(b, { t: "vote", itemId: "earmuffs" });
    expect(g.state().votes.earmuffs).toEqual([b]);
    await g.eng.handle(b, { t: "buy", itemId: "earmuffs" });
    expect(g.state().owned).toEqual([]);
    await g.eng.handle(a, { t: "buy", itemId: "scheme_goldfish" }); // too expensive
    expect(g.state().owned).toEqual([]);
    const before = g.state().wallet;
    await g.eng.handle(a, { t: "buy", itemId: "earmuffs" });
    expect(g.state().owned).toEqual(["earmuffs"]);
    expect(g.state().wallet).toBe(before - 150);
    await g.eng.handle(a, { t: "nextDay" });
    expect(g.state().phase).toBe("day");
    expect(g.state().day).toBe(2);
    expect(g.state().quota).toBe(1500);
  });

  it("the scambaiter strikes back, or gets exposed with the hacked badge", async () => {
    const baiter = PERSONAS.find((p) => p.baiter)!;
    const run = async (expose: boolean) => {
      const h = setup();
      const x = h.eng.join({ name: "A", color: "", hair: "" })!.id;
      const y = h.eng.join({ name: "B", color: "", hair: "" })!.id;
      await h.eng.handle(x, { t: "start" });
      let q;
      for (let i = 0; i < 200 && !q; i++) {
        h.advance(1000);
        for (const item of h.state().queue) {
          if (item.personaId === baiter.id) q = item;
          else if (!h.state().calls.some((c) => !c.ended && c.playerId === y)) {
            await h.eng.handle(y, { t: "answer", callId: item.id });
            await h.eng.handle(y, { t: "hangup", callId: item.id });
          }
        }
      }
      expect(q).toBeTruthy();
      await h.eng.handle(x, { t: "answer", callId: q!.id });
      await h.eng.handle(x, { t: "scheme", callId: q!.id, schemeId: "toaster" });
      if (expose) {
        await h.eng.handle(y, { t: "hack", callId: q!.id });
        const hk = h.state().hacks.find((k) => k.playerId === y)!;
        for (const code of hk.sequence) await h.eng.handle(y, { t: "tap", index: hk.grid.indexOf(code) });
        h.skip(2000);
        await h.eng.handle(x, { t: "say", callId: q!.id, text: "Wir wissen es: Sie sind Agent Brösel!" });
      } else {
        for (let i = 0; i < 6; i++) {
          h.skip(2000);
          await h.eng.handle(x, { t: "say", callId: q!.id, text: "Ihr Garten mit den Rosen und Tomaten braucht Dünger und eine Toaster-Impfung!" });
        }
      }
      return h.state().calls.find((c) => c.id === q!.id)!.outcome;
    };
    expect(await run(false)).toBe("baited");
    expect(await run(true)).toBe("exposed");
  });

  it("host leaves: the next player becomes host", async () => {
    await g.eng.handle(a, { t: "start" });
    g.eng.disconnect(a);
    expect(g.state().hostId).toBe(b);
  });
});
