import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Deck, PublicDeck } from "../shared/deck.ts";
import type { AssetListResponse, ConflictResponse, EditorDeckResponse, SaveDeckResponse, UploadAssetResponse } from "../shared/editor-api.ts";
import { createApp } from "../server/app.ts";

const repoDecks = fileURLToPath(new URL("../decks", import.meta.url));
const KEY = "secret-admin";

let server: Server;
let app: ReturnType<typeof createApp>;
let base: string;
let decksDir: string;

beforeEach(async () => {
  decksDir = await mkdtemp(join(tmpdir(), "live-deck-editor-"));
  await cp(join(repoDecks, "demo"), join(decksDir, "demo"), { recursive: true });
  // Git does not keep empty folders, so a fresh clone may lack demo/assets.
  await mkdir(join(decksDir, "demo", "assets"), { recursive: true });
  app = createApp({ decksDir, distDir: null, adminKey: KEY, publicBaseUrl: null, trustProxy: false, allowedOrigins: [], lan: () => null });
  server = createServer(app.handle);
  app.attach(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  app.close();
  await new Promise((r) => server.close(r));
  await rm(decksDir, { recursive: true, force: true });
});

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const deckFile = (id: string) => join(decksDir, id, "deck.json");

const get = (path: string, headers: Record<string, string> = { "x-admin-key": KEY }) => fetch(`${base}${path}`, { headers });
const send = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", "x-admin-key": KEY, ...headers }, body: JSON.stringify(body) });
const upload = (id: string, name: string, bytes: Buffer, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/editor/decks/${id}/assets?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "x-admin-key": KEY, ...headers },
    body: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) as Uint8Array<ArrayBuffer>,
  });

async function loadDeck(id = "demo"): Promise<EditorDeckResponse> {
  const res = await get(`/api/editor/decks/${id}`);
  expect(res.status).toBe(200);
  return (await res.json()) as EditorDeckResponse;
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(32, 3)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x10, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(32, 4)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("GET /api/editor/decks/:id", () => {
  it("returns the full deck with notes and the file revision", async () => {
    const body = await loadDeck();
    const raw = await readFile(deckFile("demo"));
    expect(body.revision).toBe(sha(raw));
    expect(body.deck.title).toBe("Live Deck — demo");
    expect(body.deck.slides[0]?.notes).toMatch(/bienvenida/);
    const quiz = body.deck.slides.find((s) => s.quiz)?.quiz;
    expect(quiz?.correctIndex).toBeTypeOf("number");
  });

  it("requires the admin key", async () => {
    const res = await get("/api/editor/decks/demo", {});
    expect(res.status).toBe(401);
    const bad = await get("/api/editor/decks/demo", { "x-admin-key": "nope" });
    expect(bad.status).toBe(401);
  });

  it("404 for a missing deck and 400 for a bad id", async () => {
    expect((await get("/api/editor/decks/nope")).status).toBe(404);
    expect((await get("/api/editor/decks/Bad_Id")).status).toBe(400);
    expect((await get("/api/editor/decks/demo..")).status).toBe(400);
  });

  it("422 with the raw text when the file exists but is invalid", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(deckFile("demo"), '{"version": 1, "title": "x", "slides": []}\n');
    const res = await get("/api/editor/decks/demo");
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; raw: string };
    expect(body.error).toMatch(/slides/);
    expect(body.raw).toContain('"title": "x"');
  });
});

