import type { DecorElement } from "../../../shared/deck.ts";

// Built-in decorative shapes drawn in the element's own pixel space, so they
// keep their proportions in any box. Decks pick a shape by name; they never
// supply SVG.

const SVG_NS = "http://www.w3.org/2000/svg";
const r2 = (n: number) => Math.round(n * 100) / 100;

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) {
    // A theme token arrives as `var(--theme-…)`, which cannot live in a presentation attribute; a hex keeps the attribute.
    if ((k === "fill" || k === "stroke") && typeof v === "string" && v.startsWith("var(")) node.style.setProperty(k, v);
    else node.setAttribute(k, String(v));
  }
  return node;
}

type Shape = DecorElement["shape"];

/** `color` is a hex or a resolved `var(--theme-…)` (see shared/theme-colors.ts). */
export function renderDecor(shape: Shape, color: string, width: number, height: number): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: `0 0 ${r2(width)} ${r2(height)}`, width: "100%", height: "100%", class: `decor decor-${shape}` }) as SVGSVGElement;
  svg.setAttribute("aria-hidden", "true");
  for (const node of SHAPES[shape](width, height, color)) svg.append(node);
  return svg;
}

const stroke = (color: string, w: number) => ({ fill: "none", stroke: color, "stroke-width": r2(w), "stroke-linecap": "round", "stroke-linejoin": "round" });

const SHAPES: Record<Shape, (w: number, h: number, color: string) => SVGElement[]> = {
  blob: (w, h, color) => {
    // Organic closed curve on a 100x100 grid, scaled to the box.
    const sx = w / 100;
    const sy = h / 100;
    const pts = [
      [50, 4], [78, 12], [96, 40], [88, 74], [60, 96], [26, 90], [6, 64], [10, 28],
    ] as const;
    const at = (i: number) => pts[(i + pts.length) % pts.length]!;
    let d = `M ${r2(at(0)[0] * sx)} ${r2(at(0)[1] * sy)}`;
    for (let i = 0; i < pts.length; i++) {
      // Catmull-Rom to Bézier for a smooth closed outline.
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${r2(c1[0]! * sx)} ${r2(c1[1]! * sy)} ${r2(c2[0]! * sx)} ${r2(c2[1]! * sy)} ${r2(p2[0] * sx)} ${r2(p2[1] * sy)}`;
    }
    return [svgEl("path", { d: `${d} Z`, fill: color })];
  },
  wave: (w, h, color) => {
    const sw = Math.max(3, Math.min(h * 0.08, 14));
    const waves = 3;
    const step = w / waves;
    const mid = h / 2;
    const amp = (h - sw) / 2.4;
    let d = `M 0 ${r2(mid)}`;
    for (let i = 0; i < waves; i++) {
      const x = i * step;
      d += ` C ${r2(x + step / 4)} ${r2(mid - amp)} ${r2(x + step / 4)} ${r2(mid - amp)} ${r2(x + step / 2)} ${r2(mid)}`;
      d += ` C ${r2(x + (3 * step) / 4)} ${r2(mid + amp)} ${r2(x + (3 * step) / 4)} ${r2(mid + amp)} ${r2(x + step)} ${r2(mid)}`;
    }
    return [svgEl("path", { d, ...stroke(color, sw) })];
  },
  dots: (w, h, color) => {
    const gap = Math.max(24, Math.min(w, h) / 6);
    const r = gap * 0.14;
    const out: SVGElement[] = [];
    for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) out.push(svgEl("circle", { cx: r2(x), cy: r2(y), r: r2(r), fill: color }));
    return out;
  },
  rings: (w, h, color) => {
    const max = Math.min(w, h) / 2;
    const sw = Math.max(2, max * 0.035);
    return [0.25, 0.5, 0.75, 1].map((f) => svgEl("circle", { cx: r2(w / 2), cy: r2(h / 2), r: r2(max * f - sw), ...stroke(color, sw) }));
  },
  arc: (w, h, color) => {
    const sw = Math.max(6, Math.min(w, h) * 0.08);
    const r = Math.min(w, h) - sw;
    return [svgEl("path", { d: `M ${r2(sw / 2)} ${r2(h - sw / 2)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(sw / 2 + r)} ${r2(h - sw / 2 - r)}`, ...stroke(color, sw) })];
  },
  squiggle: (w, h, color) => {
    const sw = Math.max(4, Math.min(h * 0.12, 16));
    const turns = 6;
    const step = (w - sw) / turns;
    const top = sw;
    const bottom = h - sw;
    let d = `M ${r2(sw / 2)} ${r2(bottom)}`;
    for (let i = 0; i < turns; i++) {
      const x = sw / 2 + i * step;
      const y = i % 2 === 0 ? top : bottom;
      d += ` Q ${r2(x + step / 2)} ${r2(y)} ${r2(x + step)} ${r2(i % 2 === 0 ? bottom : top)}`;
    }
    return [svgEl("path", { d, ...stroke(color, sw) })];
  },
  star: (w, h, color) => {
    // Four-point sparkle with concave sides.
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const k = 0.18;
    const d = [
      `M ${r2(cx)} ${r2(cy - ry)}`,
      `Q ${r2(cx + rx * k)} ${r2(cy - ry * k)} ${r2(cx + rx)} ${r2(cy)}`,
      `Q ${r2(cx + rx * k)} ${r2(cy + ry * k)} ${r2(cx)} ${r2(cy + ry)}`,
      `Q ${r2(cx - rx * k)} ${r2(cy + ry * k)} ${r2(cx - rx)} ${r2(cy)}`,
      `Q ${r2(cx - rx * k)} ${r2(cy - ry * k)} ${r2(cx)} ${r2(cy - ry)}`,
      "Z",
    ].join(" ");
    return [svgEl("path", { d, fill: color })];
  },
  grid: (w, h, color) => {
    const gap = Math.max(32, Math.min(w, h) / 6);
    const out: SVGElement[] = [];
    for (let x = 0; x <= w + 0.5; x += gap) out.push(svgEl("line", { x1: r2(x), y1: 0, x2: r2(x), y2: r2(h), stroke: color, "stroke-width": 2 }));
    for (let y = 0; y <= h + 0.5; y += gap) out.push(svgEl("line", { x1: 0, y1: r2(y), x2: r2(w), y2: r2(y), stroke: color, "stroke-width": 2 }));
    return out;
  },
};
