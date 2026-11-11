/** Server settings, all from environment variables (locally from the root .env). */
export interface ServerConfig {
  port: number;
  host: string;
  allowedOrigins: string;
  rateLimitPerMinute: number;
  rateLimitPerRoom: number;
  testDaySeconds?: number;
  /** Trust X-Forwarded-For (behind Render, Railway, Fly, nginx …). */
  trustProxy: boolean;
  env: Record<string, string | undefined>;
  /** For tests: how the server talks to the AI endpoint. */
  fetchFn?: typeof fetch;
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
    rateLimitPerMinute: num("RATE_LIMIT_PER_MINUTE", 20),
    rateLimitPerRoom: num("RATE_LIMIT_PER_ROOM", 400),
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
