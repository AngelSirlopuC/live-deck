// Motion engine: the entrance of every element is derived from what it is,
// staggered in reading order, timed by the deck's motion style. No deck field
// names an animation; the skill only picks the style and the fragment steps.
import { describe, expect, it } from "vitest";
import type { DeckElement } from "../shared/deck.ts";
import { DEFAULT_MOTION, MOTION_STYLES, MOTION_TIMING, STAGGER_CAP_MS, entranceKind, groupEntrances, readingOrder } from "../shared/motion.ts";

const box = (x: number, y: number, w = 0.2, h = 0.1) => ({ x, y, w, h });
const text = (id: string, b = box(0, 0), style?: Record<string, unknown>): DeckElement => ({ id, type: "text", box: b, text: id, ...(style ? { style } : {}) }) as DeckElement;

describe("entranceKind", () => {
  it("derives the entrance from the element type, shape, chart kind and text size", () => {
    expect(entranceKind(text("t"))).toBe("rise");
    expect(entranceKind(text("big", box(0, 0), { fontSize: 96 }))).toBe("rise-lg");
    expect(entranceKind(text("display", box(0, 0), { font: "display" }))).toBe("rise-lg");
    expect(entranceKind(text("card", box(0, 0), { card: true }))).toBe("rise");
    expect(entranceKind({ id: "c", type: "chart", kind: "bar", box: box(0, 0), data: [{ label: "a", value: 1 }] })).toBe("grow");
    expect(entranceKind({ id: "d", type: "chart", kind: "donut", box: box(0, 0), data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] })).toBe("sweep");
    expect(entranceKind({ id: "l", type: "shape", shape: "line", box: box(0, 0) })).toBe("draw");
    expect(entranceKind({ id: "r", type: "shape", shape: "rect", box: box(0, 0) })).toBe("fade-scale");
    expect(entranceKind({ id: "e", type: "shape", shape: "ellipse", box: box(0, 0) })).toBe("fade-scale");
    expect(entranceKind({ id: "i", type: "image", src: "assets/a.png", alt: "", box: box(0, 0) })).toBe("settle");
    expect(entranceKind({ id: "ic", type: "icon", name: "rocket", box: box(0, 0) })).toBe("pop");
    expect(entranceKind({ id: "dc", type: "decor", shape: "blob", box: box(0, 0) })).toBe("fade");
    expect(entranceKind({ id: "q", type: "qr", box: box(0, 0) })).toBe("fade");
  });
});

describe("readingOrder", () => {
  it("sorts by row (y rounded to 0.04) then x, so a slightly lower left item still reads first", () => {
    const els = [text("right", box(0.6, 0.1)), text("left", box(0.1, 0.11)), text("below", box(0.0, 0.5)), text("top", box(0.5, 0.0))];
    expect(readingOrder(els).map((e) => e.id)).toEqual(["top", "left", "right", "below"]);
  });
});

describe("groupEntrances", () => {
  it("staggers the group in reading order with the style's duration, stagger and ease", () => {
    const els = [text("b", box(0.5, 0.0)), text("a", box(0.0, 0.0)), text("c", box(0.0, 0.5))];
    for (const style of ["calm", "lively", "snappy"] as const) {
      const timing = MOTION_TIMING[style];
      const plan = groupEntrances(els, style);
      expect(plan.get("a")).toEqual({ kind: "rise", delayMs: 0, durationMs: timing.durationMs, ease: timing.ease });
      expect(plan.get("b")?.delayMs).toBe(timing.staggerMs);
      expect(plan.get("c")?.delayMs).toBe(timing.staggerMs * 2);
    }
    expect(MOTION_TIMING.calm.durationMs).toBeGreaterThan(MOTION_TIMING.lively.durationMs);
    expect(MOTION_TIMING.lively.durationMs).toBeGreaterThan(MOTION_TIMING.snappy.durationMs);
    expect(MOTION_TIMING.calm.staggerMs).toBeGreaterThan(MOTION_TIMING.snappy.staggerMs);
  });

  it("caps the total stagger so long slides do not crawl", () => {
    const els = Array.from({ length: 30 }, (_, i) => text(`t${i}`, box(0, i * 0.03)));
    const plan = groupEntrances(els, "calm");
    const delays = [...plan.values()].map((e) => e.delayMs);
    expect(Math.max(...delays)).toBeLessThanOrEqual(STAGGER_CAP_MS);
    expect(Math.max(...delays)).toBeGreaterThan(0);
    expect(new Set(delays).size).toBe(30);
  });

  it("uses the overshoot ease for pop and grow in lively only", () => {
    const els: DeckElement[] = [
      { id: "ic", type: "icon", name: "rocket", box: box(0, 0) },
      { id: "c", type: "chart", kind: "bar", box: box(0, 0.5), data: [{ label: "a", value: 1 }] },
      text("t", box(0.5, 0)),
    ];
    const lively = groupEntrances(els, "lively");
    expect(lively.get("ic")?.ease).toBe(MOTION_TIMING.lively.overshoot);
    expect(lively.get("c")?.ease).toBe(MOTION_TIMING.lively.overshoot);
    expect(lively.get("t")?.ease).toBe(MOTION_TIMING.lively.ease);
    expect(groupEntrances(els, "calm").get("ic")?.ease).toBe(MOTION_TIMING.calm.ease);
  });

  it("fades decor slower, without a delay and without taking a stagger slot", () => {
    const els: DeckElement[] = [{ id: "dc", type: "decor", shape: "blob", box: box(0, 0) }, text("a", box(0.1, 0.1)), text("b", box(0.1, 0.5))];
    const plan = groupEntrances(els, "calm");
    expect(plan.get("dc")).toEqual({ kind: "fade", delayMs: 0, durationMs: MOTION_TIMING.calm.durationMs * 1.5, ease: MOTION_TIMING.calm.ease });
    expect(plan.get("a")?.delayMs).toBe(0);
    expect(plan.get("b")?.delayMs).toBe(MOTION_TIMING.calm.staggerMs);
  });

  it("returns no entrances for none", () => {
    expect(groupEntrances([text("a")], "none").size).toBe(0);
  });

  it("defaults to calm and lists the four styles", () => {
    expect(DEFAULT_MOTION).toBe("calm");
    expect(MOTION_STYLES).toEqual(["calm", "lively", "snappy", "none"]);
  });
});
