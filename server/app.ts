import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { publicDeck } from "../shared/deck.ts";
import { PIN, SESSION_CODE, type CreateSessionResponse, type SessionInfo } from "../shared/protocol.ts";
import { WsHub } from "./realtime/ws-hub.ts";
import { DECK_ID, DeckStore, listDecks } from "./decks.ts";
import { SessionRegistry } from "./session/registry.ts";
import { notFound, safeJoin, sendFile, serveSpa } from "./static.ts";

export interface AppOptions {
  decksDir: string;
  /** Built SPA directory; null in development (Vite serves the client). */
  distDir: string | null;
  /** Required in the x-admin-key header to create sessions; null leaves creation open (development). */
  adminKey: string | null;
  /** Public origin, e.g. https://deck.example.com. Derived from the request when null. */
  publicBaseUrl: string | null;
  /** Trust X-Forwarded-Proto/Host from a reverse proxy. */
  trustProxy: boolean;
  allowedOrigins: string[];
  now?: () => number;
  tickMs?: number;
}

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit = 4096): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createApp(opts: AppOptions) {
  const now = opts.now ?? Date.now;
  const decks = new DeckStore(opts.decksDir);
  const registry = new SessionRegistry();

  const baseUrl = (req: IncomingMessage): string => {
    if (opts.publicBaseUrl) return opts.publicBaseUrl.replace(/\/$/, "");
    const fwdProto = opts.trustProxy ? String(req.headers["x-forwarded-proto"] ?? "").split(",")[0] : "";
    const fwdHost = opts.trustProxy ? String(req.headers["x-forwarded-host"] ?? "").split(",")[0] : "";
    return `${fwdProto || "http"}://${fwdHost || req.headers.host}`;
  };

  const hub = new WsHub({ registry, now, baseUrl, allowedOrigins: opts.allowedOrigins, ...(opts.tickMs ? { tickMs: opts.tickMs } : {}) });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url ?? "/", "http://x").pathname;

    if (path === "/api/health") return json(res, 200, { ok: true, sessions: registry.size });

    if (path === "/api/decks" && req.method === "GET") {
      if (opts.adminKey && !sameSecret(String(req.headers["x-admin-key"] ?? ""), opts.adminKey)) return json(res, 401, { error: "admin key required" });
      return json(res, 200, await listDecks(decks, opts.decksDir));
    }

    // Public projection only: never expose notes or quiz answers.
    const deckMatch = /^\/api\/decks\/([^/]+)$/.exec(path);
    if (deckMatch && req.method === "GET") {
      const id = deckMatch[1]!;
      if (!DECK_ID.test(id)) return json(res, 400, { error: "invalid deck id" });
      try {
        return json(res, 200, publicDeck(await decks.load(id)));
      } catch {
        return json(res, 404, { error: "deck not found" });
      }
    }

    if (path === "/api/sessions" && req.method === "POST") {
      if (opts.adminKey && !sameSecret(String(req.headers["x-admin-key"] ?? ""), opts.adminKey)) return json(res, 401, { error: "admin key required" });
      let body: { deckId?: unknown; pin?: unknown };
      try {
        body = (await readJson(req)) as typeof body;
      } catch {
        return json(res, 400, { error: "invalid json" });
      }
      if (typeof body.deckId !== "string" || !DECK_ID.test(body.deckId)) return json(res, 400, { error: "invalid deckId" });
      if (typeof body.pin !== "string" || !PIN.test(body.pin)) return json(res, 400, { error: "PIN must be 4 to 8 digits" });
      let deck;
      try {
        deck = await decks.load(body.deckId);
      } catch (err) {
        return json(res, 422, { error: (err as Error).message });
      }
      const entry = registry.create(body.deckId, deck, body.pin, now());
      const base = baseUrl(req);
      const response: CreateSessionResponse = {
        code: entry.session.code,
        presenterToken: entry.token,
        presenterUrl: `${base}/p/${entry.token}`,
        joinUrl: `${base}/s/${entry.session.code}`,
      };
      return json(res, 201, response);
    }

    const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
    if (sessionMatch && req.method === "GET") {
      const code = sessionMatch[1]!.toUpperCase();
      const entry = SESSION_CODE.test(code) ? registry.get(code) : undefined;
      if (!entry) return json(res, 404, { error: "session not found" });
      const snap = entry.session.snapshot();
      const info: SessionInfo = { code, title: entry.session.deck.title, status: snap.status, restricted: snap.restricted };
      return json(res, 200, info);
    }

    const assetMatch = /^\/decks\/([^/]+)\/assets\/(.+)$/.exec(path);
    if (assetMatch && req.method === "GET") {
      const id = assetMatch[1]!;
      const file = DECK_ID.test(id) ? safeJoin(decks.assetsDir(id), assetMatch[2]!) : null;
      if (file && (await sendFile(res, file, "public, max-age=3600"))) return;
      return notFound(res);
    }

    if (path.startsWith("/api/")) return json(res, 404, { error: "not found" });
    if (opts.distDir && req.method === "GET") return serveSpa(req, res, opts.distDir);
    notFound(res);
  }

  return {
    registry,
    handle: (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader("referrer-policy", "no-referrer");
      handle(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) json(res, 500, { error: "internal error" });
        else res.destroy();
      });
    },
    attach(server: Server) {
      hub.attach(server);
    },
    close() {
      hub.close();
    },
  };
}