describe("PUT /api/editor/decks/:id", () => {
  it("saves a valid deck, pretty-printed, and returns the new revision", async () => {
    const { deck, revision } = await loadDeck();
    const edited: Deck = { ...deck, title: "Editada" };
    const res = await send("PUT", "/api/editor/decks/demo", { deck: edited, revision });
    expect(res.status).toBe(200);
    const saved = (await res.json()) as SaveDeckResponse;
    const bytes = await readFile(deckFile("demo"));
    expect(saved.revision).toBe(sha(bytes));
    expect(bytes.toString("utf8")).toBe(`${JSON.stringify(edited, null, 2)}\n`);
    const again = await loadDeck();
    expect(again.revision).toBe(saved.revision);
    expect(again.deck).toEqual(edited);
    expect((await readdir(join(decksDir, "demo"))).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("409 on a stale revision and leaves the file unchanged", async () => {
    const { deck, revision } = await loadDeck();
    const before = await readFile(deckFile("demo"));
    const res = await send("PUT", "/api/editor/decks/demo", { deck: { ...deck, title: "Stale" }, revision: "0".repeat(64) });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ConflictResponse;
    expect(body).toEqual({ error: "conflict", revision });
    expect((await readFile(deckFile("demo"))).equals(before)).toBe(true);
  });

  it("two saves with the same revision: one wins, the other gets 409", async () => {
    const { deck, revision } = await loadDeck();
    const [a, b] = await Promise.all([
      send("PUT", "/api/editor/decks/demo", { deck: { ...deck, title: "A" }, revision }),
      send("PUT", "/api/editor/decks/demo", { deck: { ...deck, title: "B" }, revision }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const saved = (await winner.json()) as SaveDeckResponse;
    expect(saved.revision).toBe(sha(await readFile(deckFile("demo"))));
  });

  it("400 on an invalid deck and leaves the file byte-identical", async () => {
    const { deck, revision } = await loadDeck();
    const before = await readFile(deckFile("demo"));
    const res = await send("PUT", "/api/editor/decks/demo", { deck: { ...deck, slides: [] }, revision });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/slides/);
    expect((await readFile(deckFile("demo"))).equals(before)).toBe(true);
    const bad = await send("PUT", "/api/editor/decks/demo", { revision });
    expect(bad.status).toBe(400);
  });

  it("413 on a body over 2 MB", async () => {
    const { deck, revision } = await loadDeck();
    const res = await send("PUT", "/api/editor/decks/demo", { deck: { ...deck, title: "x".repeat(2 * 1024 * 1024 + 10) }, revision });
    expect(res.status).toBe(413);
  });

  it("403 on a foreign Origin, 200 on own origin or an allowed one", async () => {
    const { deck, revision } = await loadDeck();
    const before = await readFile(deckFile("demo"));
    const foreign = await send("PUT", "/api/editor/decks/demo", { deck, revision }, { origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toEqual({ error: "origin" });
    expect((await readFile(deckFile("demo"))).equals(before)).toBe(true);
    const own = await send("PUT", "/api/editor/decks/demo", { deck, revision }, { origin: base });
    expect(own.status).toBe(200);
  });

  it("honors trustProxy forwarded headers and allowedOrigins", async () => {
    const proxied = createApp({ decksDir, distDir: null, adminKey: KEY, publicBaseUrl: null, trustProxy: true, allowedOrigins: ["https://cms.example"], lan: () => null });
    const srv = createServer(proxied.handle);
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/editor/decks/demo`;
    try {
      const { deck, revision } = await loadDeck();
      const put = (origin: string) =>
        fetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-admin-key": KEY, "x-forwarded-proto": "https", "x-forwarded-host": "deck.example.com", origin },
          body: JSON.stringify({ deck, revision }),
        });
      expect((await put("https://evil.example")).status).toBe(403);
      expect((await put("https://cms.example")).status).toBe(200);
      const r2 = ((await (await fetch(url, { headers: { "x-admin-key": KEY } })).json()) as EditorDeckResponse).revision;
      const own = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-admin-key": KEY, "x-forwarded-proto": "https", "x-forwarded-host": "deck.example.com", origin: "https://deck.example.com" },
        body: JSON.stringify({ deck, revision: r2 }),
      });
      expect(own.status).toBe(200);
    } finally {
      proxied.close();
      await new Promise((r) => srv.close(r));
    }
  });

  it("401 without key, 404 for a missing deck", async () => {
    expect((await fetch(`${base}/api/editor/decks/demo`, { method: "PUT", body: "{}" })).status).toBe(401);
    const { deck } = await loadDeck();
    expect((await send("PUT", "/api/editor/decks/nope", { deck, revision: "x" })).status).toBe(404);
  });
});

describe("POST /api/editor/decks", () => {
  it("creates a blank deck with one slide and the preset", async () => {
    const res = await send("POST", "/api/editor/decks", { id: "nuevo", title: "Nuevo", preset: "neon" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; revision: string };
    expect(body.id).toBe("nuevo");
    const bytes = await readFile(deckFile("nuevo"));
    expect(body.revision).toBe(sha(bytes));
    expect(JSON.parse(bytes.toString("utf8"))).toEqual({ version: 1, title: "Nuevo", theme: { preset: "neon" }, slides: [{ id: "portada", elements: [] }] });
    expect((await stat(join(decksDir, "nuevo", "assets"))).isDirectory()).toBe(true);
    const def = await send("POST", "/api/editor/decks", { id: "otro", title: "Otro" });
    expect(def.status).toBe(201);
    expect(JSON.parse(await readFile(deckFile("otro"), "utf8")).theme).toEqual({ preset: "estudio" });
  });

  it("409 when the deck exists, 400 on bad id, title or preset", async () => {
    expect((await send("POST", "/api/editor/decks", { id: "demo", title: "Dup" })).status).toBe(409);
    expect((await send("POST", "/api/editor/decks", { id: "Bad Id", title: "x" })).status).toBe(400);
    expect((await send("POST", "/api/editor/decks", { id: "ok", title: "" })).status).toBe(400);
    expect((await send("POST", "/api/editor/decks", { id: "ok", title: "x", preset: "nope" })).status).toBe(400);
    await expect(stat(join(decksDir, "ok"))).rejects.toThrow();
    expect((await send("POST", "/api/editor/decks", { id: "ok", title: "x" }, { origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("assets", () => {
  it("uploads a png and lists it", async () => {
    const res = await upload("demo", "Mi Foto.PNG", PNG);
    expect(res.status).toBe(201);
    const body = (await res.json()) as UploadAssetResponse;
    expect(body).toEqual({ src: "assets/mi-foto.png", name: "mi-foto.png", size: PNG.length });
    expect((await readFile(join(decksDir, "demo", "assets", "mi-foto.png"))).equals(PNG)).toBe(true);
    const list = await get("/api/editor/decks/demo/assets");
    expect(list.status).toBe(200);
    expect(((await list.json()) as AssetListResponse).assets).toEqual([{ name: "mi-foto.png", size: PNG.length }]);
    const served = await fetch(`${base}/decks/demo/assets/mi-foto.png`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
  });

  it("names come from the sniffed type and collisions get a suffix", async () => {
    expect(((await (await upload("demo", "a.png", JPEG)).json()) as UploadAssetResponse).name).toBe("a.jpg");
    expect(((await (await upload("demo", "a", JPEG)).json()) as UploadAssetResponse).name).toBe("a-2.jpg");
    expect(((await (await upload("demo", "a.jpg", JPEG)).json()) as UploadAssetResponse).name).toBe("a-3.jpg");
    expect(((await (await upload("demo", "../../etc/passwd", GIF)).json()) as UploadAssetResponse).name).toBe("passwd.gif");
    expect(((await (await upload("demo", "", WEBP)).json()) as UploadAssetResponse).name).toBe("image.webp");
    expect(((await (await upload("demo", "z".repeat(80), PNG)).json()) as UploadAssetResponse).name).toBe(`${"z".repeat(40)}.png`);
    const names = (await readdir(join(decksDir, "demo", "assets"))).sort();
    expect(names).toEqual(["a-2.jpg", "a-3.jpg", "a.jpg", "image.webp", "passwd.gif", `${"z".repeat(40)}.png`]);
  });

  it("415 on svg or text, 413 over 8 MB, 403 foreign origin, 401 without key", async () => {
    expect((await upload("demo", "x.svg", SVG)).status).toBe(415);
    expect((await upload("demo", "x.png", Buffer.from("hello"))).status).toBe(415);
    expect((await upload("demo", "x.png", Buffer.concat([PNG, Buffer.alloc(8 * 1024 * 1024)]))).status).toBe(413);
    expect((await upload("demo", "x.png", PNG, { origin: "https://evil.example" })).status).toBe(403);
    expect((await fetch(`${base}/api/editor/decks/demo/assets?name=x.png`, { method: "POST", body: PNG })).status).toBe(401);
    expect(await readdir(join(decksDir, "demo", "assets"))).toEqual([]);
  });

  it("lists an empty array when the folder is missing and 404 for a missing deck", async () => {
    await rm(join(decksDir, "demo", "assets"), { recursive: true });
    const list = await get("/api/editor/decks/demo/assets");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ assets: [] });
    expect((await get("/api/editor/decks/nope/assets")).status).toBe(404);
    expect((await upload("nope", "x.png", PNG)).status).toBe(404);
  });
});

describe("public deck route", () => {
  it("GET /api/decks/:id still returns the public projection without notes", async () => {
    const res = await fetch(`${base}/api/decks/demo`);
    expect(res.status).toBe(200);
    const deck = (await res.json()) as PublicDeck;
    expect(deck.slides.length).toBeGreaterThan(0);
    for (const slide of deck.slides) expect("notes" in slide).toBe(false);
  });
});
