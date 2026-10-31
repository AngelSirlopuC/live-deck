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
    expect(r.out).toMatch(/^OK Live Deck — demo \(7 slides, 2 quizzes, 1 open question\)$/m);
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

  it("warns but passes when the theme's text, muted or accent read low against the background", () => {
    const slide = textSlide("s1");
    slide.elements.push({ id: "qr", type: "qr", box: { x: 0.7, y: 0.1, w: 0.2, h: 0.3 } });
    const theme = { background: "#ffffff", foreground: "#777777", accent: "#ffff00", muted: "#999999" };
    const r = cli("validate", writeDeck("palido", { version: 1, title: "Pálido", theme, slides: [slide] }));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^OK Pálido/m);
    expect(r.err).toMatch(/^warning: theme\.foreground: contrast 4\.5:1 against the background is below 4\.5:1$/m);
    expect(r.err).toMatch(/^warning: theme\.muted: contrast 2\.8:1 against the background is below 3:1$/m);
    expect(r.err).toMatch(/^warning: theme\.accent: contrast 1\.1:1 against the background is below 3:1$/m);
    // Mode variants and the native brutalista accent (kept for parity) do not warn.
    for (const t of [{ preset: "brutalista" }, { preset: "corporativo", mode: "light" }, { preset: "papel", mode: "dark" }]) {
      const v = cli("validate", writeDeck(`ok-${t.preset}`, { version: 1, title: "Ok", theme: t, slides: [slide] }));
      expect(v.code).toBe(0);
      expect(v.err).not.toMatch(/warning: theme/);
    }
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
    // Without --preset the template keeps its plain colours, as before.
    expect(deck.theme).toEqual({ background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" });
    expect(deck.slides[0].elements.find((e: any) => e.id === "subtitle").style.color).toBe("muted");
    // No QR colours: the player always draws a scannable dark-on-light QR from the theme.
    expect(deck.slides[0].elements.find((e: any) => e.id === "qr").style).toBeUndefined();
  });

  it("scaffolds with --preset and --mode, letting the preset colour the template", () => {
    const r = cli("new", "papel-oscuro", "--title", "Papel", "--preset", "papel", "--mode", "dark");
    expect(r.code).toBe(0);
    const deck = JSON.parse(readFileSync(join(root, "papel-oscuro", "deck.json"), "utf8"));
    expect(deck.theme).toEqual({ preset: "papel", mode: "dark" });
    expect(deck.slides[0].elements.find((e: any) => e.id === "subtitle").style.color).toBeUndefined();
    const v = cli("validate", "papel-oscuro");
    expect(v.code).toBe(0);
    expect(v.all).not.toMatch(/warning/);

    expect(cli("new", "solo-preset", "--preset", "neon").code).toBe(0);
    expect(JSON.parse(readFileSync(join(root, "solo-preset", "deck.json"), "utf8")).theme).toEqual({ preset: "neon" });
    // --mode alone flips the default preset.
    expect(cli("new", "solo-modo", "--mode", "light").code).toBe(0);
    expect(JSON.parse(readFileSync(join(root, "solo-modo", "deck.json"), "utf8")).theme).toEqual({ preset: "estudio", mode: "light" });
  });

  it("rejects an unknown preset or mode with exit 2 and writes nothing", () => {
    const p = cli("new", "malo", "--preset", "vaporwave");
    expect(p.code).toBe(2);
    expect(p.err).toMatch(/^unknown preset "vaporwave": use one of estudio, editorial, neon, papel, brutalista, corporativo$/m);
    const m = cli("new", "malo", "--preset", "papel", "--mode", "dim");
    expect(m.code).toBe(2);
    expect(m.err).toMatch(/^unknown mode "dim": use light or dark$/m);
    expect(cli("new", "malo", "--preset").code).toBe(2);
    expect(cli("new", "malo", "--mode").code).toBe(2);
    expect(existsSync(join(root, "malo"))).toBe(false);
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
    expect(r.out).toMatch(/^demo\s+7 slides\s+Live Deck — demo$/m);
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

describe("live-deck publish", () => {
  let target: string;
  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), "live-deck-target-"));
  });
  afterEach(() => {
    rmSync(target, { recursive: true, force: true });
  });

  function publish(env: Record<string, string>, ...args: string[]) {
    const r = spawnSync(process.execPath, ["bin/live-deck.ts", "publish", ...args], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, DECKS_DIR: root, LIVE_DECK_PUBLISH_TARGET: "", LIVE_DECK_PUBLIC_URL: "", ...env },
    });
    return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
  }

  it("validates the deck and copies it to <target>/<id>, printing the event links", () => {
    cpSync(demoDir, join(root, "charla"), { recursive: true });
    const r = publish({ LIVE_DECK_PUBLISH_TARGET: target, LIVE_DECK_PUBLIC_URL: "https://events.example.com/" }, "charla");
    expect(r.code).toBe(0);
    expect(readFileSync(join(target, "charla", "deck.json"), "utf8")).toBe(readFileSync(join(root, "charla", "deck.json"), "utf8"));
    expect(r.out).toContain("https://events.example.com/preview/charla");
  });

  it("removes files deleted locally, only inside that deck", () => {
    cpSync(demoDir, join(root, "charla"), { recursive: true });
    mkdirSync(join(target, "charla"), { recursive: true });
    writeFileSync(join(target, "charla", "old.png"), "x");
    mkdirSync(join(target, "otro"), { recursive: true });
    writeFileSync(join(target, "otro", "deck.json"), "{}");
    expect(publish({ LIVE_DECK_PUBLISH_TARGET: target }, "charla").code).toBe(0);
    expect(existsSync(join(target, "charla", "old.png"))).toBe(false);
    expect(existsSync(join(target, "otro", "deck.json"))).toBe(true);
  });

  it("refuses an invalid deck and copies nothing", () => {
    writeDeck("roto", { version: 1, title: "x", slides: [] });
    const r = publish({ LIVE_DECK_PUBLISH_TARGET: target }, "roto");
    expect(r.code).toBe(1);
    expect(r.all).toMatch(/not published/);
    expect(readdirSync(target)).toEqual([]);
  });

  it("explains how to set the target when it is missing", () => {
    cpSync(demoDir, join(root, "charla"), { recursive: true });
    const r = publish({}, "charla");
    expect(r.code).toBe(2);
    expect(r.all).toMatch(/LIVE_DECK_PUBLISH_TARGET/);
  });

  it("refuses a missing or invalid deck id", () => {
    expect(publish({ LIVE_DECK_PUBLISH_TARGET: target }).code).toBe(2);
    expect(publish({ LIVE_DECK_PUBLISH_TARGET: target }, "../x").code).toBe(2);
  });

  // A stub rsync on PATH records the arguments publish passes to it.
  function rsyncArgsWith(env: Record<string, string>): string[] {
    const bin = mkdtempSync(join(tmpdir(), "live-deck-rsync-"));
    const log = join(bin, "args.txt");
    writeFileSync(join(bin, "rsync"), `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a" >> "${log}"; done\n`, { mode: 0o755 });
    cpSync(demoDir, join(root, "charla"), { recursive: true });
    const r = publish({ LIVE_DECK_PUBLISH_TARGET: target, PATH: `${bin}:${process.env.PATH}`, ...env }, "charla");
    expect(r.code).toBe(0);
    const args = readFileSync(log, "utf8").trim().split("\n");
    rmSync(bin, { recursive: true, force: true });
    return args;
  }

  it("runs the server's rsync through LIVE_DECK_PUBLISH_RSYNC_PATH, so files get the server user's owner", () => {
    expect(rsyncArgsWith({ LIVE_DECK_PUBLISH_RSYNC_PATH: "setpriv --reuid=1000 --regid=1000 --clear-groups rsync" })).toContain(
      "--rsync-path=setpriv --reuid=1000 --regid=1000 --clear-groups rsync",
    );
  });

  it("passes no --rsync-path when LIVE_DECK_PUBLISH_RSYNC_PATH is unset", () => {
    expect(rsyncArgsWith({ LIVE_DECK_PUBLISH_RSYNC_PATH: "" }).some((a) => a.startsWith("--rsync-path"))).toBe(false);
  });

  it("copies nothing with --dry-run", () => {
    cpSync(demoDir, join(root, "charla"), { recursive: true });
    const r = publish({ LIVE_DECK_PUBLISH_TARGET: target }, "charla", "--dry-run");
    expect(r.code).toBe(0);
    expect(readdirSync(target)).toEqual([]);
  });

  it("is listed in the usage text", () => {
    expect(cli("help").out).toMatch(/publish <id> \[--dry-run\]/);
  });
});
