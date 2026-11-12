import { AI_KEY_RE, AI_MODEL_RE, type AiKeyProblem } from "@bros/shared";
import { DEFAULT_MODEL, OPENAI_BASE_URL, type LlmConfig } from "./brain";
import { checkAiUrl } from "./netguard";

/** Turns what a player typed in (endpoint, login, key, model) into a checked config. */
export function endpointFromInput(input: { key?: unknown; model?: unknown; baseUrl?: unknown; auth?: unknown }):
  | { ok: true; cfg: LlmConfig }
  | { ok: false; reason: AiKeyProblem } {
  const auth = input.auth === "api-key" || input.auth === "none" ? input.auth : "bearer";
  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (auth !== "none" && !AI_KEY_RE.test(key)) return { ok: false, reason: "bad_format" };
  const model = typeof input.model === "string" && AI_MODEL_RE.test(input.model.trim()) ? input.model.trim() : DEFAULT_MODEL;
  const url = checkAiUrl(typeof input.baseUrl === "string" && input.baseUrl.trim() ? input.baseUrl : OPENAI_BASE_URL);
  if (!url.ok) return { ok: false, reason: url.reason };
  return {
    ok: true,
    cfg: { baseUrl: url.url.href.replace(/\/+$/, ""), apiKey: auth === "none" ? "" : key, auth, model, temperature: 0.9, timeoutMs: 15000 },
  };
}
