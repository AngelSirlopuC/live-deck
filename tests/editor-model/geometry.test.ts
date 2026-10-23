import { describe, expect, it } from "vitest";
import { clampBox, moveBox, nudgeDelta, resizeBox, round4, unionBox, NUDGE_STEP, NUDGE_BIG_STEP } from "../../web/src/editor/model/geometry.ts";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const start = box(0.2, 0.2, 0.4, 0.2);

describe("resizeBox", () => {
  it("drags each of the 8 handles", () => {
    expect(resizeBox(start, "e", 0.1, 0)).toEqual(box(0.2, 0.2, 0.5, 0.2));
    expect(resizeBox(start, "w", 0.1, 0)).toEqual(box(0.3, 0.2, 0.3, 0.2));
    expect(resizeBox(start, "s", 0, 0.1)).toEqual(box(0.2, 0.2, 0.4, 0.3));
    expect(resizeBox(start, "n", 0, 0.1)).toEqual(box(0.2, 0.3, 0.4, 0.1));
    expect(resizeBox(start, "se", 0.1, 0.1)).toEqual(box(0.2, 0.2, 0.5, 0.3));
    expect(resizeBox(start, "ne", 0.1, -0.1)).toEqual(box(0.2, 0.1, 0.5, 0.3));
    expect(resizeBox(start, "sw", -0.1, 0.1)).toEqual(box(0.1, 0.2, 0.5, 0.3));
    expect(resizeBox(start, "nw", -0.1, -0.1)).toEqual(box(0.1, 0.1, 0.5, 0.3));
  });

  it("enforces the minimum size without flipping", () => {
    expect(resizeBox(start, "e", -0.5, 0)).toEqual(box(0.2, 0.2, 0.01, 0.2));
    expect(resizeBox(start, "w", 0.5, 0)).toEqual(box(0.59, 0.2, 0.01, 0.2));
    expect(resizeBox(start, "n", 0, 0.5)).toEqual(box(0.2, 0.39, 0.4, 0.01));
    expect(resizeBox(start, "s", 0, -0.3, { minSize: 0.05 })).toEqual(box(0.2, 0.2, 0.4, 0.05));
  });

  it("keeps the box inside the slide", () => {
    expect(resizeBox(start, "e", 0.9, 0)).toEqual(box(0.2, 0.2, 0.8, 0.2));
    expect(resizeBox(start, "nw", -0.5, -0.5)).toEqual(box(0, 0, 0.6, 0.4));
  });

  it("locks the aspect ratio from the corner handles when asked", () => {
    const r = resizeBox(start, "se", 0.2, 0, { aspect: true });
    expect(r.w / r.h).toBeCloseTo(2, 6);
    expect(r.w).toBeCloseTo(0.6, 6);
    const nw = resizeBox(start, "nw", -0.2, 0, { aspect: true });
    expect(nw.w / nw.h).toBeCloseTo(2, 6);
    // Anchored at the bottom-right corner.
    expect(nw.x + nw.w).toBeCloseTo(0.6, 6);
    expect(nw.y + nw.h).toBeCloseTo(0.4, 6);
    const e = resizeBox(start, "e", 0.2, 0, { aspect: true });
    expect(e.w / e.h).toBeCloseTo(2, 6);
  });

  it("a line may keep height 0 when minH is 0", () => {
    expect(resizeBox(box(0.2, 0.5, 0.3, 0), "e", 0.1, 0, { minH: 0 })).toEqual(box(0.2, 0.5, 0.4, 0));
  });
});

describe("moveBox / clampBox / round4", () => {
  it("moves and clamps into the slide", () => {
    expect(moveBox(start, 0.5, -0.5)).toEqual(box(0.6, 0, 0.4, 0.2));
    expect(moveBox(start, 0.1, 0.1)).toEqual(box(0.3, 0.3, 0.4, 0.2));
  });

  it("clampBox fixes size first, then position, and rounds to 4 decimals", () => {
    expect(clampBox(box(0.5, 0.5, 2, 2))).toEqual(box(0, 0, 1, 1));
    expect(clampBox(box(0.1 + 0.2, 0, 0.001, 0.001))).toEqual(box(0.3, 0, 0.01, 0.01));
    expect(clampBox(box(0, 0, 0.5, 0), { minH: 0 })).toEqual(box(0, 0, 0.5, 0));
    expect(round4(0.30000000000000004)).toBe(0.3);
  });
});

describe("nudgeDelta / unionBox", () => {
  it("maps arrow keys to small or big steps", () => {
    expect(nudgeDelta("ArrowLeft", false)).toEqual({ dx: -NUDGE_STEP, dy: 0 });
    expect(nudgeDelta("ArrowDown", true)).toEqual({ dx: 0, dy: NUDGE_BIG_STEP });
    expect(nudgeDelta("ArrowUp", false)).toEqual({ dx: 0, dy: -NUDGE_STEP });
    expect(nudgeDelta("ArrowRight", true)).toEqual({ dx: NUDGE_BIG_STEP, dy: 0 });
    expect(nudgeDelta("Enter", false)).toBeUndefined();
    expect(NUDGE_BIG_STEP).toBeGreaterThan(NUDGE_STEP);
  });

  it("unionBox bounds a set", () => {
    expect(unionBox([box(0.1, 0.2, 0.2, 0.2), box(0.5, 0.1, 0.3, 0.1)])).toEqual(box(0.1, 0.1, 0.7, 0.3));
    expect(unionBox([])).toBeUndefined();
  });
});
