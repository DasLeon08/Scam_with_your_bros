export interface Env {
  ROOMS: DurableObjectNamespace;
  /** Comma-separated list of allowed page origins; `*` as a wildcard part, e.g. https://*.playtoki.app */
  ALLOWED_ORIGINS?: string;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  OPENAI_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_TEMPERATURE?: string;
  LLM_TIMEOUT_MS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_PER_ROOM?: string;
  TEST_DAY_SECONDS?: string;
}
