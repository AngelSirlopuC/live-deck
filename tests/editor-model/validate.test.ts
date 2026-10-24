import { describe, expect, it } from "vitest";
import { parseDeck, type Deck } from "../../shared/deck.ts";
import { contrastWarnings, validateDeck } from "../../web/src/editor/model/validate.ts";
import { deck, demoDeck, slide, text } from "./fixtures.ts";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const paths = (d: Parameters<typeof validateDeck>[0]) => validateDeck(d).map((i) => i.path);

describe("validateDeck", () => {
  it("passes the demo deck and a minimal deck", () => {
    expect(validateDeck(demoDeck())).toEqual([]);
    expect(validateDeck(deck())).toEqual([]);
  });

  it("flags duplicate slide ids and element ids, with Spanish messages", () => {
    const d = deck([slide("a"), slide("a", [text("x", box(0, 0, 0.1, 0.1)), text("x", box(0, 0, 0.1, 0.1))])]);
    const issues = validateDeck(d);
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(["slides.1.id", "slides.1.elements.1.id"]));
    expect(issues.every((i) => /id/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /repetid/i.test(i.message))).toBe(true);
  });

  it("flags too many elements and boxes outside the canvas", () => {
    const many = deck([slide("s", Array.from({ length: 61 }, (_, i) => text(`t${i}`, box(0, 0, 0.1, 0.1))))]);
    expect(paths(many)).toContain("slides.0.elements");
    const out = deck([slide("s", [text("a", box(0.9, 0, 0.2, 0.1)), text("b", box(0, -0.1, 0.1, 0.1))])]);
    expect(paths(out)).toEqual(["slides.0.elements.0.box", "slides.0.elements.1.box"]);
  });

  it("flags quiz rules: 2..6 options, non-empty strings, correctIndex in range, question", () => {
    const d = deck([slide("q", [], { layout: "quiz", quiz: { question: "", options: ["a"], correctIndex: 3, display: "live" } })]);
    const p = paths(d);
    expect(p).toContain("slides.0.quiz.question");
    expect(p).toContain("slides.0.quiz.options");
    expect(p).toContain("slides.0.quiz.correctIndex");
    const blank = deck([slide("q", [], { layout: "quiz", quiz: { question: "Q", options: ["a", " "], correctIndex: 0, display: "live" } })]);
    expect(paths(blank)).toEqual(["slides.0.quiz.options.1"]);
  });

  it("flags layout/field mismatches and an empty ask question", () => {
    expect(paths(deck([slide("q", [], { layout: "quiz" })]))).toEqual(["slides.0.quiz"]);
    expect(paths(deck([slide("q", [], { layout: "ask", ask: { question: "   " } })]))).toEqual(["slides.0.ask.question"]);
    expect(paths(deck([slide("q", [], { ask: { question: "x" } })]))).toEqual(["slides.0.layout"]);
  });

  it("flags missing theme colours without a preset and bad hex", () => {
    const d = { ...deck(), theme: { background: "#000", foreground: "zzz" } };
    expect(paths(d)).toEqual(["theme.foreground", "theme.accent"]);
    expect(paths({ ...deck(), theme: { preset: "neon" } })).toEqual([]);
  });

  it("mirrors the zod limits of mode, fonts, card, heading, art, pattern and palette, agreeing with parseDeck", () => {
    const ok = {
      ...deck(),
      theme: {
        preset: "papel" as const,
        mode: "dark" as const,
        fonts: { display: "Fraunces" as const, body: "Lora" as const },
        card: { radius: 64, border: "thick" as const, shadow: "hard" as const },
        heading: { weight: 900 as const, uppercase: true, tracking: 0.2 },
        art: { kind: "gradient" as const, from: "#112233", to: "#445566", angle: 360 },
        pattern: "dots" as const,
        palette: ["#111111", "#222222", "#333333"],
      },
    };
    expect(paths(ok)).toEqual([]);
    expect(parseDeck(ok).ok).toBe(true);
    const bad = {
      ...deck(),
      theme: {
        preset: "papel",
        mode: "dim",
        fonts: { display: "Comic Sans", body: "Lora" },
        card: { radius: 65, border: "dotted", shadow: "soft" },
        heading: { weight: 450, uppercase: true, tracking: 0.3 },
        art: { kind: "gradient", from: "red", angle: 361 },
        pattern: "stripes",
        palette: ["#111111", "#222222"],
      },
    } as unknown as Deck;
    const issues = validateDeck(bad);
    expect(issues.map((i) => i.path)).toEqual([
      "theme.mode",
      "theme.fonts.display",
      "theme.card.radius",
      "theme.card.border",
      "theme.heading.weight",
      "theme.heading.tracking",
      "theme.art.from",
      "theme.art.angle",
      "theme.pattern",
      "theme.palette",
    ]);
    expect(issues.every((i) => /[a-záéíóúñ]/i.test(i.message) && !/must|invalid/i.test(i.message))).toBe(true);
    expect(parseDeck(bad).ok).toBe(false);
    expect(paths({ ...deck(), theme: { ...deck().theme, art: { kind: "glow" }, palette: Array.from({ length: 9 }, () => "#123456") } } as Deck)).toEqual(["theme.palette"]);
    expect(paths({ ...deck(), theme: { ...deck().theme, art: {} } } as unknown as Deck)).toEqual(["theme.art.kind"]);
    expect(paths({ ...deck(), theme: { ...deck().theme, palette: ["#111111", "#222222", "zzz"] } } as Deck)).toEqual(["theme.palette.2"]);
  });
});

describe("contrastWarnings", () => {
  it("warns below 4.5:1 for text, 3:1 for muted and accent, against the resolved background", () => {
    expect(contrastWarnings({ preset: "estudio" })).toEqual([]);
    expect(contrastWarnings({ preset: "corporativo", mode: "light" })).toEqual([]);
    const low = contrastWarnings({ background: "#ffffff", foreground: "#777777", accent: "#ffff00", muted: "#999999" });
    expect(low.map((w) => [w.key, w.min])).toEqual([
      ["foreground", 4.5],
      ["muted", 3],
      ["accent", 3],
    ]);
    expect(low[0]?.ratio).toBeCloseTo(4.48, 2);
    expect(contrastWarnings({ background: "#ffffff", foreground: "#000000", accent: "#0000ff", muted: "#666666" })).toEqual([]);
  });

  it("exempts native brutalista's own accent but not an overridden accent or background", () => {
    expect(contrastWarnings({ preset: "brutalista" })).toEqual([]);
    expect(contrastWarnings({ preset: "brutalista", mode: "light" })).toEqual([]);
    expect(contrastWarnings({ preset: "brutalista", mode: "dark" })).toEqual([]);
    expect(contrastWarnings({ preset: "brutalista", accent: "#fff2a0" }).map((w) => w.key)).toEqual(["accent"]);
    expect(contrastWarnings({ preset: "brutalista", background: "#fffbe0" }).map((w) => w.key)).toEqual(["accent"]);
  });

  it("flags an empty title and an empty text element, agreeing with parseDeck", () => {
    const d = { ...deck(), title: "" };
    expect(paths(d)).toEqual(["title"]);
    expect(parseDeck(d).ok).toBe(false);
    const empty = deck([slide("s", [text("a", box(0, 0, 0.1, 0.1), { text: "x".repeat(2001) })])]);
    expect(paths(empty)).toEqual(["slides.0.elements.0.text"]);
  });
});
