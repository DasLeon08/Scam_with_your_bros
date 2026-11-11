import { expect, test } from "@playwright/test";
import { CLIENT, SERVER } from "../../playwright.config";

const url = `${CLIENT}/?server=${encodeURIComponent(SERVER)}`;
const FAKE = "sk-test-not-a-real-key-1234567890";

test("own OpenAI key: saved on this device only, checked when hosting, script as fallback", async ({ page }) => {
  await page.goto(url);
  await expect(page.locator("#ai-label")).toHaveText("Skript (gratis)");

  // the setting is optional and explains where the key goes
  await page.click("[data-act=aisettings]");
  await expect(page.locator(".modal")).toContainText("nicht in dein Toki-Konto");
  await page.fill("#ai-key", "kein-key");
  await page.click(".modal button.pink");
  await expect(page.locator("#ai-status")).toContainText("beginnt mit sk-");
  await page.fill("#ai-key", FAKE);
  await page.click(".modal button.pink");
  await expect(page.locator("#ai-status")).toContainText("Gespeichert");
  await expect(page.locator("#ai-label")).toHaveText("eigener OpenAI-Key");

  // kept after a reload, but never in localStorage (Toki syncs that into accounts)
  await page.reload();
  await expect(page.locator("#ai-label")).toHaveText("eigener OpenAI-Key");
  const ls = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(ls).not.toContain(FAKE);

  // hosting sends it to the server once; a fake key is refused and the scripted callers stay
  await page.click("[data-act=create]");
  await expect(page.locator("#code-big")).toBeVisible();
  await expect(page.locator("#toasts")).toContainText(/OpenAI (hat den Key abgelehnt|ist gerade nicht erreichbar)/);
  await expect(page.locator("#aimode")).toContainText("Skript-Anrufer");

  // removing it
  await page.click("#aimode");
  await page.click("[data-act=aiclear]");
  await expect(page.locator("#toasts")).toContainText("Key entfernt");
});
