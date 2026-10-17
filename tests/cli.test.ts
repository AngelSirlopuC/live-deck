import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("..", import.meta.url));
const demoDir = join(repo, "decks", "demo");

let root: string;

function cli(...args: string[]) {
  const r = spawnSync(process.execPath, ["bin/live-deck.ts", ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, DECKS_DIR: root },
  });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
}

function writeDeck(id: string, deck: unknown): string {
  mkdirSync(join(root, id), { recursive: true });
  const file = join(root, id, "deck.json");
  writeFileSync(file, JSON.stringify(deck));
  return file;
}

function textSlide(id: string): any {
  return { id, notes: "n", elements: [{ id: "t", type: "text", box: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 }, text: "Hi" }] };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "live-deck-cli-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("live-deck validate", () => {
  it("accepts the demo deck by path", () => {
    const r = cli("validate", join(demoDir, "deck.json"));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^OK Live Deck — demo \(6 slides, 2 quizzes\)$/m);
  });

  it("accepts a deck id resolved under DECKS_DIR and a deck directory", () => {
    cpSync(demoDir, join(root, "demo"), { recursive: true });
    expect(cli("validate", "demo").code).toBe(0);
    expect(cli("validate", join(root, "demo")).code).toBe(0);
  });

  it("prints one issue per line and exits 1 on an invalid deck", () => {
    const slide = textSlide("s1");
    slide.elements.push({ ...slide.elements[0] });
    slide.elements[0].box = { x: 0.8, y: 0, w: 0.5, h: 0.2 };
    const file = writeDeck("bad", { version: 1, title: "Bad", slides: [slide] });
    const r = cli("validate", file);
    expect(r.code).toBe(1);
    expect(r.out).not.toMatch(/^OK/m);
    expect(r.all).toMatch(/^slides\.0\.elements\.0\.box: box must stay inside the canvas$/m);
    expect(r.all).toMatch(/^slides\.0\.elements: duplicate element id "t"$/m);
  });

  it("reports malformed JSON and exits 1", () => {
    mkdirSync(join(root, "broken"));
    writeFileSync(join(root, "broken", "deck.json"), "{ not json");
    const r = cli("validate", "broken");
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/invalid JSON/);
  });

  it("fails when an assets/ image is missing on disk", () => {
    const slide = { id: "s1", elements: [{ id: "q", type: "qr", box: { x: 0.6, y: 0.1, w: 0.3, h: 0.6 } }, { id: "img", type: "image", src: "assets/photo.png", alt: "Photo", box: { x: 0, y: 0, w: 0.5, h: 0.5 } }] };
    const file = writeDeck("img", { version: 1, title: "Img", slides: [slide] });
    const r = cli("validate", file);
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/^slides\.0\.elements\.1\.src: asset not found: assets\/photo\.png$/m);

    mkdirSync(join(root, "img", "assets"));
    writeFileSync(join(root, "img", "assets", "photo.png"), "x");
    expect(cli("validate", file).code).toBe(0);
  });

  it("fails when a slide background image is missing on disk", () => {
    const slide = { id: "s1", background: { image: "assets/slide-01.png" }, elements: [{ id: "q", type: "qr", box: { x: 0.6, y: 0.1, w: 0.3, h: 0.6 } }] };
    const file = writeDeck("bg", { version: 1, title: "Bg", theme: { preset: "estudio" }, slides: [slide] });
    const r = cli("validate", file);
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/^slides\.0\.background\.image: asset not found: assets\/slide-01\.png$/m);

    mkdirSync(join(root, "bg", "assets"));
    writeFileSync(join(root, "bg", "assets", "slide-01.png"), "x");
    expect(cli("validate", file).code).toBe(0);
  });

  it("warns but passes when slide 1 has no qr element", () => {
    const file = writeDeck("noqr", { version: 1, title: "No QR", slides: [textSlide("s1")] });
    const r = cli("validate", file);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^OK No QR \(1 slides, 0 quizzes\)$/m);
    expect(r.all).toMatch(/^warning: slides\.0: first slide has no qr element/m);
  });

  it("fails when the deck file does not exist", () => {
    const r = cli("validate", "missing");
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/not found/);
  });
});

