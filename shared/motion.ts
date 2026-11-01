// Motion engine. Decks never name an animation: the skill picks one deck-level
// motion style and the fragment steps, and the renderer derives each element's
// entrance from what the element is. This module is zod-free so the browser
// bundle can import it; the schema in deck.ts reuses MOTION_STYLES.
import type { DeckElement } from "./deck.ts";

export const MOTION_STYLES = ["calm", "lively", "snappy", "none"] as const;
export type MotionStyle = (typeof MOTION_STYLES)[number];
export const DEFAULT_MOTION: MotionStyle = "calm";

/** Entrance families; each has its own keyframes in stage.css (transform and opacity only). */
export type EnterKind = "rise" | "rise-lg" | "grow" | "sweep" | "draw" | "fade-scale" | "settle" | "pop" | "fade";

export interface Entrance {
  kind: EnterKind;
  delayMs: number;
  durationMs: number;
  ease: string;
}

export interface MotionTiming {
  /** Entrance duration of one element. */
  durationMs: number;
  /** Delay between consecutive elements of a group, in reading order. */
  staggerMs: number;
  /** Arrival curve: a confident exponential ease-out. */
  ease: string;
  /** Curve for pop and grow; only lively overshoots. */
  overshoot: string;
  /** Slide transition length. */
  slideMs: number;
}

/**
 * Style table.
 *   calm   — the default; unhurried arrivals, everything lands within ~1.4s.
 *   lively — quicker, with a slight overshoot on icons and bars.
 *   snappy — crisp, almost immediate; for dense or fast talks.
 *   none   — no element entrance and no slide transition.
 */
export const MOTION_TIMING: Record<Exclude<MotionStyle, "none">, MotionTiming> = {
  calm: { durationMs: 560, staggerMs: 80, ease: "cubic-bezier(0.16, 1, 0.3, 1)", overshoot: "cubic-bezier(0.16, 1, 0.3, 1)", slideMs: 320 },
  lively: { durationMs: 460, staggerMs: 65, ease: "cubic-bezier(0.22, 1, 0.36, 1)", overshoot: "cubic-bezier(0.34, 1.45, 0.64, 1)", slideMs: 300 },
  snappy: { durationMs: 300, staggerMs: 40, ease: "cubic-bezier(0.2, 0, 0, 1)", overshoot: "cubic-bezier(0.2, 0, 0, 1)", slideMs: 160 },
};

/** The last element of a group never starts later than this, however long the slide. */
export const STAGGER_CAP_MS = 900;
/** Text at or above this size (stage px) is display text and travels further. */
export const DISPLAY_SIZE = 72;
/** Rows of the reading order: boxes whose y differ by less than this share a row. */
const ROW = 0.04;
/** Decor is atmosphere: it fades in slower than content and never holds the content back. */
const DECOR_SLOWDOWN = 1.5;

/** The entrance an element earns from its type, shape, chart kind or text size. */
export function entranceKind(el: DeckElement): EnterKind {
  switch (el.type) {
    case "text":
      return el.style?.font === "display" || (el.style?.fontSize ?? 0) >= DISPLAY_SIZE ? "rise-lg" : "rise";
    case "chart":
      return el.kind === "bar" ? "grow" : "sweep";
    case "shape":
      return el.shape === "line" ? "draw" : "fade-scale";
    case "image":
      return "settle";
    case "icon":
      return "pop";
    case "decor":
    case "qr":
      return "fade";
  }
}

/** Reading order: top row first, left to right inside a row. */
export function readingOrder<T extends { box: { x: number; y: number } }>(elements: readonly T[]): T[] {
  const row = (e: T) => Math.round(e.box.y / ROW);
  return [...elements].sort((a, b) => row(a) - row(b) || a.box.x - b.box.x);
}

/**
 * Entrances for one group of elements revealed together (slide entry, or one
 * fragment step), keyed by element id. Decor fades on its own clock; the rest
 * stagger in reading order, compressed so the whole group starts within the cap.
 */
export function groupEntrances(elements: readonly DeckElement[], style: MotionStyle): Map<string, Entrance> {
  const plan = new Map<string, Entrance>();
  if (style === "none") return plan;
  const timing = MOTION_TIMING[style];
  const ordered = readingOrder(elements);
  const content = ordered.filter((e) => e.type !== "decor");
  const stagger = content.length > 1 ? Math.min(timing.staggerMs, STAGGER_CAP_MS / (content.length - 1)) : 0;
  let slot = 0;
  for (const el of ordered) {
    const kind = entranceKind(el);
    const ease = kind === "pop" || kind === "grow" ? timing.overshoot : timing.ease;
    if (el.type === "decor") {
      plan.set(el.id, { kind, delayMs: 0, durationMs: timing.durationMs * DECOR_SLOWDOWN, ease });
      continue;
    }
    plan.set(el.id, { kind, delayMs: Math.round(slot * stagger), durationMs: timing.durationMs, ease });
    slot += 1;
  }
  return plan;
}
