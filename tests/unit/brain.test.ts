import { describe, expect, it } from "vitest";
import { PERSONAS, SCHEMES } from "../../shared/src";
import { HybridBrain, LlmBrain, RoomLimiter, ScriptedBrain, buildPrompt, llmConfigFromEnv, parseLlmReply, type BrainContext } from "../../server/src/brain";

const ctx = (message: string): BrainContext => ({ persona: PERSONAS[0], scheme: SCHEMES[0], trust: 40, turn: 1, history: [], message, intelHit: null });

describe("LLM reply parsing", () => {
  it("reads JSON, also wrapped in text", () => {
    expect(parseLlmReply('Klar! {"reply":"Hallo?","trust_delta":7,"hang_up":false}')).toEqual({ reply: "Hallo?", delta: 7, hangUp: false });
  });
  it("clamps deltas and filters links", () => {
    const r = parseLlmReply('{"reply":"Geh auf evil.com","trust_delta":999}')!;
    expect(r.delta).toBe(20);
    expect(r.reply).not.toContain("evil.com");
  });
  it("rejects garbage", () => {
    expect(parseLlmReply("nope")).toBeNull();
    expect(parseLlmReply('{"reply":""}')).toBeNull();
  });
});

describe("LLM config", () => {
  it("no key and no URL: scripted callers", () => {
    expect(llmConfigFromEnv({})).toBeNull();
  });
  it("only an OpenAI key: OpenAI with the default model", () => {
    expect(llmConfigFromEnv({ OPENAI_API_KEY: "sk-x" })).toMatchObject({ baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", apiKey: "sk-x" });
  });
  it("own endpoint like LiteLLM, key optional", () => {
    expect(llmConfigFromEnv({ LLM_BASE_URL: "http://x/v1/", LLM_MODEL: "m" })).toMatchObject({ baseUrl: "http://x/v1", model: "m", apiKey: "" });
  });
  it("prompt contains the rules and persona", () => {
    const { system, user } = buildPrompt(ctx("Hallo"));
    expect(system).toContain("FIKTIV");
    expect(system).toContain(PERSONAS[0].name);
    expect(user).toContain("Hallo");
  });
});

describe("LlmBrain + HybridBrain", () => {
  it("calls an OpenAI-compatible endpoint with the key on the server", async () => {
    let seen: { url: string; auth: string | null; body: any } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"Möwen!","trust_delta":5}' } }] }));
    }) as unknown as typeof fetch;
    const brain = new LlmBrain({ baseUrl: "http://litellm/v1", apiKey: "sk-test", model: "bros", temperature: 0.9, timeoutMs: 1000 }, fake);
    const r = await brain.respond(ctx("Hallo"));
    expect(r).toMatchObject({ reply: "Möwen!", delta: 5, source: "llm" });
    expect(seen!.url).toBe("http://litellm/v1/chat/completions");
    expect(seen!.auth).toBe("Bearer sk-test");
    expect(seen!.body.model).toBe("bros");
  });
  it("retries without max_tokens/temperature when the model rejects them", async () => {
    const bodies: any[] = [];
    const fake = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if ("max_tokens" in body) return new Response("{}", { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"Ok","trust_delta":1}' } }] }));
    }) as unknown as typeof fetch;
    const brain = new LlmBrain({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "m", temperature: 0.9, timeoutMs: 1000 }, fake);
    expect((await brain.respond(ctx("Hi"))).reply).toBe("Ok");
    expect(bodies.length).toBe(2);
  });
  it("falls back to the script on errors and over the room limit", async () => {
    let calls = 0;
    const failing = { ai: true, respond: async () => { calls++; throw new Error("down"); } };
    const ok = { ai: true, respond: async () => ({ reply: "KI", delta: 1, hangUp: false, source: "llm" as const }) };
    const hb = new HybridBrain(failing, new ScriptedBrain(() => 0.5), new RoomLimiter(100, 100));
    expect((await hb.respond(ctx("Hallo"))).source).toBe("script");
    const limited = new HybridBrain(ok, new ScriptedBrain(() => 0.5), new RoomLimiter(2, 100), () => 0);
    const sources = [];
    for (let i = 0; i < 4; i++) sources.push((await limited.respond(ctx("Hallo"))).source);
    expect(sources).toEqual(["llm", "llm", "script", "script"]);
    expect(calls).toBe(1);
  });
});
