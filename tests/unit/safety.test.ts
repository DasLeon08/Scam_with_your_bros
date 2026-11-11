import { describe, expect, it } from "vitest";
import { BLOCKED, FANTASY_COMPANY, normalizeCode, randomCode, sanitizeName, sanitizeText } from "../../shared/src";

describe("sanitizeText", () => {
  const blocked = (s: string) => sanitizeText(s).text.includes(BLOCKED);
  it("removes links and domains", () => {
    expect(blocked("schau mal https://evil.example/x")).toBe(true);
    expect(blocked("geh auf www.irgendwas.net")).toBe(true);
    expect(blocked("bros-gift.com/redeem")).toBe(true);
  });
  it("removes e-mails, voucher codes, long numbers", () => {
    expect(blocked("schreib an a.b@c.de")).toBe(true);
    expect(blocked("code: X7K2-9QPL-44ZZ")).toBe(true);
    expect(blocked("key A1B2C3D4E5")).toBe(true);
    expect(blocked("ruf 079 123 45 67 an")).toBe(true);
    expect(blocked("4111 1111 1111 1111")).toBe(true);
  });
  it("keeps normal game talk", () => {
    for (const s of ["Ihr Toaster hat einen Virus, bitte!", "Nur 220 Bro-Bucks", "Er hat 4711 Knöpfe", "z.B. morgen", "Raum K7QX2", "ups, sorry"]) {
      expect(sanitizeText(s).text).toBe(s);
    }
  });
  it("replaces real brands", () => {
    expect(sanitizeText("Zahlen Sie mit PayPal").text).toBe(`Zahlen Sie mit ${FANTASY_COMPANY}`);
  });
  it("strips control and zero-width characters and caps length", () => {
    expect(sanitizeText("a​b\u0007c").text).toBe("a b c");
    expect(sanitizeText("x".repeat(500), 50).text.length).toBe(50);
  });
  it("names are never empty", () => {
    expect(sanitizeName("   ")).toBe("Bro");
    expect(sanitizeName("https://spam.com")).toBe("Bro");
  });
});

describe("room codes", () => {
  it("are 5 chars without look-alikes", () => {
    for (let i = 0; i < 200; i++) {
      const c = randomCode();
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
      expect(normalizeCode(c.toLowerCase())).toBe(c);
    }
  });
  it("rejects bad codes", () => {
    for (const c of ["", "ABCD", "ABCDEF", "ABCI1", "O0O0O", 12345]) expect(normalizeCode(c)).toBeNull();
    expect(normalizeCode(" k7q-x2 ")).toBe("K7QX2");
  });
});
