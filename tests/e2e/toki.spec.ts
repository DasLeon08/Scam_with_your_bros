import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { CLIENT, SERVER } from "../../playwright.config";

/**
 * A stand-in for Toki's game page: it shows the game in an iframe and talks to it the way Toki does
 * (toki-save.js messages): it gives the player's name, answers "Invite friends" with "host",
 * and records the room codes and scores the game reports.
 */
// a different origin than the game (like playtoki.app vs. <slug>.playtoki.app), but local so Chrome allows the frame
const TOKI = "http://localhost:9555";
const tokiPage = (name: string, room = "") => `<!doctype html><html><body style="margin:0">
<iframe id="game" src="${CLIENT}/?server=${encodeURIComponent(SERVER)}${room ? `&room=${room}` : ""}"
  style="width:1280px;height:720px;border:0" allow="fullscreen; autoplay; clipboard-write"></iframe>
<script>
  window.got = [];
  const frame = () => document.getElementById("game").contentWindow;
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.toki !== 1) return;
    window.got.push({ type: m.type, data: m.data });
    if (m.type === "names") frame().postMessage({ toki: 1, type: "name", data: ${JSON.stringify(name)} }, "*");
    if (m.type === "hello") frame().postMessage({ toki: 1, type: "save", data: null }, "*");
  });
  window.inviteFriends = () => frame().postMessage({ toki: 1, type: "host" }, "*");
</script></body></html>`;

// a real local web server, so Chrome treats it like Toki's own page and allows the game frame
let toki: Server;
test.beforeAll(async () => {
  toki = createServer((req, res) => {
    const u = new URL(req.url ?? "/", TOKI);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(tokiPage(u.searchParams.get("name") ?? "", u.searchParams.get("room") ?? ""));
  });
  await new Promise<void>((r) => toki.listen(9555, "127.0.0.1", r));
});
test.afterAll(() => new Promise<void>((r) => toki.close(() => r())));

async function openOnToki(page: Page, name: string, room = "") {
  await page.goto(`${TOKI}/game/scam-with-your-bros?name=${encodeURIComponent(name)}&room=${room}`);
  return page.frameLocator("#game");
}
const reported = (page: Page, type: string) => page.evaluate((t) => (window as any).got.filter((m: any) => m.type === t).map((m: any) => m.data), type);

test("inside Toki: name, Invite friends, invite link and high score", async ({ browser }) => {
  const A = await (await browser.newContext()).newPage();
  const B = await (await browser.newContext()).newPage();

  // Toki gives the name; "Invite friends" opens a room without touching the title screen
  const gameA = await openOnToki(A, "TokiLeon");
  await expect(gameA.locator("#name")).toHaveValue("TokiLeon");
  await expect.poll(() => reported(A, "host")).toContain(true); // the game offered to host
  await A.evaluate(() => (window as any).inviteFriends());
  const code = (await gameA.locator("#code-big").textContent())!.trim();
  await expect.poll(() => reported(A, "room")).toContain(code); // Toki knows the room code

  // a friend opens Toki's invite link: the code is filled in, joining is one click on it
  const gameB = await openOnToki(B, "TokiMia", code);
  await expect(gameB.locator(".invite")).toContainText(code);
  await expect(gameB.locator("#code")).toHaveValue(code);
  await gameB.locator("#join-btn").click();
  await expect(gameB.locator("#code-big")).toHaveText(code);
  await expect(gameA.locator("#pgrid")).toContainText("TokiMia");

  // play starts; the host ends the shift; the team's Bro-Bucks go to Toki's leaderboard
  await gameA.locator("[data-act=start]").click();
  await expect(gameA.locator(".quota")).toBeVisible();
  A.once("dialog", (d) => d.accept());
  await gameA.locator("[data-act=endday]").click();
  await expect(gameA.locator("#report")).toContainText("Chef-Bewertung");
  await expect.poll(() => reported(A, "score")).toEqual([0]);
  await expect.poll(() => reported(B, "score")).toEqual([0]);

  // leaving the room tells Toki
  await gameB.locator("[data-act=leave]").click();
  await expect.poll(async () => (await reported(B, "room")).at(-1)).toBeNull();
});
