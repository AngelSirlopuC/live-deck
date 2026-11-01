import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck, publicDeck, slideSteps } from "../shared/deck.ts";

const demo = JSON.parse(readFileSync(new URL("../decks/demo/deck.json", import.meta.url), "utf8"));
const guide = JSON.parse(readFileSync(new URL("../decks/como-crear-una-presentacion/deck.json", import.meta.url), "utf8"));

function minimal(): any {
  return {
    version: 1,
    title: "T",
    slides: [{ id: "s1", elements: [{ id: "e1", type: "text", box: { x: 0, y: 0, w: 1, h: 1 }, text: "Hi" }] }],
  };
}

describe("deck schema", () => {
  it("accepts the sample deck", () => {
    const result = parseDeck(demo);
    expect(result.ok).toBe(true);
  });

  it("rejects a deck without version", () => {
    const deck = minimal();
    delete deck.version;
    expect(parseDeck(deck).ok).toBe(false);
  });

  it("rejects a quiz whose correctIndex is out of range", () => {
    const deck = minimal();
    deck.slides[0].layout = "quiz";
    deck.slides[0].quiz = { question: "Q?", options: ["a", "b"], correctIndex: 2, display: "live" };
    const result = parseDeck(deck);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("correctIndex");
  });

  it("rejects a quiz layout without a quiz", () => {
    const deck = minimal();
    deck.slides[0].layout = "quiz";
    expect(parseDeck(deck).ok).toBe(false);
  });

  it("accepts an open-question slide with or without a limit", () => {
    const deck = minimal();
    deck.slides[0].layout = "ask";
    deck.slides[0].ask = { question: "¿Qué palabra describe tu semana?" };
    expect(parseDeck(deck).ok).toBe(true);
    deck.slides[0].ask.maxChars = 25;
    expect(parseDeck(deck).ok).toBe(true);
  });

  it("ties the ask layout to an ask, both ways", () => {
    const noAsk = minimal();
    noAsk.slides[0].layout = "ask";
    const r1 = parseDeck(noAsk);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toContain("ask layout requires an ask");
    const noLayout = minimal();
    noLayout.slides[0].ask = { question: "Q" };
    const r2 = parseDeck(noLayout);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain("an ask requires layout");
  });

  it("rejects an open question that is empty, too long, or with a limit out of 10 to 100", () => {
    for (const ask of [{ question: "" }, { question: "   " }, { question: "x".repeat(201) }, { question: "Q", maxChars: 9 }, { question: "Q", maxChars: 101 }, { question: "Q", maxChars: 20.5 }, { question: "Q", extra: 1 }]) {
      const deck = minimal();
      deck.slides[0].layout = "ask";
      deck.slides[0].ask = ask;
      expect(parseDeck(deck).ok).toBe(false);
    }
  });

  it("rejects duplicate element ids within a slide", () => {
    const deck = minimal();
    deck.slides[0].elements.push({ ...deck.slides[0].elements[0] });
    const result = parseDeck(deck);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate");
  });

  it("rejects duplicate slide ids", () => {
    const deck = minimal();
    deck.slides.push(structuredClone(deck.slides[0]));
    expect(parseDeck(deck).ok).toBe(false);
  });

  it("rejects image sources that escape the deck assets", () => {
    const deck = minimal();
    deck.slides[0].elements[0] = { id: "i", type: "image", box: { x: 0, y: 0, w: 1, h: 1 }, src: "assets/../../secret", alt: "" };
    expect(parseDeck(deck).ok).toBe(false);
    deck.slides[0].elements[0].src = "javascript:alert(1)";
    expect(parseDeck(deck).ok).toBe(false);
  });

  it("rejects boxes outside the normalized canvas", () => {
    const deck = minimal();
    deck.slides[0].elements[0].box = { x: 0.5, y: 0, w: 0.6, h: 1 };
    expect(parseDeck(deck).ok).toBe(false);
  });

  it("counts fragment steps per slide", () => {
    const deck = minimal();
    deck.slides[0].elements.push({ id: "e2", type: "text", box: { x: 0, y: 0, w: 1, h: 1 }, text: "x", fragment: 2 });
    const parsed = parseDeck(deck);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(slideSteps(parsed.deck.slides[0]!)).toBe(2);
    expect(slideSteps(minimal().slides[0])).toBe(0);
  });
});

