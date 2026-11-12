import { expect, test } from "@playwright/test";
import { CLIENT, SERVER } from "../../playwright.config";

const url = `${CLIENT}/?server=${encodeURIComponent(SERVER)}`;
const FAKE = "sk-test-not-a-real-key-1234567890";

test("own AI endpoint: providers, custom URL, kept on this device only, internal addresses refused", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bros.tutorial.done", "1"));
  await page.goto(url);
  await expect(page.locator("#ai-label")).toHaveText("Skript-Anrufer (gratis)");

  // the setting is optional and explains where the key goes
  await page.click("[data-act=aisettings]");
  await expect(page.locator(".modal")).toContainText("nicht in dein Toki-Konto");

  // picking a provider fills in its endpoint and model
  await page.selectOption("#ai-provider", "groq");
  await expect(page.locator("#ai-url")).toHaveValue("https://api.groq.com/openai/v1");
  await page.selectOption("#ai-provider", "azure");
  await expect(page.locator("#ai-auth")).toHaveValue("api-key");

  // a custom endpoint: must be https; then saved
  await page.selectOption("#ai-provider", "custom");
  await page.fill("#ai-url", "http://mein-proxy.example.com/v1");
  await page.fill("#ai-key", FAKE);
  await page.click(".modal button.pink");
  await expect(page.locator("#ai-status")).toContainText("https");
  await page.click("[data-act=aitest]"); // the test button explains the same problem
  await expect(page.locator("#ai-status")).toContainText("https");
  await page.fill("#ai-url", "https://127.0.0.1:4000/v1"); // looks fine here, the server refuses it
  await page.fill("#ai-model", "firma/gpt-4o-mini");
  await page.click("[data-act=aitest]");
  await expect(page.locator("#ai-status")).toContainText("❌ Interne Adressen");
  await page.click(".modal button.pink");
  await expect(page.locator("#ai-status")).toContainText("Gespeichert");
  await expect(page.locator("#ai-label")).toContainText("KI: Eigener Endpunkt");

  // kept after a reload, but never in localStorage (Toki syncs that into accounts)
  await page.reload();
  await expect(page.locator("#ai-label")).toContainText("KI: Eigener Endpunkt");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(FAKE);

  // hosting sends it to the server, which refuses internal addresses; scripted callers stay
  await page.click("[data-act=create]");
  await expect(page.locator("#code-big")).toBeVisible();
  await expect(page.locator("#toasts")).toContainText("Interne Adressen");
  await expect(page.locator("#aimode")).toContainText("Skript-Anrufer");

  // OpenAI with a fake key: refused by OpenAI (or not reachable from here), scripted callers stay
  await page.click("#aimode");
  await page.selectOption("#ai-provider", "openai");
  await page.fill("#ai-key", FAKE);
  await page.click(".modal button.pink");
  await expect(page.locator("#toasts")).toContainText(/abgelehnt|nicht erreichbar/);
  await expect(page.locator("#aimode")).toContainText("Skript-Anrufer");

  // removing it (the dialog is still open with the message)
  await expect(page.locator(".ai-modal")).toBeVisible();
  await page.click("[data-act=aiclear]");
  await expect(page.locator("#toasts")).toContainText("Key entfernt");
});
