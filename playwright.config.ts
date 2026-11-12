import { defineConfig } from "@playwright/test";

// The e2e run uses its own ports, quick-thinking callers and a short day.
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
      // no .env, callers think only briefly, a short day
      command: "npx tsx src/main.ts",
      cwd: "server",
      url: `${SERVER}/api/health`,
      env: { PORT: "8788", HOST: "127.0.0.1", TEST_DAY_SECONDS: "75", NO_DOTENV: "1", THINK_MS: "150" },
      reuseExistingServer: false,
      timeout: 60_000,
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
