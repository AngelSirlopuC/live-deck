import { readFileSync } from "node:fs";
import type { Deck, DeckElement, Slide } from "../../shared/deck.ts";

export function demoDeck(): Deck {
  return JSON.parse(readFileSync(new URL("../../decks/demo/deck.json", import.meta.url), "utf8")) as Deck;
}

export function text(id: string, box: { x: number; y: number; w: number; h: number }, extra: Partial<Extract<DeckElement, { type: "text" }>> = {}): DeckElement {
  return { id, type: "text", box, text: id, ...extra };
}

export function slide(id: string, elements: DeckElement[] = [], extra: Partial<Slide> = {}): Slide {
  return { id, elements, ...extra };
}

export function deck(slides: Slide[] = [slide("s1")]): Deck {
  return { version: 1, title: "Test", theme: { background: "#000000", foreground: "#ffffff", accent: "#ff0000" }, slides };
}

export function slideAt(d: Deck, i: number): Slide {
  const s = d.slides[i];
  if (!s) throw new Error(`no slide ${i}`);
  return s;
}

export function el(d: Deck, slideIdx: number, id: string): DeckElement {
  const found = slideAt(d, slideIdx).elements.find((e) => e.id === id);
  if (!found) throw new Error(`no element ${id}`);
  return found;
}
