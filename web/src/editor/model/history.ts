// Undo/redo over immutable deck snapshots. Commands return structurally shared
// decks, so keeping whole snapshots is cheap and undo is a pointer move.
import type { Deck } from "../../../../shared/deck.ts";

export const DEFAULT_HISTORY_CAP = 200;

export class History {
  #past: Deck[] = [];
  #future: Deck[] = [];
  #present: Deck;
  #saved: Deck;
  #cap: number;
  /** Coalesce key of the last push; a push with the same key replaces the top step. */
  #lastKey: string | undefined;

  constructor(initial: Deck, cap: number = DEFAULT_HISTORY_CAP) {
    this.#present = initial;
    this.#saved = initial;
    this.#cap = Math.max(1, cap);
  }

  get present(): Deck {
    return this.#present;
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  /** Dirty whenever the present snapshot is not the one last saved (undoing back to it clears dirty). */
  get isDirty(): boolean {
    return this.#present !== this.#saved;
  }

  /**
   * Records `next` as the new present. Consecutive pushes sharing a
   * `coalesceKey` (one drag, one typing burst) collapse into a single undo step.
   */
  push(next: Deck, coalesceKey?: string): void {
    if (next === this.#present) return;
    const merge = coalesceKey !== undefined && coalesceKey === this.#lastKey;
    if (!merge) {
      this.#past.push(this.#present);
      if (this.#past.length > this.#cap) this.#past.splice(0, this.#past.length - this.#cap);
    }
    this.#present = next;
    this.#future = [];
    this.#lastKey = coalesceKey;
  }

  /** Ends the current coalescing run (drag end, blur) so the next push starts a new step. */
  seal(): void {
    this.#lastKey = undefined;
  }

  undo(): Deck | undefined {
    const prev = this.#past.pop();
    if (!prev) return undefined;
    this.#future.push(this.#present);
    this.#present = prev;
    this.#lastKey = undefined;
    return prev;
  }

  redo(): Deck | undefined {
    const next = this.#future.pop();
    if (!next) return undefined;
    this.#past.push(this.#present);
    this.#present = next;
    this.#lastKey = undefined;
    return next;
  }

  markSaved(): void {
    this.#saved = this.#present;
  }

  /** Replaces everything with a fresh baseline (after load or discard). */
  reset(deck: Deck): void {
    this.#past = [];
    this.#future = [];
    this.#present = deck;
    this.#saved = deck;
    this.#lastKey = undefined;
  }
}
