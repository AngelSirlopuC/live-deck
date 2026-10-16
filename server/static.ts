import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

/** Resolves `relative` inside `root`, or null when it would escape the root. */
export function safeJoin(root: string, relative: string): string | null {
  const base = resolve(root);
  let decoded: string;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = resolve(base, normalize(join(".", decoded)));
  return target === base || target.startsWith(base + sep) ? target : null;
}

export async function sendFile(res: ServerResponse, path: string, cache = "no-cache"): Promise<boolean> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return false;
    res.writeHead(200, {
      "content-type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
      "content-length": info.size,
      "cache-control": cache,
      "x-content-type-options": "nosniff",
    });
    createReadStream(path).pipe(res);
    return true;
  } catch {
    return false;
  }
}

export function notFound(res: ServerResponse) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
}

/** Serves the built SPA: real files when present, index.html for app routes. */
export async function serveSpa(req: IncomingMessage, res: ServerResponse, distDir: string) {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  const file = safeJoin(distDir, path);
  const immutable = path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
  if (file && path !== "/" && (await sendFile(res, file, immutable))) return;
  if (!(await sendFile(res, join(distDir, "index.html")))) notFound(res);
}
