import { randomBytes } from "node:crypto";
import { CHAT_TEXT_MAX, REACTIONS, type ChatMessage, type ChatMode, type Sticker } from "../../shared/protocol.ts";

/** Batches reactions into fixed windows; the hub broadcasts one count array per window. */
export class ReactionMeter {
  private window: number[] = REACTIONS.map(() => 0);
  private dirty = false;
  private readonly total: number[] = REACTIONS.map(() => 0);

  add(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= REACTIONS.length) return;
    this.window[index]!++;
    this.total[index]!++;
    this.dirty = true;
  }

  /** Counts since the last flush, or null when nothing happened. */
  flush(): number[] | null {
    if (!this.dirty) return null;
    const out = this.window;
    this.window = REACTIONS.map(() => 0);
    this.dirty = false;
    return out;
  }

  totals(): number[] {
    return [...this.total];
  }
}

export interface ChatPost {
  from: string;
  name: string;
  text?: string;
  sticker?: Sticker;
}

export type PostResult = { ok: true; message: ChatMessage } | { ok: false; reason: "closed" | "paused" | "mode" | "empty" | "muted" | "rate" };

const RATE_BURST = 3;
const RATE_REFILL_MS = 2_000;

/** Normalizes user text: no control characters, single spaces, trimmed, at most `max` characters. */
export function cleanText(raw: string, max: number = CHAT_TEXT_MAX): string {
  return raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trimEnd();
}

/** Session chat: presenter-controlled mode, moderation, rate limits and bounded history. */
export class Chat {
  private mode: ChatMode = "off";
  private paused = false;
  private readonly messages: ChatMessage[] = [];
  private readonly muted = new Set<string>();
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  private readonly limit: number;

  constructor(limit = 100) {
    this.limit = limit;
  }

  get state() {
    return { mode: this.mode, paused: this.paused };
  }

  setMode(mode: ChatMode) {
    this.mode = mode;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  mute(participantId: string) {
    this.muted.add(participantId);
  }

  isMuted(participantId: string) {
    return this.muted.has(participantId);
  }

  delete(id: string): boolean {
    const i = this.messages.findIndex((m) => m.id === id);
    if (i < 0) return false;
    this.messages.splice(i, 1);
    return true;
  }

  history(): ChatMessage[] {
    return [...this.messages];
  }

  post(p: ChatPost, now: number): PostResult {
    if (this.mode === "off") return { ok: false, reason: "closed" };
    if (this.paused) return { ok: false, reason: "paused" };
    if (this.muted.has(p.from)) return { ok: false, reason: "muted" };
    const text = p.text !== undefined ? cleanText(p.text) : undefined;
    if (p.text !== undefined && this.mode === "sticker") return { ok: false, reason: "mode" };
    if (p.sticker && this.mode === "text") return { ok: false, reason: "mode" };
    if (!p.sticker && !text) return { ok: false, reason: "empty" };

    const b = this.buckets.get(p.from) ?? { tokens: RATE_BURST, at: now };
    b.tokens = Math.min(RATE_BURST, b.tokens + (now - b.at) / RATE_REFILL_MS);
    b.at = now;
    if (b.tokens < 1) {
      this.buckets.set(p.from, b);
      return { ok: false, reason: "rate" };
    }
    b.tokens -= 1;
    this.buckets.set(p.from, b);

    const message: ChatMessage = { id: randomBytes(6).toString("base64url"), from: p.from, name: p.name, at: now, ...(text ? { text } : {}), ...(p.sticker ? { sticker: p.sticker } : {}) };
    this.messages.push(message);
    if (this.messages.length > this.limit) this.messages.splice(0, this.messages.length - this.limit);
    return { ok: true, message };
  }
}
