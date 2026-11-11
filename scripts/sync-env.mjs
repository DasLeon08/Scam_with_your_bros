// Copies the server settings from the root .env into server/.dev.vars, which `wrangler dev` reads.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEYS = ["OPENAI_API_KEY", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_TEMPERATURE", "LLM_TIMEOUT_MS", "RATE_LIMIT_PER_MINUTE", "RATE_LIMIT_PER_ROOM", "ALLOWED_ORIGINS", "TEST_DAY_SECONDS"];
const src = join(root, ".env");
const out = join(root, "server", ".dev.vars");
const lines = [];
if (existsSync(src)) {
  for (const raw of readFileSync(src, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && KEYS.includes(m[1])) lines.push(`${m[1]}=${m[2]}`);
  }
}
for (const k of KEYS) if (process.env[k] !== undefined && !lines.some((l) => l.startsWith(`${k}=`))) lines.push(`${k}=${process.env[k]}`);
writeFileSync(out, lines.join("\n") + "\n");
console.log(`server/.dev.vars: ${lines.map((l) => l.split("=")[0]).join(", ") || "(empty, scripted callers)"}`);
