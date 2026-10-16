import { describe, expect, it, vi } from "vitest";
import { Giphy } from "../server/giphy.ts";

function item(id: string, url = `https://media2.giphy.com/media/${id}/200w.webp`) {
  return { id, title: `t-${id}`, images: { fixed_width_small: { webp: url, url: url.replace(".webp", ".gif"), width: "200", height: "180" } } };
}

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async (_url: string) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response);
}

describe("giphy proxy", () => {
  it("searches stickers with a PG rating and the server-side key", async () => {
    const f = fakeFetch({ data: [item("a"), item("b")] });
    const g = new Giphy("KEY", f as unknown as typeof fetch);
    const res = await g.search("hola");
    expect(res.map((s) => s.id)).toEqual(["a", "b"]);
    const url = new URL(f.mock.calls[0]![0]);
    expect(url.pathname).toBe("/v1/stickers/search");
    expect(url.searchParams.get("rating")).toBe("pg");
    expect(url.searchParams.get("api_key")).toBe("KEY");
    expect(url.searchParams.get("q")).toBe("hola");
  });

  it("uses trending for an empty query", async () => {
    const f = fakeFetch({ data: [item("t")] });
    await new Giphy("KEY", f as unknown as typeof fetch).search("  ");
    expect(new URL(f.mock.calls[0]![0]).pathname).toBe("/v1/stickers/trending");
  });

  it("drops results whose media is not served by giphy over https", async () => {
    const f = fakeFetch({ data: [item("ok"), item("bad", "https://evil.example/x.webp"), item("http", "http://media.giphy.com/x.webp")] });
    const res = await new Giphy("KEY", f as unknown as typeof fetch).search("x");
    expect(res.map((s) => s.id)).toEqual(["ok"]);
  });

  it("resolves a sticker id from cache, else from the API", async () => {
    const f = fakeFetch({ data: [item("a")] });
    const g = new Giphy("KEY", f as unknown as typeof fetch);
    await g.search("x");
    expect((await g.resolve("a"))?.url).toBe("https://media2.giphy.com/media/a/200w.webp");
    expect(f).toHaveBeenCalledTimes(1);
    const f2 = fakeFetch({ data: item("z") });
    const g2 = new Giphy("KEY", f2 as unknown as typeof fetch);
    expect((await g2.resolve("z"))?.id).toBe("z");
    expect(new URL(f2.mock.calls[0]![0]).pathname).toBe("/v1/gifs/z");
  });

  it("rejects malformed ids without calling the API", async () => {
    const f = fakeFetch({});
    expect(await new Giphy("KEY", f as unknown as typeof fetch).resolve("../x")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
