import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Loads KEY=value lines from the first .env found (./.env, ../.env). Real env vars always win. */
export function loadDotEnv(paths = [".env", "../.env"]) {
  for (const p of paths) {
    const file = resolve(process.cwd(), p);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || raw.trimStart().startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
    return file;
  }
  return null;
}