describe("live-deck new", () => {
  it("scaffolds a deck that validates", () => {
    const r = cli("new", "mi-charla", "--title", "Mi charla");
    expect(r.code).toBe(0);
    const file = join(root, "mi-charla", "deck.json");
    expect(existsSync(file)).toBe(true);
    expect(existsSync(join(root, "mi-charla", "assets"))).toBe(true);
    const deck = JSON.parse(readFileSync(file, "utf8"));
    expect(deck.title).toBe("Mi charla");
    expect(deck.slides[0].elements.some((e: any) => e.type === "qr")).toBe(true);
    expect(deck.slides.some((s: any) => s.layout === "quiz")).toBe(true);
    const v = cli("validate", "mi-charla");
    expect(v.code).toBe(0);
    expect(v.all).not.toMatch(/warning/);
  });

  it("refuses to overwrite an existing deck", () => {
    writeDeck("taken", { keep: true });
    const r = cli("new", "taken");
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/already exists/);
    expect(JSON.parse(readFileSync(join(root, "taken", "deck.json"), "utf8"))).toEqual({ keep: true });
  });

  it("rejects an invalid deck id", () => {
    const r = cli("new", "Bad_ID");
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/invalid deck id/);
    expect(existsSync(join(root, "Bad_ID"))).toBe(false);
  });
});

describe("live-deck list", () => {
  it("lists decks with title and slide count and marks invalid ones", () => {
    cpSync(demoDir, join(root, "demo"), { recursive: true });
    writeDeck("rota", { version: 1, title: "Rota", slides: [] });
    const r = cli("list");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^demo\s+6 slides\s+Live Deck — demo$/m);
    expect(r.out).toMatch(/^rota\s+INVALID/m);
  });
});

describe("live-deck usage", () => {
  it("prints usage with no args and help", () => {
    for (const args of [[], ["help"]]) {
      const r = cli(...args);
      expect(r.code).toBe(0);
      expect(r.out).toMatch(/Usage: live-deck/);
    }
  });

  it("exits 2 on an unknown command", () => {
    const r = cli("frobnicate");
    expect(r.code).toBe(2);
    expect(r.all).toMatch(/Usage: live-deck/);
  });
});

