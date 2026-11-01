// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EditorApi, uploadErrorMessage } from "../../web/src/editor/ui/api.ts";
import { fakeServer, memoryKeys } from "./helpers.ts";

describe("EditorApi", () => {
  it("uploads raw bytes with the file's content type and maps 413/415 to Spanish", async () => {
    const server = fakeServer();
    const api = new EditorApi(memoryKeys("k"), server.fetcher);
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const ok = await api.upload("prueba", file, "mi foto.png");
    expect(ok).toEqual({ kind: "ok", src: "assets/foto.png", name: "foto.png" });
    const call = server.calls[0]!;
    expect(call.url).toBe("/api/editor/decks/prueba/assets?name=mi%20foto.png");
    expect(call.headers["content-type"]).toBe("image/png");
    expect(call.headers["x-admin-key"]).toBe("k");

    server.respond(() => new Response(JSON.stringify({ error: "only png, jpeg, webp or gif images" }), { status: 415 }));
    expect(await api.upload("prueba", file, "x.svg")).toEqual({ kind: "error", message: "Solo se aceptan imágenes PNG, JPEG, WebP o GIF." });
    server.respond(() => new Response(JSON.stringify({ error: "body too large" }), { status: 413 }));
    expect(await api.upload("prueba", file, "x.png")).toEqual({ kind: "error", message: "La imagen pesa más de 8 MB." });
    expect(uploadErrorMessage(500, "boom")).toContain("boom");
  });

  it("lists assets and reports unauthorized", async () => {
    const server = fakeServer();
    const api = new EditorApi(memoryKeys(null), server.fetcher);
    expect(await api.listAssets("prueba")).toEqual({ kind: "ok", assets: [{ name: "foto.png", size: 10 }] });
    server.respond(() => new Response("{}", { status: 401 }));
    expect(await api.listAssets("prueba")).toEqual({ kind: "unauthorized" });
    expect(server.calls[0]?.headers["x-admin-key"]).toBeUndefined();
  });
});
