import { describe, expect, it } from "vitest";
import { effectRect, zoomTransform } from "../shared/effects.ts";

const slide = { elements: [{ id: "a", box: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } }] } as any;

describe("effect geometry", () => {
  it("resolves an element target to its box with a little breathing room", () => {
    const r = effectRect(slide, { elementId: "a" })!;
    expect(r.x).toBeCloseTo(0.24);
    expect(r.y).toBeCloseTo(0.24);
    expect(r.w).toBeCloseTo(0.52);
    expect(r.h).toBeCloseTo(0.52);
  });

  it("passes rectangles through, clamped to the canvas", () => {
    const r = effectRect(slide, { rect: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 } })!;
    expect(r.x).toBe(0.9);
    expect(r.w).toBeCloseTo(0.1);
    expect(r.h).toBeCloseTo(0.1);
  });

  it("returns null for an unknown element", () => {
    expect(effectRect(slide, { elementId: "zzz" })).toBeNull();
  });

  it("zooms so the rect fills the stage, centered, capped at 4x", () => {
    const t = zoomTransform({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(t.scale).toBeCloseTo(2);
    expect(t.cx).toBeCloseTo(0.5);
    expect(t.cy).toBeCloseTo(0.5);
    expect(zoomTransform({ x: 0, y: 0, w: 0.01, h: 0.01 }).scale).toBe(4);
  });
});
