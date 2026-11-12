import { describe, expect, it } from "vitest";
import { checkAiUrl, isPrivateIp, safeFetch } from "../../server/src/netguard";

describe("player AI endpoints (SSRF guard)", () => {
  it("knows private and special addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("accepts public https endpoints", () => {
    for (const u of ["https://api.openai.com/v1", "https://openrouter.ai/api/v1/", "https://my-proxy.example.com:8443/openai/v1", "https://res.openai.azure.com/openai/v1"]) {
      expect(checkAiUrl(u).ok, u).toBe(true);
    }
  });

  it("refuses everything else", () => {
    const cases: [string, string][] = [
      ["http://api.openai.com/v1", "bad_url"],
      ["https://user:pw@api.openai.com/v1", "bad_url"],
      ["ftp://example.com", "bad_url"],
      ["kein link", "bad_url"],
      ["https://localhost:4000/v1", "blocked_url"],
      ["https://127.0.0.1/v1", "blocked_url"],
      ["https://[::1]/v1", "blocked_url"],
      ["https://169.254.169.254/latest", "blocked_url"],
      ["https://10.0.0.5/v1", "blocked_url"],
      ["https://intranet/v1", "blocked_url"],
      ["https://litellm.internal/v1", "blocked_url"],
      ["https://2130706433/v1", "blocked_url"], // = 127.0.0.1 in disguise
    ];
    for (const [u, reason] of cases) expect(checkAiUrl(u), u).toEqual({ ok: false, reason });
  });

  it("safeFetch never connects to a private address", async () => {
    await expect(safeFetch("https://127.0.0.1/v1/models")).rejects.toThrow("blocked_url");
    await expect(safeFetch("http://example.com/")).rejects.toThrow("bad_url");
  });
});
