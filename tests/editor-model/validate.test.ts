import { describe, expect, it } from "vitest";
import { parseDeck } from "../../shared/deck.ts";
import { validateDeck } from "../../web/src/editor/model/validate.ts";
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

  it("flags an empty title and an empty text element, agreeing with parseDeck", () => {
    const d = { ...deck(), title: "" };
    expect(paths(d)).toEqual(["title"]);
    expect(parseDeck(d).ok).toBe(false);
    const empty = deck([slide("s", [text("a", box(0, 0, 0.1, 0.1), { text: "x".repeat(2001) })])]);
    expect(paths(empty)).toEqual(["slides.0.elements.0.text"]);
  });
});
