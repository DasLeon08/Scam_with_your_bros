import { expect, test } from "@playwright/test";
import { CLIENT, SERVER } from "../../playwright.config";

const url = `${CLIENT}/?server=${encodeURIComponent(SERVER)}`;

test("short tour: shown once, can be skipped, opens again on request", async ({ page }) => {
  await page.goto(url);
  const tut = page.locator(".tut");
  await expect(tut).toContainText("Willkommen bei Bros Inc.");
  await page.click("[data-act=tutnext]");
  await expect(tut).toContainText("Raum per Code");
  await page.click("[data-act=tutprev]");
  await expect(tut).toContainText("Willkommen");

  // skipping closes it and it doesn't come back by itself
  await page.click("[data-act=tutskip]");
  await expect(tut).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#name")).toBeVisible();
  await expect(tut).toHaveCount(0);

  // "So geht's" opens it again; the keyboard works; the last step starts playing
  await page.click("[data-act=tutorial]");
  await expect(tut).toBeVisible();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect(tut).toContainText("Quote, Chef und Shop");
  await page.click("[data-act=tutnext]");
  await expect(tut).toHaveCount(0);
  await page.click("[data-act=tutorial]");
  await page.keyboard.press("Escape");
  await expect(tut).toHaveCount(0);
});