describe("rich deck format", () => {
  const box = { x: 0, y: 0, w: 0.5, h: 0.5 };
  const withElement = (el: any) => {
    const deck = minimal();
    deck.slides[0].elements.push({ id: "x", box, ...el });
    return parseDeck(deck);
  };
  const errorOf = (r: ReturnType<typeof parseDeck>) => (r.ok ? "" : r.error);

  it("still accepts both existing decks", () => {
    expect(parseDeck(demo).ok).toBe(true);
    expect(parseDeck(guide).ok).toBe(true);
  });

  it("makes theme colours optional overrides when a preset is chosen", () => {
    const deck = minimal();
    deck.theme = { preset: "editorial" };
    expect(parseDeck(deck).ok).toBe(true);
    deck.theme = { preset: "neon", accent: "#00ffaa", surface: "#111111" };
    expect(parseDeck(deck).ok).toBe(true);
  });

  it("keeps background, foreground and accent required without a preset", () => {
    const deck = minimal();
    deck.theme = { foreground: "#ffffff", accent: "#ff0000" };
    const result = parseDeck(deck);
    expect(result.ok).toBe(false);
    expect(errorOf(result)).toContain("theme.background");
    deck.theme = { background: "#000000", foreground: "#ffffff", accent: "#ff0000" };
    expect(parseDeck(deck).ok).toBe(true);
  });

  it("rejects unknown presets and non-hex surfaces", () => {
    const deck = minimal();
    deck.theme = { preset: "vaporwave" };
    expect(parseDeck(deck).ok).toBe(false);
    deck.theme = { preset: "papel", surface: "red" };
    expect(parseDeck(deck).ok).toBe(false);
  });

  it("accepts slide backgrounds as hex or as an object of layers", () => {
    const deck = minimal();
    for (const background of [
      "#123456",
      { color: "#000000" },
      { gradient: { from: "#000000", to: "#ffffff", angle: 135 } },
      { image: "assets/bg.jpg", dim: 0.5 },
      { image: "https://example.com/a.png", pattern: "noise" },
      { pattern: "dots" },
    ]) {
      deck.slides[0].background = background;
      expect(parseDeck(deck).ok, JSON.stringify(background)).toBe(true);
    }
  });

  it("rejects unsafe or out-of-range slide backgrounds", () => {
    const deck = minimal();
    for (const background of [
      {},
      { image: "assets/../secret.png" },
      { image: "http://example.com/a.png" },
      { color: "red" },
      { gradient: { from: "#000000", to: "#ffffff", angle: 400 } },
      { gradient: { from: "#000000" } },
      { color: "#000000", dim: 0.95 },
      { pattern: "stripes" },
      { color: "#000000", html: "<b>" },
    ]) {
      deck.slides[0].background = background;
      expect(parseDeck(deck).ok, JSON.stringify(background)).toBe(false);
    }
  });

  it("accepts the new text style flags within range", () => {
    expect(withElement({ type: "text", text: "a", style: { card: true, uppercase: true, tracking: 0.2, mark: true } }).ok).toBe(true);
    expect(withElement({ type: "text", text: "a", style: { tracking: -0.06 } }).ok).toBe(false);
    expect(withElement({ type: "text", text: "a", style: { tracking: 0.31 } }).ok).toBe(false);
  });

  it("accepts curated icon names and rejects anything else", () => {
    expect(withElement({ type: "icon", name: "rocket", style: { color: "#ffffff", background: "#000000", strokeWidth: 1.5, radius: 24 } }).ok).toBe(true);
    expect(withElement({ type: "icon", name: "bar-chart-3" }).ok).toBe(true);
    expect(withElement({ type: "icon", name: "not-an-icon" }).ok).toBe(false);
    expect(withElement({ type: "icon", name: "Rocket" }).ok).toBe(false);
    expect(withElement({ type: "icon", name: "rocket", style: { strokeWidth: 4 } }).ok).toBe(false);
  });

  it("limits chart data per kind", () => {
    const data = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, value: i }));
    expect(withElement({ type: "chart", kind: "bar", data: data(1) }).ok).toBe(true);
    expect(withElement({ type: "chart", kind: "bar", data: data(8), unit: "%" }).ok).toBe(true);
    expect(errorOf(withElement({ type: "chart", kind: "bar", data: data(9) }))).toContain("data");
    expect(withElement({ type: "chart", kind: "bar", data: [] }).ok).toBe(false);
    expect(withElement({ type: "chart", kind: "donut", data: data(2) }).ok).toBe(true);
    expect(withElement({ type: "chart", kind: "donut", data: data(6) }).ok).toBe(true);
    expect(errorOf(withElement({ type: "chart", kind: "donut", data: data(1) }))).toContain("data");
    expect(withElement({ type: "chart", kind: "donut", data: data(7) }).ok).toBe(false);
    expect(withElement({ type: "chart", kind: "pie", data: data(3) }).ok).toBe(false);
    expect(withElement({ type: "chart", kind: "bar", data: [{ label: "a", value: -1 }] }).ok).toBe(false);
    expect(withElement({ type: "chart", kind: "bar", data: [{ label: "x".repeat(41), value: 1 }] }).ok).toBe(false);
    expect(withElement({ type: "chart", kind: "bar", data: data(2), unit: "123456789" }).ok).toBe(false);
  });

  it("accepts built-in decor shapes only", () => {
    for (const shape of ["blob", "wave", "dots", "rings", "arc", "squiggle", "star", "grid"]) {
      expect(withElement({ type: "decor", shape, style: { color: "#ff0000", opacity: 0.3 } }).ok, shape).toBe(true);
    }
    expect(withElement({ type: "decor", shape: "svg" }).ok).toBe(false);
    expect(withElement({ type: "decor", shape: "blob", svg: "<svg/>" }).ok).toBe(false);
    expect(withElement({ type: "decor", shape: "blob", style: { opacity: 0.01 } }).ok).toBe(false);
  });
});

