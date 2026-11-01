// Copy/paste of elements as a tagged JSON string, so the system clipboard
// (or an in-memory fallback) can carry them between slides and decks.
import type { Deck, DeckElement } from "../../../../shared/deck.ts";
import { applyCommand, DUPLICATE_OFFSET } from "./document.ts";

const KIND = "live-deck/elements";
const VERSION = 1;

export function serializeElements(elements: readonly DeckElement[]): string {
  return JSON.stringify({ kind: KIND, v: VERSION, elements });
}

/** Elements from a string produced by `serializeElements`, or undefined for anything else. */
export function parseClipboard(text: string): DeckElement[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const data = parsed as { kind?: unknown; v?: unknown; elements?: unknown };
  if (data.kind !== KIND || data.v !== VERSION || !Array.isArray(data.elements)) return undefined;
  const ok = data.elements.every((e: unknown) => !!e && typeof e === "object" && typeof (e as DeckElement).id === "string" && typeof (e as DeckElement).type === "string" && !!(e as DeckElement).box);
  return ok ? (data.elements as DeckElement[]) : undefined;
}

/** Pastes into `slide` with fresh ids and an offset; returns the same deck when the text is not ours. */
export function pasteFromClipboard(deck: Deck, slide: number, text: string, offset: number = DUPLICATE_OFFSET): Deck {
  const elements = parseClipboard(text);
  if (!elements || elements.length === 0) return deck;
  return applyCommand(deck, { type: "pasteElements", slide, elements, offset });
}
