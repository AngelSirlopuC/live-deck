// Presenter pointer effects, expressed in normalized stage coordinates so they
// land on the same spot on every screen.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EffectTarget = { elementId: string } | { rect: Rect };

/** Persistent effects stay until cleared or the slide changes. */
export type PersistentEffect = { kind: "focus"; target: EffectTarget } | { kind: "zoom"; target: EffectTarget };

export interface Ripple {
  x: number;
  y: number;
}

const PAD = 0.01;
const MAX_ZOOM = 4;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface EffectSlide {
  elements: ReadonlyArray<{ id: string; box: Rect }>;
}

/** Normalized rectangle an effect points at, or null when the element is not on the slide. */
export function effectRect(slide: EffectSlide, target: EffectTarget): Rect | null {
  let r: Rect;
  if ("elementId" in target) {
    const el = slide.elements.find((e) => e.id === target.elementId);
    if (!el) return null;
    r = { x: el.box.x - PAD, y: el.box.y - PAD, w: el.box.w + PAD * 2, h: el.box.h + PAD * 2 };
  } else {
    r = target.rect;
  }
  const x = clamp01(r.x);
  const y = clamp01(r.y);
  return { x, y, w: Math.max(0.01, Math.min(1 - x, r.w)), h: Math.max(0.01, Math.min(1 - y, r.h)) };
}

/** Scale and focal point (normalized center) that make `rect` fill the stage. */
export function zoomTransform(rect: Rect): { scale: number; cx: number; cy: number } {
  const scale = Math.min(MAX_ZOOM, 1 / Math.max(rect.w, rect.h));
  return { scale: Math.max(1, scale), cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
}
