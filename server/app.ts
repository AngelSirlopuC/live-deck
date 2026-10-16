import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { publicDeck } from "../shared/deck.ts";
import { DECK_ID, DeckStore } from "./decks.ts";
import { notFound, safeJoin, sendFile, serveSpa } from "./static.ts";

export interface AppOptions {
  decksDir: string;
  /** Built SPA directory; null in development (Vite serves the client). */
  distDir: string | null;
}

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export function createApp(opts: AppOptions) {
  const decks = new DeckStore(opts.decksDir);

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;

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
    handle: (req: IncomingMessage, res: ServerResponse) => {
      handle(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) json(res, 500, { error: "internal error" });
        else res.destroy();
      });
    },
    attach(_server: Server) {},
    close() {},
  };
}
