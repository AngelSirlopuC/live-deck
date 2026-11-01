import { createHash, timingSafeEqual } from "node:crypto";
import type { Dirent } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join } from "node:path";
import { parseDeck, type Deck } from "../shared/deck.ts";
import { PRESET_NAMES, type PresetName } from "../shared/themes.ts";
import {
  EDITOR_ASSET_BODY_LIMIT,
  EDITOR_DECK_BODY_LIMIT,
  type AssetInfo,
  type AssetListResponse,
  type ConflictResponse,
  type CreateDeckResponse,
  type EditorDeckResponse,
  type InvalidDeckFileResponse,
  type SaveDeckResponse,
  type UploadAssetResponse,
} from "../shared/editor-api.ts";
import { DECK_ID, type DeckStore } from "./decks.ts";

export interface EditorRouteOptions {
  decks: DeckStore;
  /** Required in x-admin-key; null leaves the editor open (development). */
  adminKey: string | null;
  /** Trust X-Forwarded-Proto/Host when computing the request's own origin. */
  trustProxy: boolean;
  /** Extra origins allowed to mutate decks besides the request's own. */
  allowedOrigins: string[];
  json: (res: ServerResponse, status: number, body: unknown) => void;
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

class BodyTooLarge extends Error {}

/**
 * Buffers the request body up to `limit` bytes. Past the limit it keeps
 * draining the stream (discarding) so the 413 reply reaches the client
 * instead of the socket being torn down mid-upload.
 */
async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  let size = 0;
  let over = false;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (over) continue;
    if (size > limit) {
      over = true;
      chunks.length = 0;
      continue;
    }
    chunks.push(chunk as Buffer);
  }
  if (over) throw new BodyTooLarge("body too large");
  return Buffer.concat(chunks);
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const first = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : (v ?? "")).split(",")[0]!.trim();

/** Scheme + host the browser used to reach us (no loopback→LAN swap: this must match the browser's Origin). */
function ownOrigin(req: IncomingMessage, trustProxy: boolean): string {
  const h = req.headers;
  const proto = (trustProxy && first(h["x-forwarded-proto"])) || "http";
  const host = (trustProxy && first(h["x-forwarded-host"])) || first(h.host) || "localhost";
  return `${proto}://${host}`;
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const serialize = (deck: Deck) => Buffer.from(`${JSON.stringify(deck, null, 2)}\n`, "utf8");

export function sniffImage(bytes: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).equals(Buffer.from("GIF87a")) || bytes.subarray(0, 6).equals(Buffer.from("GIF89a")))) return "gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from("RIFF")) && bytes.subarray(8, 12).equals(Buffer.from("WEBP"))) return "webp";
  return null;
}

/** Lowercase [a-z0-9-] base name without extension, at most 40 chars, "image" when nothing survives. */
export function sanitizeAssetName(name: string): string {
  const file = name.split(/[\\/]/).pop() ?? "";
  const stem = file.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const clean = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return clean || "image";
}

