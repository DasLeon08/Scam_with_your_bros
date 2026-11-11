import { normalizeCode, randomCode } from "@bros/shared";
import { llmConfigFromEnv } from "./brain";
import type { Env } from "./env";

export { Room } from "./room";

const DEFAULT_ORIGINS =
  "https://*.playtoki.app,https://playtoki.app,https://toki-ashy.vercel.app,http://localhost:*,http://127.0.0.1:*";

export function originAllowed(origin: string | null, list: string): boolean {
  if (!origin) return true; // non-browser clients (tests, curl)
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern === "*") return true;
      const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
      return re.test(origin);
    });
}

function cors(origin: string | null): Record<string, string> {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

const json = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

/** Best-effort limit on room creation per IP and isolate. */
const created = new Map<string, number[]>();
function creationAllowed(ip: string, now: number) {
  const list = (created.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 10) return false;
  list.push(now);
  created.set(ip, list);
  if (created.size > 5000) created.clear();
  return true;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    const allowed = originAllowed(origin, env.ALLOWED_ORIGINS || DEFAULT_ORIGINS);
    const headers = allowed ? cors(origin) : {};

    if (req.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers });
    if (!allowed) return json({ error: "origin_not_allowed" }, 403, {});

    if (url.pathname === "/api/health") {
      return json({ ok: true, ai: llmConfigFromEnv(env as unknown as Record<string, unknown>) !== null }, 200, headers);
    }

    // There is deliberately no endpoint that lists rooms: you only get in with a code.
    if (url.pathname === "/api/rooms" && req.method === "POST") {
      const ip = req.headers.get("cf-connecting-ip") ?? "local";
      if (!creationAllowed(ip, Date.now())) return json({ error: "rate_limited" }, 429, headers);
      for (let i = 0; i < 6; i++) {
        const code = randomCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch(`https://room/init?code=${code}`, { method: "POST" });
        if (res.ok) return json({ code }, 200, headers);
      }
      return json({ error: "busy" }, 503, headers);
    }

    const m = url.pathname.match(/^\/ws\/([^/]+)$/);
    if (m) {
      const code = normalizeCode(decodeURIComponent(m[1]));
      if (!code) return json({ error: "bad_code" }, 400, headers);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request(`https://room/ws?code=${code}`, req));
    }

    return json({ error: "not_found" }, 404, headers);
  },
};
