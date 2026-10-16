import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDeck, type Deck } from "../shared/deck.ts";

export const DECK_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export class DeckStore {
  private readonly root: string;
  constructor(root: string) {
    this.root = root;
  }

  /** Loads and validates decks/<id>/deck.json. Throws with a readable message. */
  async load(id: string): Promise<Deck> {
    if (!DECK_ID.test(id)) throw new Error(`invalid deck id "${id}"`);
    const raw = await readFile(join(this.root, id, "deck.json"), "utf8");
    const parsed = parseDeck(JSON.parse(raw));
    if (!parsed.ok) throw new Error(`deck "${id}" is invalid: ${parsed.error}`);
    return parsed.deck;
  }

  assetsDir(id: string): string {
    return join(this.root, id, "assets");
  }
}
