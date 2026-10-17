import type { ChartElement } from "../../../shared/deck.ts";

// Simple charts for projected slides, built with DOM APIs (labels go in as
// text nodes). Marks follow the dataviz rules: one hue for a single-series bar
// chart with direct value labels and no legend; a donut in the preset's fixed
// categorical order with 2px gaps, a legend with values and the total in the
// centre. Text uses the theme text tokens via CSS classes, never the series
// colour. No hover layer: slides are projected, so it is intentionally skipped.

const SVG_NS = "http://www.w3.org/2000/svg";
const GAP = 2;
const BAR_END_RADIUS = 4;

const numberFormat = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function text(content: string, cls: string, attrs: Record<string, string | number>): SVGTextElement {
  const t = svgEl("text", { class: cls, ...attrs });
  t.textContent = content;
  return t;
}

export function formatValue(value: number, unit: string | undefined): string {
  const n = numberFormat.format(value);
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ChartOptions {
  /** Box size in stage pixels. */
  width: number;
  height: number;
  /** Bar colour when the chart has no style.color. */
  accent: string;
  /** Categorical palette in fixed order. */
  palette: readonly string[];
}

export function renderChart(el: ChartElement, opts: ChartOptions): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: `0 0 ${r2(opts.width)} ${r2(opts.height)}`, width: "100%", height: "100%", "data-kind": el.kind, class: "chart", role: "img" });
  svg.setAttribute("aria-label", el.data.map((d) => `${d.label}: ${formatValue(d.value, el.unit)}`).join(", "));
  if (el.kind === "bar") drawBars(svg, el, opts);
  else drawDonut(svg, el, opts);
  return svg;
}

/** Column with 4px rounded data end and a square base on the baseline. */
function barPath(x: number, baseline: number, w: number, h: number): string {
  if (h <= 0) return `M ${r2(x)} ${r2(baseline)} h ${r2(w)}`;
  const r = Math.min(BAR_END_RADIUS, w / 2, h);
  const top = baseline - h;
  return [
    `M ${r2(x)} ${r2(baseline)}`,
    `V ${r2(top + r)}`,
    `Q ${r2(x)} ${r2(top)} ${r2(x + r)} ${r2(top)}`,
    `H ${r2(x + w - r)}`,
    `Q ${r2(x + w)} ${r2(top)} ${r2(x + w)} ${r2(top + r)}`,
    `V ${r2(baseline)}`,
    "Z",
  ].join(" ");
}

function drawBars(svg: SVGSVGElement, el: ChartElement, { width, height, accent }: ChartOptions) {
  const color = el.style?.color ?? accent;
  const n = el.data.length;
  const fontSize = Math.max(18, Math.min(40, height * 0.075, (width / n) * 0.3));
  const top = fontSize * 1.6;
  const baseline = height - fontSize * 1.9;
  const plot = Math.max(0, baseline - top);
  const slot = width / n;
  const barW = Math.max(4, Math.min(slot * 0.56, 180, slot - GAP));
  const max = Math.max(...el.data.map((d) => d.value));

  el.data.forEach((d, i) => {
    const cx = slot * i + slot / 2;
    const h = max > 0 ? (d.value / max) * plot : 0;
    svg.append(svgEl("path", { class: "chart-bar", d: barPath(cx - barW / 2, baseline, barW, h), fill: color }));
    svg.append(text(formatValue(d.value, el.unit), "chart-value", { x: r2(cx), y: r2(baseline - h - fontSize * 0.45), "text-anchor": "middle", "font-size": r2(fontSize) }));
    svg.append(text(d.label, "chart-label", { x: r2(cx), y: r2(baseline + fontSize * 1.35), "text-anchor": "middle", "font-size": r2(fontSize * 0.85) }));
  });
  svg.append(svgEl("line", { class: "chart-axis", x1: 0, x2: r2(width), y1: r2(baseline), y2: r2(baseline), "stroke-width": 2 }));
}

const point = (cx: number, cy: number, r: number, a: number) => `${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`;

/**
 * Annular sector from angle a0 to a1 (radians, 0 = 3 o'clock, clockwise) with
 * a constant-width gap: each edge is pulled in by gap/2 along both radii.
 */
