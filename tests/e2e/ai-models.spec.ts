import { expect, test } from "@playwright/test";
import { CLIENT, SERVER } from "../../playwright.config";

const url = `${CLIENT}/?server=${encodeURIComponent(SERVER)}`;
const KEY = "sk-test-not-a-real-key-1234567890";

test("model picker shows every model of the endpoint; a saved key never goes to another provider", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bros.tutorial.done", "1"));
  // stand-in for the server's model lookup (the endpoint itself is unit-tested)
  const asked: any[] = [];
  await page.route(`${SERVER}/api/ai/models`, async (route) => {
    const body = route.request().postDataJSON();
    asked.push(body);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, baseUrl: "https://ai.example.com/api/v1", models: ["gpt-4o", "llama-3.1-70b", "mistral-large"] }),
    });
  });

  await page.goto(url);
  await page.click("[data-act=aisettings]");
  await page.selectOption("#ai-provider", "custom");
  await page.fill("#ai-url", "https://ai.example.com/api/v1");
  await page.fill("#ai-key", KEY);
  await page.locator("#ai-key").blur(); // models load by themselves once a key is there
  await expect(page.locator("#ai-models .chip")).toHaveCount(3);
  await expect(page.locator("#ai-status")).toContainText("3 Modelle gefunden");
  await expect(page.locator("#ai-model")).toHaveValue("gpt-4o"); // gpt-4o-mini isn't offered there
  await page.click("#ai-models [data-v=mistral-large]");
  await expect(page.locator("#ai-model")).toHaveValue("mistral-large");
  expect(await page.locator("#ai-model-list option").count()).toBe(3); // also searchable while typing

  // save, then switch provider without typing a new key: the saved key must not be sent to Groq
  await page.click(".modal button.pink");
  await expect(page.locator("#ai-status")).toContainText("Gespeichert");
  await page.click("[data-act=aisettings]");
  await expect(page.locator("#ai-models .chip")).toHaveCount(3); // loaded again on opening
  const before = asked.length;
  await page.selectOption("#ai-provider", "groq");
  await page.click("[data-act=aimodels]");
  await expect(page.locator("#ai-status")).toContainText("braucht es Endpunkt und Key");
  expect(asked.length).toBe(before);
  expect(asked.every((b) => b.baseUrl.startsWith("https://ai.example.com"))).toBe(true);
});
