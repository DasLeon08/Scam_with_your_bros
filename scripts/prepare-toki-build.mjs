// Puts the toki.json next to the built index.html, so the build folder is a ready-to-play game for Toki.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html fehlt: zuerst npm run build ausführen.");
  process.exit(1);
}
const toki = JSON.parse(readFileSync(join(root, "toki.json"), "utf8"));
delete toki.folder; // in the build branch, the game is in the root
writeFileSync(join(dist, "toki.json"), JSON.stringify(toki, null, 2) + "\n");
writeFileSync(
  join(dist, "README.md"),
  "# Scam with your Bros – fertiger Build\n\nDieser Branch wird automatisch von der GitHub Action «Build» erzeugt. Nicht von Hand ändern: Der Quellcode liegt auf `main`.\n",
);
console.log("dist/ ist bereit für Toki (index.html + toki.json).");
