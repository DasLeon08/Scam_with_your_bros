import { expect, test, type Page } from "@playwright/test";
import { CLIENT, SERVER } from "../../playwright.config";

const url = (q = "") => `${CLIENT}/?server=${encodeURIComponent(SERVER)}${q}`;

/** Clicks if the element is there right now; the UI re-renders on every state update. */
async function tryClick(page: Page, selector: string) {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) return false;
  try {
    await el.click({ timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

/** A simple player bot that only uses what a human sees and clicks. */
async function playDay(page: Page, role: "talker" | "hacker", log: string[]) {
  while (!(await page.locator("#report").count())) {
    if (await page.locator("[data-act=scheme]").count()) {
      await tryClick(page, "[data-act=scheme][data-v=toaster]");
    } else if (await page.locator("#say").count()) {
      const caller = (await page.locator(".caller h2").first().textContent()) ?? "";
      if (caller.includes("Blümchen")) {
        // suspicious gardener: expose him if the team found his badge, else just hang up
        if (await page.locator(".sugg .chip.hot").count()) await tryClick(page, ".sugg .chip.hot");
        else await tryClick(page, ".sugg [data-act=hangup]");
      } else if (await page.locator("#say-btn:not([disabled])").count()) {
        await tryClick(page, ".sugg .chip.hot");
        for (const chip of await page.locator(".sugg [data-act=insert]:not(.hot)").all()) await chip.click({ timeout: 1000 }).catch(() => {});
        await page.locator("#say").fill(`${await page.locator("#say").inputValue()} bitte, danke, das ist wirklich wichtig!`).catch(() => {});
        await page.locator("#say").press("Enter").catch(() => {});
        await page.waitForTimeout(1700); // the server's cooldown between messages
      }
    } else if (await page.locator(".hexgrid").count()) {
      if (await page.locator(".found").count()) {
        log.push(`${role}: ${(await page.locator(".found h3").textContent())?.trim()}`);
        await tryClick(page, ".found [data-act=closehack]");
      } else {
        const next = page.locator(".seq span.next");
        if (await next.count()) {
          const code = (await next.textContent())!.trim();
          await page.locator(".hexgrid button", { hasText: new RegExp(`^${code}$`) }).click({ timeout: 1500 }).catch(() => {});
        }
      }
    } else if (await page.locator("[data-act=dismiss]").count()) {
      log.push(`${role}: ${(await page.locator(".result h1").textContent())?.trim()}`);
      await tryClick(page, "[data-act=dismiss]");
    } else if (role === "hacker" && (await page.locator(".office [data-act=hack]:not([disabled])").count())) {
      await tryClick(page, ".office [data-act=hack]");
    } else if (await page.locator(".office [data-act=answer]").count()) {
      await tryClick(page, ".office [data-act=answer]");
    }
    await page.waitForTimeout(200);
  }
}

test("two browser windows play a complete day in one room", async ({ browser }) => {
  const health = await (await fetch(`${SERVER}/api/health`)).json();
  expect(health.ok).toBe(true);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  for (const c of [ctxA, ctxB]) await c.addInitScript(() => localStorage.setItem("bros.tutorial.done", "1")); // the tour has its own test
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [A, B]) p.on("pageerror", (e) => errors.push(e.message));

  // A creates a room and gets a code
  await A.goto(url());
  await A.fill("#name", "Leon");
  await A.click("[data-act=create]");
  const code = (await A.locator("#code-big").textContent())!.trim();
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);

  // a wrong code does not get you in
  await B.goto(url());
  await B.fill("#name", "Mia");
  await B.fill("#code", "ZZZZZ");
  await B.click("button[type=submit]");
  await expect(B.locator("#title-err")).toContainText("gibt es nicht");

  // B joins with the code
  await B.fill("#code", code.toLowerCase());
  await B.click("button[type=submit]");
  await expect(B.locator("#code-big")).toHaveText(code);
  await expect(A.locator("#count")).toHaveText("2 / 8");
  await expect(B.locator("[data-act=start]")).toHaveCount(0); // only the host starts

  // team chat: no links or codes
  await B.fill("#tc-in", "Gratis unter bros-gift.com mit Code AB12-CD34-EF56");
  await B.press("#tc-in", "Enter");
  await expect(A.locator("#tc-msgs")).toContainText("🚫");
  await expect(A.locator("#tc-msgs")).not.toContainText("bros-gift.com");

  // the host starts the shift
  await A.click("[data-act=start]");
  await expect(A.locator(".quota")).toContainText("/ 1000 Bro-Bucks");
  await expect(B.locator(".quota")).toContainText("/ 1000 Bro-Bucks");

  const log: string[] = [];
  await Promise.all([playDay(A, "talker", log), playDay(B, "hacker", log)]);
  console.log(log.join("\n"));

  // the boss reviews the day on both screens
  for (const p of [A, B]) {
    await expect(p.locator("#report")).toContainText("Chef-Bewertung");
    await expect(p.locator("#report tr")).toHaveCount(3); // header + 2 bros
    await expect(p.locator("#speech")).not.toBeEmpty();
  }
  const quota = (await A.locator(".resgrid div").first().textContent())!;
  const calls = Number((await A.locator(".resgrid div").nth(1).locator("b").textContent())!.trim());
  console.log(`Review: ${quota.replace(/\s+/g, " ")} · ${calls} calls`);
  expect(calls).toBeGreaterThanOrEqual(3);
  await A.screenshot({ path: "test-results/review.png" });

  // shop and the next day
  await A.click("[data-act=toshop]");
  await expect(B.locator(".wallet")).toBeVisible();
  await B.click("[data-act=vote][data-v=earmuffs]");
  await expect(A.locator(".item").last().locator(".votes span")).toHaveCount(1);
  await A.click("[data-act=nextday]");
  await expect(B.locator(".clock")).toContainText("Tag 2");
  await expect(B.locator(".quota")).toContainText("/ 1500 Bro-Bucks");

  expect(errors).toEqual([]);
});