export function donutSlicePath(cx: number, cy: number, outer: number, inner: number, a0: number, a1: number, gap: number): string {
  const dOut = gap / 2 / outer;
  const dIn = gap / 2 / inner;
  const o0 = a0 + dOut;
  const o1 = a1 - dOut;
  const i0 = a0 + dIn;
  const i1 = a1 - dIn;
  // A slice thinner than the gap is not drawn (its legend entry still shows it).
  if (o1 <= o0 || i1 <= i0) return "";
  const largeOut = o1 - o0 > Math.PI ? 1 : 0;
  const largeIn = i1 - i0 > Math.PI ? 1 : 0;
  return [
    `M ${point(cx, cy, outer, o0)}`,
    `A ${r2(outer)} ${r2(outer)} 0 ${largeOut} 1 ${point(cx, cy, outer, o1)}`,
    `L ${point(cx, cy, inner, i1)}`,
    `A ${r2(inner)} ${r2(inner)} 0 ${largeIn} 0 ${point(cx, cy, inner, i0)}`,
    "Z",
  ].join(" ");
}

function drawDonut(svg: SVGSVGElement, el: ChartElement, { width, height, palette }: ChartOptions) {
  const size = Math.min(height, width * 0.5);
  const outer = size / 2 - 4;
  const thickness = Math.max(12, outer * 0.3);
  const inner = Math.max(1, outer - thickness);
  const cx = size / 2;
  const cy = height / 2;
  const total = el.data.reduce((sum, d) => sum + d.value, 0);
  const colorOf = (i: number) => palette[i] ?? palette[palette.length - 1] ?? "#888888";

  const ring = svgEl("g", { class: "chart-ring" });
  const nonZero = el.data.filter((d) => d.value > 0).length;
  if (total === 0) {
    ring.append(svgEl("circle", { class: "chart-track", cx: r2(cx), cy: r2(cy), r: r2(outer - thickness / 2), fill: "none", "stroke-width": r2(thickness) }));
  } else {
    let angle = -Math.PI / 2;
    el.data.forEach((d, i) => {
      if (d.value <= 0) return;
      const sweep = (d.value / total) * Math.PI * 2;
      const path = nonZero === 1 ? "" : donutSlicePath(cx, cy, outer, inner, angle, angle + sweep, GAP);
      angle += sweep;
      if (nonZero !== 1 && !path) return;
      const slice =
        nonZero === 1
          ? svgEl("circle", { cx: r2(cx), cy: r2(cy), r: r2(outer - thickness / 2), fill: "none", stroke: colorOf(i), "stroke-width": r2(thickness) })
          : svgEl("path", { d: path, fill: colorOf(i) });
      slice.classList.add("chart-slice");
      ring.append(slice);
    });
  }
  svg.append(ring);

  const totalSize = Math.max(20, inner * 0.5);
  svg.append(text(formatValue(total, el.unit), "chart-total", { x: r2(cx), y: r2(cy), "text-anchor": "middle", "dominant-baseline": "central", "font-size": r2(totalSize) }));

  const legendX = size + Math.max(24, width * 0.04);
  const rowFont = Math.max(18, Math.min(38, height / (el.data.length * 2.1)));
  const rowH = rowFont * 1.8;
  const startY = cy - (rowH * el.data.length) / 2 + rowH / 2;
  const legend = svgEl("g", { class: "chart-legend" });
  el.data.forEach((d, i) => {
    const y = startY + i * rowH;
    const item = svgEl("g", { class: "chart-legend-item" });
    const swatch = rowFont * 0.7;
    item.append(svgEl("rect", { class: "chart-swatch", x: r2(legendX), y: r2(y - swatch / 2), width: r2(swatch), height: r2(swatch), rx: 3, fill: colorOf(i) }));
    item.append(text(d.label, "chart-label", { x: r2(legendX + swatch * 1.7), y: r2(y), "dominant-baseline": "central", "font-size": r2(rowFont) }));
    item.append(text(formatValue(d.value, el.unit), "chart-value", { x: r2(width), y: r2(y), "text-anchor": "end", "dominant-baseline": "central", "font-size": r2(rowFont) }));
    legend.append(item);
  });
  svg.append(legend);
}
