/**
 * Requests to AI endpoints that players typed in themselves. The server must never become a way
 * into private networks (SSRF), so: https only, no credentials in the URL, no internal host names,
 * and every resolved IP address is checked right when the connection is made (no DNS-rebinding
 * window). Redirects are not followed and answers are size-limited.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: "bad_url" | "blocked_url" };

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/i;

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8:");
  }
  return true; // not an IP at all: refuse
}

/** Checks the form of a player-supplied base URL (before any network access). */
export function checkAiUrl(raw: unknown): UrlCheck {
  if (typeof raw !== "string" || raw.length > 300) return { ok: false, reason: "bad_url" };
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/\/+$/, ""));
  } catch {
    return { ok: false, reason: "bad_url" };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return { ok: false, reason: "bad_url" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && isIP(host) === 0) return { ok: false, reason: "blocked_url" };
  if (BLOCKED_NAMES.test(host)) return { ok: false, reason: "blocked_url" };
  if (isIP(host) && isPrivateIp(host)) return { ok: false, reason: "blocked_url" };
  if (/(^|\.)(\d+)$/.test(host) && isIP(host) === 0) return { ok: false, reason: "bad_url" }; // odd numeric forms
  return { ok: true, url };
}

const MAX_BODY = 2 * 1024 * 1024;

/** A small fetch for player endpoints: https, public IPs only, no redirects, 2 MB max. */
export const safeFetch = ((input: string | URL, init: RequestInit = {}) =>
  new Promise<Response>((resolve, reject) => {
    const check = checkAiUrl(String(input));
    if (!check.ok) return reject(new Error(check.reason));
    const url = check.url;
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    const body = typeof init.body === "string" ? init.body : undefined;
    if (body !== undefined) headers["content-length"] = String(Buffer.byteLength(body));

    const req = request(
      {
        protocol: "https:",
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: init.method ?? "GET",
        headers,
        timeout: 20_000,
        // every address is checked when the socket connects
        lookup: (hostname, options, callback) => {
          dnsLookup(hostname, { ...(options as object), all: true }, (err, addresses) => {
            if (err) return (callback as any)(err);
            const list = (addresses as unknown as LookupAddress[]).filter((a) => !isPrivateIp(a.address));
            if (!list.length) return (callback as any)(new Error("blocked_url"));
            if ((options as { all?: boolean }).all) (callback as any)(null, list);
            else (callback as any)(null, list[0].address, list[0].family);
          });
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BODY) {
            req.destroy(new Error("too_big"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const h = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (typeof v === "string") h.set(k, v);
          const status = res.statusCode ?? 502;
          const empty = [101, 204, 205, 304].includes(status);
          resolve(new Response(empty ? null : Buffer.concat(chunks), { status, headers: h }));
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    init.signal?.addEventListener("abort", () => req.destroy(new Error("aborted")));
    if (body !== undefined) req.write(body);
    req.end();
  })) as unknown as typeof fetch;
