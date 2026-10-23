import { describe, expect, it } from "vitest";
import { snapEdge, snapMove } from "../../web/src/editor/model/snap.ts";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const T = 0.01;

describe("snapMove", () => {
  it("snaps to the slide left edge and reports a vertical guide", () => {
    const r = snapMove(box(0.1, 0.43, 0.2, 0.1), [], -0.095, 0, T);
    expect(r.dx).toBeCloseTo(-0.1, 6);
    expect(r.dy).toBe(0);
    expect(r.guides).toEqual([{ axis: "x", at: 0 }]);
  });

  it("reports a guide for an edge that is already aligned (zero correction)", () => {
    const r = snapMove(box(0.1, 0.5, 0.2, 0.1), [], 0.27, 0, T);
    expect(r.dy).toBe(0);
    expect(r.guides).toEqual([{ axis: "y", at: 0.5 }]);
  });

  it("snaps the box center to the slide center on both axes", () => {
    const r = snapMove(box(0.1, 0.1, 0.2, 0.2), [], 0.295, 0.306, T);
    expect(r.dx).toBeCloseTo(0.3, 6);
    expect(r.dy).toBeCloseTo(0.3, 6);
    expect(r.guides).toEqual(expect.arrayContaining([{ axis: "x", at: 0.5 }, { axis: "y", at: 0.5 }]));
  });

  it("snaps to another element's right edge and center", () => {
    const other = box(0.5, 0.2, 0.2, 0.2); // right edge 0.7, center y 0.3
    const r = snapMove(box(0, 0, 0.1, 0.1), [other], 0.704, 0.248, T);
    expect(r.dx).toBeCloseTo(0.7, 6); // left edge → other's right edge
    expect(r.dy).toBeCloseTo(0.25, 6); // center y 0.05+0.25 = 0.3
    expect(r.guides).toEqual(expect.arrayContaining([{ axis: "x", at: 0.7 }, { axis: "y", at: 0.3 }]));
  });

  it("does not snap beyond the threshold", () => {
    const r = snapMove(box(0.1, 0.5, 0.2, 0.1), [], -0.08, 0.02, T);
    expect(r.dx).toBe(-0.08);
    expect(r.dy).toBe(0.02);
    expect(r.guides).toEqual([]);
  });

  it("prefers the closest candidate", () => {
    // Right edge 0.294 → 0.3 (diff .006) loses to left edge 0.194 → 0.19 (diff .004).
    const r = snapMove(box(0.1, 0.1, 0.1, 0.1), [box(0.3, 0.1, 0.1, 0.1), box(0.19, 0.5, 0.1, 0.1)], 0.094, 0, T);
    expect(r.dx).toBeCloseTo(0.09, 6);
    expect(r.guides).toEqual([{ axis: "x", at: 0.19 }, { axis: "y", at: 0.1 }]);
  });
});

describe("snapEdge", () => {
  it("snaps a single coordinate to slide lines or other edges within the threshold", () => {
    expect(snapEdge(0.496, "x", [], T)).toEqual({ value: 0.5, guide: { axis: "x", at: 0.5 } });
    expect(snapEdge(0.994, "y", [], T)).toEqual({ value: 1, guide: { axis: "y", at: 1 } });
    expect(snapEdge(0.306, "x", [box(0.3, 0, 0.1, 0.1)], T)).toEqual({ value: 0.3, guide: { axis: "x", at: 0.3 } });
    expect(snapEdge(0.42, "x", [], T)).toEqual({ value: 0.42 });
  });
});
