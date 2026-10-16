import { randomBytes, randomInt } from "node:crypto";
import type { Deck } from "../../shared/deck.ts";
import { PinGuard, hashPin, verifyPin } from "../security/pin.ts";
import { Session } from "./session.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Ended sessions are kept briefly so the presenter can download the summary. */
export const ENDED_TTL_MS = 30 * 60 * 1000;
/** Sessions with nobody connected and no presenter activity are collected after this. */
export const IDLE_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionEntry {
  session: Session;
  token: string;
  pinHash: string;
  guard: PinGuard;
  endedAt: number | null;
}

export type PresenterAuth =
  | { ok: true; entry: SessionEntry }
  | { ok: false; reason: "not-found" | "locked" | "unauthorized" };

export class SessionRegistry {
  private readonly byCode = new Map<string, SessionEntry>();
  private readonly byToken = new Map<string, SessionEntry>();

  create(deckId: string, deck: Deck, pin: string, now: number): SessionEntry {
    let code = "";
    do {
      code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    } while (this.byCode.has(code));
    const entry: SessionEntry = {
      session: new Session({ code, deckId, deck, now }),
      token: randomBytes(24).toString("base64url"),
      pinHash: hashPin(pin),
      guard: new PinGuard(),
      endedAt: null,
    };
    this.byCode.set(code, entry);
    this.byToken.set(entry.token, entry);
    return entry;
  }

  get(code: string): SessionEntry | undefined {
    return this.byCode.get(code);
  }

  authenticatePresenter(token: string, pin: string, now: number): PresenterAuth {
    const entry = this.byToken.get(token);
    if (!entry) return { ok: false, reason: "not-found" };
    if (entry.guard.isLocked(now)) return { ok: false, reason: "locked" };
    if (!verifyPin(pin, entry.pinHash)) {
      entry.guard.fail(now);
      return { ok: false, reason: entry.guard.isLocked(now) ? "locked" : "unauthorized" };
    }
    entry.guard.succeed();
    return { ok: true, entry };
  }

  markEnded(entry: SessionEntry, now: number) {
    entry.endedAt ??= now;
  }

  remove(entry: SessionEntry) {
    this.byCode.delete(entry.session.code);
    this.byToken.delete(entry.token);
  }

  /** Runs time-based transitions; returns sessions whose snapshot changed and those removed. */
  tick(now: number): { changed: SessionEntry[]; removed: SessionEntry[] } {
    const changed: SessionEntry[] = [];
    const removed: SessionEntry[] = [];
    for (const entry of this.byCode.values()) {
      const s = entry.session;
      const expiredEnded = entry.endedAt !== null && now - entry.endedAt >= ENDED_TTL_MS;
      const idle = s.connectionCount === 0 && now - s.lastPresenterActivity >= IDLE_TTL_MS;
      if (expiredEnded || idle) {
        this.remove(entry);
        removed.push(entry);
      } else if (s.tick(now)) {
        changed.push(entry);
      }
    }
    return { changed, removed };
  }

  get size(): number {
    return this.byCode.size;
  }
}
