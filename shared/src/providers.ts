/**
 * AI providers the in-game settings offer. Every one speaks the OpenAI chat/completions format,
 * so the game needs only the base URL (the part before /chat/completions), a key and a model.
 * Model names are suggestions: players can type any model their endpoint knows.
 */
export type AiAuth = "bearer" | "api-key" | "none";

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  auth: AiAuth;
  keyHint: string;
  /** The base URL has a part the player fills in (e.g. their Azure resource name). */
  editUrl?: boolean;
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", auth: "bearer", keyHint: "sk-…" },
  { id: "tfbern", name: "ASK (TF Bern)", baseUrl: "https://ask.ict-tfbern.ch/api/v1", model: "gpt-4o-mini", auth: "bearer", keyHint: "ASK-API-Key" },
  { id: "openrouter", name: "OpenRouter (viele Modelle, auch Claude)", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", auth: "bearer", keyHint: "sk-or-…" },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", auth: "bearer", keyHint: "gsk_…" },
  { id: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", auth: "bearer", keyHint: "Mistral-API-Key" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", auth: "bearer", keyHint: "sk-…" },
  { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", auth: "bearer", keyHint: "AIza…" },
  { id: "xai", name: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", model: "grok-3-mini", auth: "bearer", keyHint: "xai-…" },
  { id: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", auth: "bearer", keyHint: "Together-API-Key" },
  { id: "fireworks", name: "Fireworks AI", baseUrl: "https://api.fireworks.ai/inference/v1", model: "accounts/fireworks/models/llama-v3p3-70b-instruct", auth: "bearer", keyHint: "fw_…" },
  { id: "perplexity", name: "Perplexity", baseUrl: "https://api.perplexity.ai", model: "sonar", auth: "bearer", keyHint: "pplx-…" },
  { id: "azure", name: "Azure OpenAI", baseUrl: "https://DEIN-RESOURCE-NAME.openai.azure.com/openai/v1", model: "gpt-4o-mini", auth: "api-key", keyHint: "Azure-Key", editUrl: true },
  { id: "custom", name: "Eigener Endpunkt (OpenAI-kompatibel, z. B. LiteLLM, eigener Proxy)", baseUrl: "https://", model: "gpt-4o-mini", auth: "bearer", keyHint: "Key deines Endpunkts", editUrl: true },
];

export const providerById = (id: string) => AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];

/** A key: no spaces, sensible length. Format differs per provider, so nothing more specific. */
export const AI_KEY_RE = /^[A-Za-z0-9._~+/=:-]{8,512}$/;
/** A model name as providers write them (gpt-4o-mini, openai/gpt-4o, accounts/x/models/y …). */
export const AI_MODEL_RE = /^[A-Za-z0-9._:\/@+-]{1,128}$/;