describe("publicDeck", () => {
  it("removes speaker notes and quiz answers", () => {
    const parsed = parseDeck(demo);
    if (!parsed.ok) throw new Error(parsed.error);
    const pub = publicDeck(parsed.deck);
    const json = JSON.stringify(pub);
    expect(json).not.toContain("correctIndex");
    expect(json).not.toContain("notes");
    expect(pub.slides).toHaveLength(parsed.deck.slides.length);
    expect(pub.slides.find((s) => s.quiz)?.quiz?.options.length).toBeGreaterThan(1);
  });

  it("keeps open questions so the audience can answer them", () => {
    const parsed = parseDeck(demo);
    if (!parsed.ok) throw new Error(parsed.error);
    const ask = publicDeck(parsed.deck).slides.find((s) => s.layout === "ask");
    expect(ask?.ask).toEqual({ question: "¿Qué palabra describe tu semana?" });
  });
});

describe("zone quizzes", () => {
  const zones = [
    { x: 0.05, y: 0.5, w: 0.4, h: 0.2 },
    { x: 0.55, y: 0.5, w: 0.4, h: 0.2 },
  ];
  function zoneDeck(quiz: Record<string, unknown>): any {
    const deck = minimal();
    deck.slides[0].layout = "quiz";
    deck.slides[0].background = { image: "assets/slide-01.png" };
    deck.slides[0].elements = [];
    deck.slides[0].quiz = { question: "Q?", options: ["a", "b"], correctIndex: 1, display: "live", ...quiz };
    return deck;
  }

  it("accepts one zone per option on an image slide", () => {
    const result = parseDeck(zoneDeck({ zones }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.deck.slides[0]!.quiz!.zones).toEqual(zones);
  });

  it("keeps quizzes without zones valid", () => {
    expect(parseDeck(zoneDeck({})).ok).toBe(true);
  });

  it("rejects a zone count that differs from the option count", () => {
    const result = parseDeck(zoneDeck({ zones: [zones[0]] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("quiz.zones");
    const three = parseDeck(zoneDeck({ zones: [...zones, zones[0]] }));
    expect(three.ok).toBe(false);
    if (!three.ok) expect(three.error).toContain("quiz.zones");
  });

  it("rejects zones outside the canvas or out of range", () => {
    const outside = parseDeck(zoneDeck({ zones: [zones[0], { x: 0.7, y: 0.5, w: 0.4, h: 0.2 }] }));
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.error).toContain("inside the canvas");
    expect(parseDeck(zoneDeck({ zones: [zones[0], { x: -0.1, y: 0.5, w: 0.4, h: 0.2 }] })).ok).toBe(false);
    expect(parseDeck(zoneDeck({ zones: [zones[0], { x: 0.1, y: 0.5, w: 0.4 }] })).ok).toBe(false);
    expect(parseDeck(zoneDeck({ zones: [zones[0], { ...zones[1], html: "<b>" }] })).ok).toBe(false);
  });

  it("publicDeck keeps zones and drops correctIndex", () => {
    const parsed = parseDeck(zoneDeck({ zones }));
    if (!parsed.ok) throw new Error(parsed.error);
    const quiz = publicDeck(parsed.deck).slides[0]!.quiz!;
    expect(quiz.zones).toEqual(zones);
    expect(JSON.stringify(quiz)).not.toContain("correctIndex");
  });
});
