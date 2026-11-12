/** Server settings, all from environment variables (locally from the root .env). */
export interface ServerConfig {
  port: number;
  host: string;
  allowedOrigins: string;
  testDaySeconds?: number;
  /** Trust X-Forwarded-For (behind Render, Railway, Fly, nginx …). */
  trustProxy: boolean;
  env: Record<string, string | undefined>;
  /** How long callers "think" before answering, in ms (tests use 0; default 0.5–1.4 s). */
  thinkMs?: number;
}

export const DEFAULT_ORIGINS =
  "https://*.playtoki.app,https://playtoki.app,https://toki-ashy.vercel.app,http://localhost:*,http://127.0.0.1:*";

export function configFromEnv(env: Record<string, string | undefined> = process.env): ServerConfig {
  const num = (k: string, d: number) => {
    const n = Number(env[k]);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    port: num("PORT", 8787),
    host: env.HOST || "0.0.0.0",
    allowedOrigins: env.ALLOWED_ORIGINS || DEFAULT_ORIGINS,
    thinkMs: env.THINK_MS !== undefined && env.THINK_MS !== "" ? Math.max(0, Number(env.THINK_MS) || 0) : undefined,
    testDaySeconds: Number(env.TEST_DAY_SECONDS) > 0 ? Number(env.TEST_DAY_SECONDS) : undefined,
    trustProxy: env.TRUST_PROXY !== "false",
    env,
  };
}

export function originAllowed(origin: string | undefined | null, list: string): boolean {
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
