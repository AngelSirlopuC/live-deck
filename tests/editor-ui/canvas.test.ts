// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { elementsInRect, hitElement, normalizeRect } from "../../web/src/editor/ui/canvas.ts";
import { buildPrintRoot } from "../../web/src/editor/ui/export.ts";
import { createThumbCache } from "../../web/src/editor/ui/thumbs.ts";
import { renderIcon } from "../../web/src/render/slide.ts";
import { sampleDeck } from "./helpers.ts";

describe("canvas hit testing", () => {
  const slide = sampleDeck().slides[0]!;
  it("picks the topmost element, tolerates lines, and ignores empty space", () => {
    expect(hitElement(slide, { x: 0.2, y: 0.2 })?.id).toBe("titulo");
    expect(hitElement(slide, { x: 0.7, y: 0.6 })?.id).toBe("caja");
    expect(hitElement(slide, { x: 0.95, y: 0.95 })).toBeUndefined();
    const withLine = { elements: [{ id: "l", type: "shape" as const, shape: "line" as const, box: { x: 0.1, y: 0.5, w: 0.5, h: 0 } }] };
    expect(hitElement(withLine, { x: 0.3, y: 0.505 })?.id).toBe("l");
    expect(hitElement(withLine, { x: 0.3, y: 0.55 })).toBeUndefined();
  });

  it("marquee selects intersecting elements", () => {
    expect(elementsInRect(slide, normalizeRect({ x: 0.55, y: 0.45 }, { x: 0.05, y: 0.05 }))).toEqual(["titulo"]);
    expect(elementsInRect(slide, { x: 0, y: 0, w: 1, h: 1 })).toEqual(["titulo", "caja", "paso"]);
  });
});

describe("thumbnails and print", () => {
  it("reuses renders while the slide object is unchanged", () => {
    const deck = sampleDeck();
    const thumbs = createThumbCache("/decks/x/");
    const a = thumbs.get(deck, 0);
    const b = thumbs.get(deck, 0);
    expect(thumbs.renders).toBe(1);
    expect(a).not.toBe(b);
    expect(a.querySelector(".stage")?.getAttribute("data-slide-id")).toBe("portada");
    // Fragments are all visible in thumbnails.
    expect(a.querySelector<HTMLElement>('[data-element-id="paso"]')?.hidden).toBe(false);
    thumbs.get({ ...deck, theme: { preset: "neon" } }, 0);
    expect(thumbs.renders).toBe(2);
  });

  it("builds one print page per slide with every fragment visible", () => {
    const root = buildPrintRoot(sampleDeck(), "/decks/x/");
    expect(root.querySelectorAll(".ed-print-page")).toHaveLength(3);
    expect(root.querySelector<HTMLElement>('[data-element-id="paso"]')?.hidden).toBe(false);
  });
});

describe("renderer compatibility", () => {
  it("renderIcon is exported and still draws the curated Lucide nodes", () => {
    const svg = renderIcon("rocket", 2)!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.childElementCount).toBeGreaterThan(0);
    expect(renderIcon("not-an-icon", 2)).toBeNull();
  });
});
