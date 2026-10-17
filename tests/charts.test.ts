// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Deck } from "../shared/deck.ts";
import { THEME_PRESETS } from "../shared/themes.ts";
import { donutSlicePath } from "../web/src/render/charts.ts";
import { renderSlide } from "../web/src/render/slide.ts";

const box = { x: 0.1, y: 0.1, w: 0.6, h: 0.6 };

function deckWith(elements: Deck["slides"][number]["elements"], theme?: Deck["theme"]): Deck {
  return { version: 1, title: "T", ...(theme ? { theme } : {}), slides: [{ id: "s", elements }] };
}

describe("bar chart", () => {
  const data = [
    { label: "Ene", value: 12 },
    { label: "Feb", value: 30 },
    { label: "Mar", value: 0 },
  ];

  it("draws one bar per datum with direct value labels and no legend", () => {
    const stage = renderSlide(deckWith([{ id: "c", type: "chart", kind: "bar", box, data, unit: "%" }]), 0, { step: 0 });
    const svg = stage.querySelector('[data-element-id="c"] svg')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll(".chart-bar")).toHaveLength(3);
    const values = [...svg.querySelectorAll(".chart-value")].map((t) => t.textContent);
    expect(values).toEqual(["12%", "30%", "0%"]);
    const labels = [...svg.querySelectorAll(".chart-label")].map((t) => t.textContent);
    expect(labels).toEqual(["Ene", "Feb", "Mar"]);
    expect(svg.querySelector(".chart-legend")).toBeNull();
  });

  it("paints every bar in one hue: the accent, or style.color", () => {
    const accent = renderSlide(deckWith([{ id: "c", type: "chart", kind: "bar", box, data }]), 0, { step: 0 });
    const fills = new Set([...accent.querySelectorAll(".chart-bar")].map((b) => b.getAttribute("fill")));
    expect([...fills]).toEqual(["#ff7a45"]);
    const custom = renderSlide(deckWith([{ id: "c", type: "chart", kind: "bar", box, data, style: { color: "#00aa88" } }]), 0, { step: 0 });
    expect(new Set([...custom.querySelectorAll(".chart-bar")].map((b) => b.getAttribute("fill")))).toEqual(new Set(["#00aa88"]));
  });

  it("keeps labels in text tokens, never in the series colour", () => {
    const stage = renderSlide(deckWith([{ id: "c", type: "chart", kind: "bar", box, data }]), 0, { step: 0 });
    for (const t of stage.querySelectorAll(".chart-value, .chart-label")) expect(t.getAttribute("fill")).toBeNull();
  });

  it("renders labels as text, never as markup", () => {
    const stage = renderSlide(deckWith([{ id: "c", type: "chart", kind: "bar", box, data: [{ label: "<img src=x>", value: 1 }] }]), 0, { step: 0 });
    expect(stage.querySelector("img")).toBeNull();
    expect(stage.querySelector(".chart-label")!.textContent).toBe("<img src=x>");
  });
});

describe("donut chart", () => {
  const data = [
    { label: "Sí", value: 6 },
    { label: "No", value: 3 },
    { label: "NS", value: 1 },
  ];

  it("draws one slice per datum in the preset palette order, a legend with values and the total", () => {
    const stage = renderSlide(deckWith([{ id: "d", type: "chart", kind: "donut", box, data }], { preset: "neon" }), 0, { step: 0 });
    const svg = stage.querySelector('[data-element-id="d"] svg')!;
    const slices = [...svg.querySelectorAll(".chart-slice")];
    expect(slices).toHaveLength(3);
    expect(slices.map((s) => s.getAttribute("fill"))).toEqual(THEME_PRESETS.neon.palette.slice(0, 3));
    const legend = [...svg.querySelectorAll(".chart-legend-item")].map((g) => g.textContent);
    expect(legend).toEqual(["Sí6", "No3", "NS1"]);
    expect(svg.querySelector(".chart-total")!.textContent).toBe("10");
  });

  it("keeps a legend entry for zero values", () => {
    const stage = renderSlide(deckWith([{ id: "d", type: "chart", kind: "donut", box, data: [{ label: "A", value: 5 }, { label: "B", value: 0 }], unit: "u" }]), 0, { step: 0 });
    expect(stage.querySelectorAll(".chart-legend-item")).toHaveLength(2);
    expect(stage.querySelector(".chart-total")!.textContent).toBe("5 u");
  });

  it("leaves a constant 2px gap between slices", () => {
    // A quarter slice of a ring with radii 100/60 starts 1px past the angle on each radius.
    const d = donutSlicePath(0, 0, 100, 60, -Math.PI / 2, 0, 2);
    const start = d.match(/^M ([-\d.]+) ([-\d.]+)/)!;
    expect(Number(start[1])).toBeCloseTo(1, 1);
    expect(Number(start[2])).toBeCloseTo(-100, 1);
  });

  it("skips slices thinner than the gap", () => {
    expect(donutSlicePath(0, 0, 100, 60, 0, 0.005, 2)).toBe("");
  });
});
