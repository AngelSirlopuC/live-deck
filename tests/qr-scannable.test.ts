// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Deck, Theme } from "../shared/deck.ts";
import { contrastRatio, luminance, PRESET_NAMES } from "../shared/themes.ts";
import { renderSlide } from "../web/src/render/slide.ts";

const hexOf = (css: string): string => {
  const m = css.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (!m) return css;
  return "#" + m.slice(1).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
};

function qrNode(theme: Theme | undefined, style?: { color?: string; background?: string }) {
  const deck = {
    version: 1,
    title: "qr",
    ...(theme ? { theme } : {}),
    slides: [{ id: "s", elements: [{ id: "qr", type: "qr", box: { x: 0.6, y: 0.1, w: 0.3, h: 0.6 }, ...(style ? { style } : {}) }] }],
  } as Deck;
  const stage = renderSlide(deck, 0, { step: 0, joinUrl: "https://x.test/s/ABC", qrSvg: '<svg><path stroke="#14110d" d="M0 0h1"/></svg>' });
  return stage.querySelector<HTMLElement>('[data-element-id="qr"]')!;
}

function pair(node: HTMLElement) {
  const tile = hexOf(node.style.background);
  const ink = hexOf(node.style.getPropertyValue("--qr-ink"));
  return { tile, ink };
}

const themes: Theme[] = PRESET_NAMES.flatMap((preset) => [{ preset }, { preset, mode: "light" as const }, { preset, mode: "dark" as const }]);

describe("the join QR always scans", () => {
  it("draws dark modules on a light tile with at least 4:1 for every preset and mode, unstyled and with the token pair", () => {
    for (const theme of themes) {
      for (const style of [undefined, { background: "text", color: "background" }, { background: "background", color: "text" }]) {
        const { tile, ink } = pair(qrNode(theme, style));
        const label = `${JSON.stringify(theme)} ${JSON.stringify(style)}`;
        expect(contrastRatio(ink, tile), label).toBeGreaterThanOrEqual(4);
        expect(luminance(ink) < luminance(tile), label).toBe(true);
      }
    }
  });

  it("keeps an explicit pair that already scans", () => {
    const { tile, ink } = pair(qrNode({ preset: "estudio" }, { background: "#ffffff", color: "#000000" }));
    expect(tile).toBe("#ffffff");
    expect(ink).toBe("#000000");
  });

  it("falls back when an explicit pair is too faint or inverted", () => {
    for (const style of [{ background: "#cccccc", color: "#bbbbbb" }, { background: "#000000", color: "#ffffff" }]) {
      const { tile, ink } = pair(qrNode({ preset: "papel" }, style));
      expect(contrastRatio(ink, tile)).toBeGreaterThanOrEqual(4);
      expect(luminance(ink) < luminance(tile)).toBe(true);
    }
  });

  it("paints the SVG modules with the chosen ink through CSS", () => {
    const css = readFileSync(join(process.cwd(), "web/src/styles/stage.css"), "utf8");
    expect(css).toMatch(/\.qr-code svg path\s*\{[^}]*stroke:\s*var\(--qr-ink/);
  });

  it("the deck CLI template's QR scans on a light preset", async () => {
    const tpl = readFileSync(join(process.cwd(), "bin/live-deck.ts"), "utf8");
    expect(tpl).not.toMatch(/type: "qr"[^\n]*background: "text"/);
  });
});
