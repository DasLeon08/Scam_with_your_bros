// Takes the Toki cover and screenshots from the running game (needs the server and client running).
// Usage: node scripts/screenshots.mjs [clientUrl] [serverUrl]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const CLIENT = process.argv[2] ?? "http://127.0.0.1:5173";
const SERVER = process.argv[3] ?? "http://127.0.0.1:8787";
const OUT = new URL("../client/public/", import.meta.url).pathname;
mkdirSync(OUT + "shots", { recursive: true });
const url = `${CLIENT}/?server=${encodeURIComponent(SERVER)}`;

const browser = await chromium.launch();
const open = async (name, color) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.evaluate(([n, c, h]) => localStorage.setItem("bros.profile", JSON.stringify({ name: n, color: c, hair: h })), [name, ...color]);
  await p.reload();
  return p;
};
const shot = (p, file) => p.screenshot({ path: OUT + file });

const A = await open("Leon", ["#ffc63b", "cap"]);
await A.waitForTimeout(400);
await shot(A, "cover.png");
await A.click("[data-act=create]");
const code = (await A.locator("#code-big").textContent()).trim();
const others = [];
for (const [n, c] of [["Mia", ["#ff5d8f", "bun"]], ["Jonas", ["#7cc8ff", "glasses"]], ["Sam", ["#9b7bff", "none"]]]) {
  const p = await open(n, c);
  await p.fill("#code", code);
  await p.click("button[type=submit]");
  await p.locator("#code-big").waitFor();
  others.push(p);
}
const [B] = others;
await B.fill("#tc-in", "Ich hol schon mal Kaffee ☕");
await B.press("#tc-in", "Enter");
await A.waitForTimeout(500);
await shot(A, "shots/1.png");

await A.click("[data-act=start]");
// Leon takes Gustav (or whoever rings first)
await A.locator(".office [data-act=answer]").first().click();
await A.click("[data-act=scheme][data-v=toaster]");
await B.locator(".office [data-act=hack]").first().click();
const say = async (text) => {
  await A.locator("#say-btn:not([disabled])").waitFor();
  await A.fill("#say", `${await A.locator("#say").inputValue()} ${text}`.trim());
  await A.press("#say", "Enter");
  await A.waitForTimeout(1700);
};
await say("Guten Tag! Hier ist die Abteilung für Küchengeräte-Gesundheit. Ihr Toaster hustet seit Dienstag.");
// Mia solves the minigame halfway for the hack screenshot, then finishes it
const tapNext = async () => {
  const code = (await B.locator(".seq span.next").textContent({ timeout: 2000 }).catch(() => ""))?.trim();
  if (code) await B.locator(".hexgrid button:not([disabled])", { hasText: new RegExp(`^${code}$`) }).click({ timeout: 2000 }).catch(() => {});
  await B.waitForTimeout(150);
};
while (Number((await B.locator(".win .wt span").last().textContent()).split("/")[0]) < 3) await tapNext();
await B.waitForTimeout(3600);
await shot(B, "shots/3.png");
while (!(await B.locator(".found").count())) await tapNext();
await B.waitForTimeout(300);
await others[1].locator(".office [data-act=answer]").first().click().catch(() => {});
await A.locator(".sugg .chip.hot").first().click();
await say("");
await A.waitForTimeout(3600); // let the toast fade
await shot(A, "shots/2.png");

// keep talking until a caller pays; take the next call if one hangs up
for (let round = 0; round < 4; round++) {
  if (round > 0 && (await B.locator(".office [data-act=hack]:not([disabled])").count())) {
    await B.locator(".office [data-act=hack]").first().click().catch(() => {});
    for (let i = 0; i < 40 && !(await B.locator(".found").count()); i++) await tapNext();
    await B.locator(".found [data-act=closehack]").click({ timeout: 3000 }).catch(() => {});
    await A.locator(".sugg .chip.hot").first().click({ timeout: 3000 }).catch(() => {});
  }
  for (let i = 0; i < 10 && (await A.locator("#say").count()); i++) {
    for (const chip of await A.locator(".sugg [data-act=insert]").all()) await chip.click({ timeout: 1000 }).catch(() => {});
    await say("Das ist wirklich wichtig, bitte!").catch(() => {});
  }
  const result = (await A.locator(".result h1").textContent({ timeout: 5000 }).catch(() => "")) ?? "";
  await A.locator("[data-act=dismiss]").click({ timeout: 5000 }).catch(() => {});
  if (result.includes("+")) break;
  await A.locator(".office .ringcard", { hasNotText: "Blümchen" }).locator("[data-act=answer]").first().click({ timeout: 30000 });
  await A.click("[data-act=scheme][data-v=fridge]");
  await A.locator("#say").waitFor();
}
// fast-forward: the host ends the shift
A.once("dialog", (d) => d.accept());
await A.click("[data-act=endday]");
await A.locator("#report").waitFor();
await A.waitForTimeout(300);
await shot(A, "shots/4.png");
await browser.close();
console.log("cover + 4 screenshots written to client/public");
