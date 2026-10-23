// Snapping for drag and resize: slide edges and center, plus the edges and
// centers of the other elements on the slide. Pure math; the UI draws guides.
import type { Box } from "../../../../shared/deck.ts";
import { round4 } from "./geometry.ts";

/** A guide line: `axis: "x"` is a vertical line at x = at; `"y"` a horizontal one. */
export interface Guide {
  axis: "x" | "y";
  at: number;
}

export interface SnapMoveResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const SLIDE_LINES = [0, 0.5, 1];

/** Snap targets on one axis: slide lines plus each box's start, center and end. */
function targets(axis: "x" | "y", others: readonly Box[]): number[] {
  const out = [...SLIDE_LINES];
  for (const b of others) {
    const start = axis === "x" ? b.x : b.y;
    const size = axis === "x" ? b.w : b.h;
    out.push(start, start + size / 2, start + size);
  }
  return out;
}

/** Closest target to any of `points` within `threshold`; returns the correction to apply. */
function closest(points: readonly number[], candidates: readonly number[], threshold: number): { shift: number; at: number } | undefined {
  let best: { shift: number; at: number } | undefined;
  for (const p of points) {
    for (const c of candidates) {
      const diff = c - p;
      if (Math.abs(diff) <= threshold && (!best || Math.abs(diff) < Math.abs(best.shift))) best = { shift: diff, at: c };
    }
  }
  return best;
}

/**
 * Given the box being moved (or the union of a multi-selection), the other
 * boxes on the slide and the raw drag delta, returns the snapped delta and the
 * guides that justify it. Nothing snaps beyond `threshold` (slide units).
 */
export function snapMove(moving: Box, others: readonly Box[], dx: number, dy: number, threshold: number): SnapMoveResult {
  const guides: Guide[] = [];
  const xs = [moving.x + dx, moving.x + dx + moving.w / 2, moving.x + dx + moving.w];
  const ys = [moving.y + dy, moving.y + dy + moving.h / 2, moving.y + dy + moving.h];
  const sx = closest(xs, targets("x", others), threshold);
  const sy = closest(ys, targets("y", others), threshold);
  if (sx) { dx = round4(dx + sx.shift); guides.push({ axis: "x", at: round4(sx.at) }); }
  if (sy) { dy = round4(dy + sy.shift); guides.push({ axis: "y", at: round4(sy.at) }); }
  return { dx, dy, guides };
}

/** Snaps a single edge coordinate while resizing. */
export function snapEdge(value: number, axis: "x" | "y", others: readonly Box[], threshold: number): { value: number; guide?: Guide } {
  const hit = closest([value], targets(axis, others), threshold);
  if (!hit) return { value };
  const at = round4(hit.at);
  return { value: at, guide: { axis, at } };
}
