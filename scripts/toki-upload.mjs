// Builds the game and puts it on Toki with Toki's official upload script.
// Normally not needed: Toki's GitHub Action builds and uploads on every push.
// Needs TOKI_KEY (Toki → My games → Upload keys). The server address comes from .env.production
// (or VITE_SERVER_URL). Usage: TOKI_KEY=toki_... npm run toki:upload [-- --dry-run]
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (!process.env.TOKI_KEY && !args.includes("--dry-run")) {
  console.error("TOKI_KEY fehlt: Toki → My games → Upload keys. Nie committen!");
  process.exit(1);
}
execSync("npm run build", { cwd: root, stdio: "inherit", env: process.env });

const cache = join(root, "node_modules", ".cache", "toki");
mkdirSync(cache, { recursive: true });
const uploader = join(cache, "toki-upload.mjs");
const res = await fetch("https://www.playtoki.app/toki-upload.mjs");
if (!res.ok) throw new Error(`Toki-Uploader nicht erreichbar (${res.status})`);
writeFileSync(uploader, await res.text());
// the uploader reads toki.json in the root and takes the build from its "folder" (dist)
execSync(`node "${uploader}" "${root}" ${args.join(" ")}`, { cwd: root, stdio: "inherit", env: process.env });
