// Pure box math in normalized slide units (0..1 on a 16:9 canvas).
import type { Box } from "../../../../shared/deck.ts";

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Smallest width/height the editor lets a box reach (a line may still be 0 high). */
export const MIN_SIZE = 0.01;
/** Arrow-key nudge in slide units (≈5 px / ≈38 px on the 1920-wide stage). */
export const NUDGE_STEP = 0.0025;
export const NUDGE_BIG_STEP = 0.02;

export interface ClampOptions {
  /** Minimum width and height; defaults to MIN_SIZE. */
  minSize?: number;
  /** Minimum height when it differs from `minSize` (0 for line shapes). */
  minH?: number;
}

/** Avoids 0.30000000000000004 in saved JSON and keeps comparisons exact. */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Size first (min..1), then position so the box stays inside the slide. */
export function clampBox(box: Box, opts: ClampOptions = {}): Box {
  const minW = opts.minSize ?? MIN_SIZE;
  const minH = opts.minH ?? opts.minSize ?? MIN_SIZE;
  const w = clamp(box.w, minW, 1);
  const h = clamp(box.h, minH, 1);
  const x = clamp(box.x, 0, 1 - w);
  const y = clamp(box.y, 0, 1 - h);
  return { x: round4(x), y: round4(y), w: round4(w), h: round4(h) };
}

export function moveBox(box: Box, dx: number, dy: number, opts: ClampOptions = {}): Box {
  return clampBox({ ...box, x: box.x + dx, y: box.y + dy }, opts);
}

export interface ResizeOptions extends ClampOptions {
  /** Keep the starting aspect ratio (shift while dragging). */
  aspect?: boolean;
}

/**
 * Resizes `start` by dragging `handle` by (dx, dy). The opposite edge stays
 * anchored, sizes never flip below the minimum and the result stays inside the slide.
 */
export function resizeBox(start: Box, handle: Handle, dx: number, dy: number, opts: ResizeOptions = {}): Box {
  const minW = opts.minSize ?? MIN_SIZE;
  const minH = opts.minH ?? opts.minSize ?? MIN_SIZE;
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  // Each edge may move but never past the slide or its opposite edge.
  let left = west ? clamp(start.x + dx, 0, right - minW) : start.x;
  let r = east ? clamp(right + dx, left + minW, 1) : right;
  let top = north ? clamp(start.y + dy, 0, bottom - minH) : start.y;
  let b = south ? clamp(bottom + dy, top + minH, 1) : bottom;

  if (opts.aspect && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    let w = r - left;
    let h = b - top;
    // The axis the user moved most (relative to the start size) drives the other.
    const wChange = Math.abs(w - start.w) / start.w;
    const hChange = Math.abs(h - start.h) / start.h;
    if ((east || west) && (!(north || south) || wChange >= hChange)) h = w / ratio;
    else w = h * ratio;
    // Keep the anchored edges where they are, then fit inside the slide.
    const maxW = west ? right : 1 - left;
    const maxH = north ? bottom : 1 - top;
    if (w > maxW) { w = maxW; h = w / ratio; }
    if (h > maxH) { h = maxH; w = h * ratio; }
    if (w < minW) { w = minW; h = w / ratio; }
    if (h < minH) { h = minH; w = h * ratio; }
    left = west ? right - w : left;
    r = left + w;
    top = north ? bottom - h : top;
    b = top + h;
  }

  return clampBox({ x: left, y: top, w: r - left, h: b - top }, { minSize: minW, minH });
}

/** Delta for an arrow key, or undefined for any other key. */
export function nudgeDelta(key: string, big: boolean): { dx: number; dy: number } | undefined {
  const step = big ? NUDGE_BIG_STEP : NUDGE_STEP;
  switch (key) {
    case "ArrowLeft": return { dx: -step, dy: 0 };
    case "ArrowRight": return { dx: step, dy: 0 };
    case "ArrowUp": return { dx: 0, dy: -step };
    case "ArrowDown": return { dx: 0, dy: step };
    default: return undefined;
  }
}

/** Bounding box of a set, undefined when empty. */
export function unionBox(boxes: readonly Box[]): Box | undefined {
  if (boxes.length === 0) return undefined;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: round4(x0), y: round4(y0), w: round4(x1 - x0), h: round4(y1 - y0) };
}
