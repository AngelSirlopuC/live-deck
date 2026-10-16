import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck, publicDeck, slideSteps } from "../shared/deck.ts";

const demo = JSON.parse(readFileSync(new URL("../decks/demo/deck.json", import.meta.url), "utf8"));

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
});
