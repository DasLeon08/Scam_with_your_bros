import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { CLOSE, normalizeCode } from "@bros/shared";
import { WebSocketServer, type WebSocket } from "ws";
import { configFromEnv, originAllowed, type ServerConfig } from "./config";
import { loadDotEnv } from "./dotenv";
import { RoomRegistry } from "./rooms";

/** Best-effort limit on room creation per IP. */
function creationLimiter(perMinute = 10) {
  const seen = new Map<string, number[]>();
  return (ip: string, now = Date.now()) => {
    const list = (seen.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (list.length >= perMinute) return false;
    list.push(now);
    seen.set(ip, list);
    if (seen.size > 10_000) seen.clear();
    return true;
  };
}

export function startServer(cfg: ServerConfig = configFromEnv()) {
  const rooms = new RoomRegistry(cfg);
  const allowCreate = creationLimiter();
  const clientIp = (req: IncomingMessage) => {
    const fwd = cfg.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() : "";
    return fwd || req.socket.remoteAddress || "?";
  };

  const reply = (res: ServerResponse, status: number, data: unknown, origin?: string) => {
    const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store" };
    if (origin !== undefined) {
      headers["access-control-allow-origin"] = origin || "*";
      headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
      headers["access-control-allow-headers"] = "content-type";
      headers["access-control-max-age"] = "86400";
      headers.vary = "origin";
    }
    res.writeHead(status, headers);
    res.end(data === null ? undefined : JSON.stringify(data));
  };

  const http = createServer((req, res) => {
    const origin = req.headers.origin;
    const allowed = originAllowed(origin, cfg.allowedOrigins);
    const cors = allowed ? origin ?? "" : undefined;
    const path = (req.url ?? "/").split("?")[0];

    if (req.method === "OPTIONS") return reply(res, allowed ? 204 : 403, null, cors);
    if (!allowed) return reply(res, 403, { error: "origin_not_allowed" });

    if (path === "/api/health" || path === "/") return reply(res, 200, { ok: true, rooms: rooms.count }, cors);

    if (path === "/api/rooms" && req.method === "POST") {
      req.resume();
      if (!allowCreate(clientIp(req))) return reply(res, 429, { error: "rate_limited" }, cors);
      const room = rooms.create();
      if (!room) return reply(res, 503, { error: "busy" }, cors);
      return reply(res, 200, { code: room.code }, cors);
    }
    return reply(res, 404, { error: "not_found" }, cors);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  http.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "").split("?")[0];
    const m = path.match(/^\/ws\/([^/]+)$/);
    if (!m || !originAllowed(req.headers.origin, cfg.allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      const code = normalizeCode(decodeURIComponent(m[1]));
      const room = code ? rooms.get(code) : undefined;
      if (!room) {
        ws.close(CLOSE.notFound, "not_found");
        return;
      }
      const conn = room.attach(ws);
      let alive = true;
      ws.on("pong", () => (alive = true));
      const beat = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, 25_000);
      ws.on("message", (data, isBinary) => {
        if (!isBinary) room.message(conn, data.toString());
      });
      ws.on("close", () => {
        clearInterval(beat);
        room.close(conn);
      });
      ws.on("error", () => ws.terminate());
    });
  });

  http.listen(cfg.port, cfg.host, () => {
    console.log(`Bros Inc. server on http://${cfg.host}:${cfg.port} · smart callers`);
  });

  const stop = () => {
    rooms.closeAll();
    wss.close();
    http.close();
  };
  return { http, rooms, stop };
}

// started directly (node dist/main.js / tsx src/main.ts)
const self = process.argv[1] ?? "";
if (/main\.(ts|js|mjs)$/.test(self)) {
  if (process.env.NO_DOTENV !== "1") loadDotEnv();
  const { stop } = startServer();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => (stop(), process.exit(0)));
}
