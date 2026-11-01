import { randomBytes } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDeck, type Deck } from "../shared/deck.ts";

export const DECK_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export class DeckStore {
  private readonly root: string;
  constructor(root: string) {
    this.root = root;
  }

  deckDir(id: string): string {
    return join(this.root, id);
  }

  deckPath(id: string): string {
    return join(this.root, id, "deck.json");
  }

  /** Raw bytes of decks/<id>/deck.json, or null when the deck does not exist. */
  async readRaw(id: string): Promise<Buffer | null> {
    if (!DECK_ID.test(id)) throw new Error(`invalid deck id "${id}"`);
    try {
      return await readFile(this.deckPath(id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  /** Writes deck.json atomically: a temp file in the same directory, then rename. */
  async writeAtomic(id: string, bytes: Buffer): Promise<void> {
    if (!DECK_ID.test(id)) throw new Error(`invalid deck id "${id}"`);
    const tmp = join(this.root, id, `deck.json.${randomBytes(6).toString("hex")}.tmp`);
    try {
      await writeFile(tmp, bytes, { flag: "wx" });
      await rename(tmp, this.deckPath(id));
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
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

export interface DeckSummary {
  id: string;
  title: string;
  slides: number;
}

export async function listDecks(store: DeckStore, root: string): Promise<DeckSummary[]> {
  const { readdir } = await import("node:fs/promises");
  const out: DeckSummary[] = [];
  for (const dirent of await readdir(root, { withFileTypes: true })) {
    if (!dirent.isDirectory() || !DECK_ID.test(dirent.name)) continue;
    try {
      const deck = await store.load(dirent.name);
      out.push({ id: dirent.name, title: deck.title, slides: deck.slides.length });
    } catch {
      // Invalid decks are skipped from the list; loading them reports the error.
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