export function createEditorRoutes(opts: EditorRouteOptions) {
  const { decks, json } = opts;

  // Saves of one deck run one at a time, so the revision check and the write act as one step.
  const queues = new Map<string, Promise<unknown>>();
  const serial = <T>(id: string, task: () => Promise<T>): Promise<T> => {
    const run = (queues.get(id) ?? Promise.resolve()).then(task, task);
    const tail = run.catch(() => {});
    queues.set(id, tail);
    void tail.then(() => {
      if (queues.get(id) === tail) queues.delete(id);
    });
    return run;
  };

  const authorized = (req: IncomingMessage) => !opts.adminKey || sameSecret(String(req.headers["x-admin-key"] ?? ""), opts.adminKey);

  const originAllowed = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (origin === undefined) return true;
    return origin === ownOrigin(req, opts.trustProxy) || opts.allowedOrigins.includes(origin);
  };

  /** Runs the shared gates for a mutating route; returns false after replying. */
  const gate = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (!authorized(req)) {
      json(res, 401, { error: "admin key required" });
      return false;
    }
    if (req.method !== "GET" && !originAllowed(req)) {
      json(res, 403, { error: "origin" });
      return false;
    }
    return true;
  };

  async function readJsonBody(req: IncomingMessage, res: ServerResponse, limit: number): Promise<unknown | undefined> {
    let bytes: Buffer;
    try {
      bytes = await readBody(req, limit);
    } catch (err) {
      json(res, err instanceof BodyTooLarge ? 413 : 400, { error: err instanceof BodyTooLarge ? "body too large" : "invalid body" });
      return undefined;
    }
    try {
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      json(res, 400, { error: "invalid json" });
      return undefined;
    }
  }

  async function getDeck(id: string, res: ServerResponse) {
    const raw = await decks.readRaw(id);
    if (raw === null) return json(res, 404, { error: "deck not found" });
    let parsed: ReturnType<typeof parseDeck>;
    try {
      parsed = parseDeck(JSON.parse(raw.toString("utf8")));
    } catch (err) {
      parsed = { ok: false, error: `invalid JSON: ${(err as Error).message}` };
    }
    if (!parsed.ok) {
      const body: InvalidDeckFileResponse = { error: parsed.error, raw: raw.toString("utf8") };
      return json(res, 422, body);
    }
    const body: EditorDeckResponse = { deck: parsed.deck, revision: sha256(raw) };
    return json(res, 200, body);
  }

  async function putDeck(id: string, req: IncomingMessage, res: ServerResponse) {
    const body = await readJsonBody(req, res, EDITOR_DECK_BODY_LIMIT);
    if (body === undefined) return;
    const { deck, revision } = (body ?? {}) as { deck?: unknown; revision?: unknown };
    if (typeof revision !== "string" || deck === undefined || deck === null) return json(res, 400, { error: "expected { deck, revision }" });
    return serial(id, async () => {
      const current = await decks.readRaw(id);
      if (current === null) return json(res, 404, { error: "deck not found" });
      const currentRevision = sha256(current);
      if (currentRevision !== revision) {
        const conflict: ConflictResponse = { error: "conflict", revision: currentRevision };
        return json(res, 409, conflict);
      }
      const parsed = parseDeck(deck);
      if (!parsed.ok) return json(res, 400, { error: parsed.error });
      const bytes = serialize(parsed.deck);
      await decks.writeAtomic(id, bytes);
      const saved: SaveDeckResponse = { revision: sha256(bytes) };
      return json(res, 200, saved);
    });
  }

  async function createDeck(req: IncomingMessage, res: ServerResponse) {
    const body = await readJsonBody(req, res, 4096);
    if (body === undefined) return;
    const { id, title, preset } = (body ?? {}) as { id?: unknown; title?: unknown; preset?: unknown };
    if (typeof id !== "string" || !DECK_ID.test(id)) return json(res, 400, { error: "invalid deck id" });
    if (typeof title !== "string" || !title.trim()) return json(res, 400, { error: "title is required" });
    if (preset !== undefined && !(PRESET_NAMES as readonly string[]).includes(preset as string)) return json(res, 400, { error: "unknown preset" });
    const parsed = parseDeck({ version: 1, title, theme: { preset: (preset as PresetName | undefined) ?? "estudio" }, slides: [{ id: "portada", elements: [] }] });
    if (!parsed.ok) return json(res, 400, { error: parsed.error });
    try {
      await mkdir(decks.deckDir(id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") return json(res, 409, { error: "deck already exists" });
      throw err;
    }
    await mkdir(decks.assetsDir(id), { recursive: true });
    const bytes = serialize(parsed.deck);
    await decks.writeAtomic(id, bytes);
    const created: CreateDeckResponse = { id, revision: sha256(bytes) };
    return json(res, 201, created);
  }

  async function listAssets(id: string, res: ServerResponse) {
    if ((await decks.readRaw(id)) === null) return json(res, 404, { error: "deck not found" });
    const dir = decks.assetsDir(id);
    const assets: AssetInfo[] = [];
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isFile() || !IMAGE_EXT.has(extname(entry.name).toLowerCase())) continue;
      assets.push({ name: entry.name, size: (await stat(join(dir, entry.name))).size });
    }
    assets.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const body: AssetListResponse = { assets };
    return json(res, 200, body);
  }

  async function uploadAsset(id: string, req: IncomingMessage, res: ServerResponse, url: URL) {
    if ((await decks.readRaw(id)) === null) return json(res, 404, { error: "deck not found" });
    let bytes: Buffer;
    try {
      bytes = await readBody(req, EDITOR_ASSET_BODY_LIMIT);
    } catch (err) {
      return json(res, err instanceof BodyTooLarge ? 413 : 400, { error: err instanceof BodyTooLarge ? "body too large" : "invalid body" });
    }
    const type = sniffImage(bytes);
    if (!type) return json(res, 415, { error: "only png, jpeg, webp or gif images" });
    const stem = sanitizeAssetName(url.searchParams.get("name") ?? "");
    const dir = decks.assetsDir(id);
    await mkdir(dir, { recursive: true });
    for (let n = 1; n < 1000; n++) {
      const name = `${stem}${n > 1 ? `-${n}` : ""}.${type}`;
      try {
        await writeFile(join(dir, name), bytes, { flag: "wx" });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw err;
      }
      const body: UploadAssetResponse = { src: `assets/${name}`, name, size: bytes.length };
      return json(res, 201, body);
    }
    return json(res, 409, { error: "too many assets with that name" });
  }

  /** Handles /api/editor/* requests; returns false when the URL is not an editor route. */
  async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const path = url.pathname;
    if (!path.startsWith("/api/editor/")) return false;

    if (path === "/api/editor/decks") {
      if (req.method !== "POST") return false;
      if (gate(req, res)) await createDeck(req, res);
      return true;
    }

    const m = /^\/api\/editor\/decks\/([^/]+)(\/assets)?$/.exec(path);
    if (!m) return false;
    const id = m[1]!;
    const assets = m[2] !== undefined;
    const method = req.method ?? "GET";
    if (!(assets ? ["GET", "POST"] : ["GET", "PUT"]).includes(method)) return false;
    if (!gate(req, res)) return true;
    if (!DECK_ID.test(id)) {
      json(res, 400, { error: "invalid deck id" });
      return true;
    }
    if (assets) {
      if (method === "GET") await listAssets(id, res);
      else await uploadAsset(id, req, res, url);
    } else if (method === "GET") await getDeck(id, res);
    else await putDeck(id, req, res);
    return true;
  }

  return { handle };
}
