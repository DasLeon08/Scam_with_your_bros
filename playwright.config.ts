import { defineConfig } from "@playwright/test";

// The e2e run uses its own ports, scripted callers (no AI) and a short day.
export const SERVER = "http://127.0.0.1:8788";
export const CLIENT = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: { viewport: { width: 1280, height: 720 }, trace: "off" },
  webServer: [
    {
      command:
        "npx wrangler dev --port 8788 --ip 127.0.0.1 --var TEST_DAY_SECONDS:75 --var OPENAI_API_KEY: --var LLM_API_KEY: --var LLM_BASE_URL:",
      cwd: "server",
      url: `${SERVER}/api/health`,
      env: { WRANGLER_SEND_METRICS: "false" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npx vite --port 5174 --host 127.0.0.1",
      cwd: "client",
      url: CLIENT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
