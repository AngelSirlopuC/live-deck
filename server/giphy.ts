import type { Sticker } from "../shared/protocol.ts";

const API = "https://api.giphy.com";
const ID = /^[A-Za-z0-9]{1,64}$/;
const CACHE_MAX = 2000;

interface GiphyImage {
  webp?: string;
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyItem {
  id?: string;
  title?: string;
  images?: { fixed_width_small?: GiphyImage; fixed_width?: GiphyImage };
}

function toSticker(item: GiphyItem): Sticker | null {
  const img = item.images?.fixed_width_small ?? item.images?.fixed_width;
  const url = img?.webp || img?.url;
  if (!item.id || !ID.test(item.id) || !url) return null;
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (host !== "giphy.com" && !host.endsWith(".giphy.com")) return null;
  return { id: item.id, url, width: Number(img?.width) || 200, height: Number(img?.height) || 200, title: (item.title ?? "").slice(0, 120) };
}

/**
 * Server-side GIPHY client: the API key never reaches browsers, results are
 * PG-rated stickers, and chat messages carry only ids that resolve here.
 */
export class Giphy {
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, Sticker>();

  constructor(key: string, fetchImpl: typeof fetch = fetch) {
    this.key = key;
    this.fetchImpl = fetchImpl;
  }

  async search(query: string, limit = 24): Promise<Sticker[]> {
    const q = query.trim().slice(0, 50);
    const url = new URL(q ? "/v1/stickers/search" : "/v1/stickers/trending", API);
    url.searchParams.set("api_key", this.key);
    url.searchParams.set("rating", "pg");
    url.searchParams.set("limit", String(limit));
    if (q) {
      url.searchParams.set("q", q);
      url.searchParams.set("lang", "es");
    }
    const body = await this.get(url);
    const items = Array.isArray(body?.data) ? (body.data as GiphyItem[]) : [];
    const stickers = items.map(toSticker).filter((s): s is Sticker => s !== null);
    for (const s of stickers) this.remember(s);
    return stickers;
  }

  async resolve(id: string): Promise<Sticker | null> {
    if (!ID.test(id)) return null;
    const hit = this.cache.get(id);
    if (hit) return hit;
    const url = new URL(`/v1/gifs/${id}`, API);
    url.searchParams.set("api_key", this.key);
    const body = await this.get(url);
    const sticker = body?.data && !Array.isArray(body.data) ? toSticker(body.data as GiphyItem) : null;
    if (sticker) this.remember(sticker);
    return sticker;
  }

  private remember(s: Sticker) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(s.id, s);
  }

  private async get(url: URL): Promise<{ data?: unknown } | null> {
    try {
      const res = await this.fetchImpl(url.toString(), { signal: AbortSignal.timeout(5000) } as RequestInit);
      if (!res.ok) return null;
      return (await res.json()) as { data?: unknown };
    } catch {
      return null;
    }
  }
}