describe("live-deck import", () => {
  // Minimal PNG: signature + IHDR is all the importer reads.
  function png(w: number, h: number): Buffer {
    const b = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    return b;
  }

  function folder(files: Record<string, Buffer | string>): string {
    const dir = join(root, "..", `${root.split("/").pop()}-src`);
    mkdirSync(dir, { recursive: true });
    for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), data);
    return dir;
  }

  let src: string | undefined;
  afterEach(() => {
    if (src) rmSync(src, { recursive: true, force: true });
    src = undefined;
  });

  it("copies images in natural order and writes a deck that validates", () => {
    src = folder({
      "Slide10.PNG": png(1920, 1080),
      "Slide2.png": png(1920, 1080),
      "Slide1.jpg": png(1920, 1080),
      ".hidden.png": png(1920, 1080),
      "notes.txt": "ignore me",
    });
    const r = cli("import", src, "--id", "charla", "--title", "Mi charla");
    expect(r.code).toBe(0);
    const deckDir = join(root, "charla");
    expect(readdirSync(join(deckDir, "assets")).sort()).toEqual(["slide-01.jpg", "slide-02.png", "slide-03.png"]);
    expect(readFileSync(join(deckDir, "assets", "slide-03.png"))).toEqual(png(1920, 1080));
    const deck = JSON.parse(readFileSync(join(deckDir, "deck.json"), "utf8"));
    expect(deck).toEqual({
      version: 1,
      title: "Mi charla",
      theme: { preset: "estudio" },
      slides: [
        {
          id: "s01",
          background: { image: "assets/slide-01.jpg" },
          elements: [{ id: "qr", type: "qr", box: { x: 0.81, y: 0.66, w: 0.16, h: 0.3 }, style: { background: "#ffffff", color: "#0a0a0a" } }],
          notes: "",
        },
        { id: "s02", background: { image: "assets/slide-02.png" }, elements: [], notes: "" },
        { id: "s03", background: { image: "assets/slide-03.png" }, elements: [], notes: "" },
      ],
    });
    expect(r.out).toContain(join(deckDir, "deck.json"));
    expect(r.out).toMatch(/3 slides/);
    expect(r.out).toContain("/preview/charla");
    expect(r.out).toMatch(/add speaker notes and quizzes with the live-deck skill/);
    expect(r.all).not.toMatch(/warning/);
    const v = cli("validate", "charla");
    expect(v.code).toBe(0);
    expect(v.all).not.toMatch(/warning/);
  });

  it("defaults the title to the folder name", () => {
    src = folder({ "a.png": png(1920, 1080) });
    expect(cli("import", src, "--id", "t").code).toBe(0);
    const deck = JSON.parse(readFileSync(join(root, "t", "deck.json"), "utf8"));
    expect(deck.title).toBe(src.split("/").pop());
  });

  it("warns about images that are not 16:9 or have unreadable headers, and still succeeds", () => {
    src = folder({ "1.png": png(1920, 1080), "2.png": png(1024, 768), "3.webp": "garbage" });
    const r = cli("import", src, "--id", "mixed");
    expect(r.code).toBe(0);
    expect(r.all).toMatch(/^warning: 2\.png is 1024x768, not 16:9; it will be letterboxed$/m);
    expect(r.all).toMatch(/^warning: 3\.webp: .*/m);
    expect(r.all).not.toMatch(/1\.png/);
    expect(existsSync(join(root, "mixed", "assets", "slide-03.webp"))).toBe(true);
  });

  it("pads slide numbers to three digits beyond 99 images", () => {
    const files: Record<string, Buffer> = {};
    for (let i = 1; i <= 100; i++) files[`s${i}.png`] = png(1920, 1080);
    src = folder(files);
    expect(cli("import", src, "--id", "big").code).toBe(0);
    const deck = JSON.parse(readFileSync(join(root, "big", "deck.json"), "utf8"));
    expect(deck.slides[0].background.image).toBe("assets/slide-001.png");
    expect(deck.slides[99].id).toBe("s100");
    expect(deck.slides[99].background.image).toBe("assets/slide-100.png");
  });

  const refusals: [string, () => string[], RegExp][] = [
    ["an existing deck id", () => { writeDeck("taken", { keep: true }); src = folder({ "a.png": png(1920, 1080) }); return [src, "--id", "taken"]; }, /already exists/],
    ["an invalid deck id", () => { src = folder({ "a.png": png(1920, 1080) }); return [src, "--id", "Bad_ID"]; }, /invalid deck id/],
    ["a missing folder", () => [join(root, "nope"), "--id", "x"], /folder not found/],
    ["a folder with no supported images", () => { src = folder({ "a.gif": "x", "b.txt": "y" }); return [src, "--id", "x"]; }, /no supported images/],
    ["more than 200 images", () => {
      const files: Record<string, Buffer> = {};
      for (let i = 1; i <= 201; i++) files[`s${i}.png`] = png(1920, 1080);
      src = folder(files);
      return [src, "--id", "x"];
    }, /201 images.*at most 200/],
  ];
  for (const [name, setup, message] of refusals) {
    it(`refuses ${name} with exit 1 and writes nothing`, () => {
      const args = setup();
      const before = readdirSync(root).sort();
      const r = cli("import", ...args);
      expect(r.code).toBe(1);
      expect(r.err).toMatch(message);
      expect(readdirSync(root).sort()).toEqual(before);
      if (existsSync(join(root, "taken"))) expect(JSON.parse(readFileSync(join(root, "taken", "deck.json"), "utf8"))).toEqual({ keep: true });
    });
  }

  it("exits 2 when the folder or --id is missing", () => {
    expect(cli("import").code).toBe(2);
    expect(cli("import", root).code).toBe(2);
  });

  it("lists import in the usage text", () => {
    expect(cli("help").out).toMatch(/import <folder> --id <id> \[--title "\.\.\."\]/);
  });
});
