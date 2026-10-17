import type { PublicSlide, RenderableDeck } from "../../../shared/deck-core.ts";
import type { Box, DeckElement, SlideBackground, TextStyle } from "../../../shared/deck.ts";
import { iconNode } from "../../../shared/icons.ts";
import { THEME_PRESETS, contrastRatio, fontStack, resolveTheme, type PresetName, type ResolvedTheme } from "../../../shared/themes.ts";
import { renderChart } from "./charts.ts";
import { renderDecor } from "./decor.ts";
import { ensurePresetFonts } from "./fonts.ts";

// Slides render on a fixed logical stage and are scaled with a CSS transform,
// so geometry, font sizes, and effect targets are identical on every screen.
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface RenderOptions {
  /** Current fragment step; elements with fragment > step are hidden. */
  step: number;
  /** Session join URL shown by qr elements. */
  joinUrl?: string;
  /** Pre-rendered QR SVG markup (generated locally, never user content). */
  qrSvg?: string;
  /** Base URL for "assets/…" image sources. */
  assetBase?: string;
  /** Fragment step that was just revealed; its elements get an enter animation. */
  enterStep?: number;
  /** Authoring aid for the preview page: dashed outlines with the option letter on quiz zones. */
  showZones?: boolean;
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export function renderSlide(deck: RenderableDeck, index: number, opts: RenderOptions): HTMLElement {
  const slide = deck.slides[index];
  if (!slide) throw new RangeError(`slide ${index} out of range`);
  const theme = resolveTheme(deck.theme);
  const bg = typeof slide.background === "object" ? slide.background : undefined;

  const stage = document.createElement("div");
  stage.className = "stage";
  stage.dataset.slideId = slide.id;
  stage.style.width = px(STAGE_WIDTH);
  stage.style.height = px(STAGE_HEIGHT);
  const ground = typeof slide.background === "string" ? slide.background : (bg?.color ?? theme.colors.background);
  stage.style.setProperty("--theme-bg", ground);
  stage.style.setProperty("--theme-fg", theme.colors.foreground);
  stage.style.setProperty("--theme-accent", theme.colors.accent);
  // Text drawn in the accent (quiz leader rank and share) needs 3:1 on the ground.
  stage.style.setProperty("--theme-accent-ink", contrastRatio(theme.colors.accent, ground) >= 3 ? "var(--theme-accent)" : "var(--theme-fg)");
  stage.style.setProperty("--theme-muted", theme.colors.muted);
  if (theme.colors.surface) stage.style.setProperty("--theme-surface", theme.colors.surface);
  if (theme.preset) applyPreset(stage, theme.preset, theme);

  // A slide background object replaces the preset art; a hex background keeps it.
  const backdrop = bg ? renderBackground(bg, opts) : theme.preset ? renderPresetArt(theme.preset) : null;
  if (backdrop) stage.append(backdrop);

  // Content sits in its own layer so presenter zoom can transform it while the
  // effects layer (focus mask, ripples) stays in stage coordinates.
  const layer = document.createElement("div");
  layer.className = "stage-layer";
  for (const el of slide.elements) layer.append(renderElement(el, opts, theme));
  if (slide.layout === "quiz" && slide.quiz) layer.append(renderQuiz(slide, opts));
  const fx = document.createElement("div");
  fx.className = "stage-fx";
  stage.append(layer, fx);
  return stage;
}

/** Preset tokens on the stage: fonts, card, heading and on-accent text. */
function applyPreset(stage: HTMLElement, name: PresetName, theme: ResolvedTheme) {
  const preset = THEME_PRESETS[name];
  ensurePresetFonts(name);
  stage.dataset.preset = name;
  const vars: Record<string, string> = {
    "--font-display": fontStack(preset.fonts.display),
    "--font-body": fontStack(preset.fonts.body),
    "--font-mono": fontStack(preset.fonts.mono),
    "--card-bg": preset.card.background,
    "--card-radius": preset.card.radius,
    "--card-border": preset.card.border,
    "--card-shadow": preset.card.shadow,
    "--card-padding": preset.card.padding,
    "--heading-weight": String(preset.heading.weight),
    "--heading-tracking": preset.heading.letterSpacing,
    "--heading-transform": preset.heading.textTransform,
  };
  if (preset.fonts.accent) vars["--font-accent"] = fontStack(preset.fonts.accent);
  if (theme.colors.onAccent) vars["--theme-on-accent"] = theme.colors.onAccent;
  for (const [k, v] of Object.entries(vars)) stage.style.setProperty(k, v);
}

function layerDiv(cls: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = cls;
  return div;
}

function renderPresetArt(name: PresetName): HTMLElement | null {
  const preset = THEME_PRESETS[name];
  if (!preset.art && !preset.pattern) return null;
  const wrap = layerDiv("stage-bg stage-bg-preset");
  if (preset.art) {
    const art = layerDiv("stage-bg-art");
    art.style.setProperty("--bg-art", preset.art);
    wrap.append(art);
  }
  if (preset.pattern) {
    const pattern = layerDiv("stage-bg-pattern");
    pattern.dataset.pattern = preset.pattern;
    wrap.append(pattern);
  }
  return wrap;
}

// Layers paint bottom to top: color (the stage ground), gradient, image, pattern, dim.
function renderBackground(bg: SlideBackground, opts: RenderOptions): HTMLElement | null {
  const wrap = layerDiv("stage-bg");
  if (bg.gradient) {
    const g = layerDiv("stage-bg-gradient");
    g.style.setProperty("--bg-gradient", `linear-gradient(${bg.gradient.angle ?? 135}deg, ${bg.gradient.from}, ${bg.gradient.to})`);
    wrap.append(g);
  }
  if (bg.image) {
    const img = document.createElement("img");
    img.className = "stage-bg-image";
    img.alt = "";
    img.decoding = "async";
    img.src = assetUrl(bg.image, opts);
    wrap.append(img);
  }
  if (bg.pattern) {
    const p = layerDiv("stage-bg-pattern");
    p.dataset.pattern = bg.pattern;
    wrap.append(p);
  }
  if (bg.dim) {
    const dim = layerDiv("stage-bg-dim");
    dim.style.opacity = String(bg.dim);
    wrap.append(dim);
  }
  return wrap.childElementCount ? wrap : null;
}

function assetUrl(src: string, opts: RenderOptions): string {
  return src.startsWith("assets/") ? `${opts.assetBase ?? ""}${src}` : src;
}

function place(node: HTMLElement, el: DeckElement) {
  node.dataset.elementId = el.id;
  node.classList.add("el", `el-${el.type}`);
  node.style.left = px(el.box.x * STAGE_WIDTH);
  node.style.top = px(el.box.y * STAGE_HEIGHT);
  node.style.width = px(el.box.w * STAGE_WIDTH);
  node.style.height = px(el.box.h * STAGE_HEIGHT);
}

function applyText(node: HTMLElement, style: TextStyle | undefined) {
  if (!style) return;
  if (style.fontSize) node.style.fontSize = px(style.fontSize);
  if (style.fontWeight) node.style.fontWeight = String(style.fontWeight);
  if (style.font) node.dataset.font = style.font;
  if (style.italic) node.style.fontStyle = "italic";
  if (style.color) node.style.color = style.color;
  if (style.align) node.style.textAlign = style.align;
  if (style.valign) node.dataset.valign = style.valign;
  if (style.lineHeight) node.style.lineHeight = String(style.lineHeight);
  if (style.background) node.style.background = style.background;
  if (style.radius !== undefined) node.style.borderRadius = px(style.radius);
  if (style.padding !== undefined) node.style.padding = px(style.padding);
  if (style.card) node.classList.add("card");
  if (style.uppercase) node.style.textTransform = "uppercase";
  if (style.tracking !== undefined) node.style.letterSpacing = `${style.tracking}em`;
}

function renderElement(el: DeckElement, opts: RenderOptions, theme: ResolvedTheme): HTMLElement {
  const node = document.createElement("div");
  place(node, el);
  if (el.fragment !== undefined) {
    node.dataset.fragment = String(el.fragment);
    node.hidden = el.fragment > opts.step;
    if (el.fragment === opts.enterStep) node.classList.add("enter");
  }

  switch (el.type) {
    case "text": {
      const inner = document.createElement("div");
      inner.className = "el-text-inner";
      if (el.style?.mark) {
        // Inline span so the highlight follows each wrapped line.
        const mark = document.createElement("span");
        mark.className = "el-mark";
        mark.textContent = el.text;
        inner.append(mark);
      } else {
        inner.textContent = el.text;
      }
      node.append(inner);
      applyText(node, el.style);
      break;
    }
    case "image": {
      const img = document.createElement("img");
      img.alt = el.alt;
      img.decoding = "async";
      img.src = assetUrl(el.src, opts);
      img.style.objectFit = el.fit ?? "contain";
      if (el.style?.radius !== undefined) img.style.borderRadius = px(el.style.radius);
      node.append(img);
      break;
    }
    case "shape": {
      node.dataset.shape = el.shape;
      const s = el.style ?? {};
      if (el.shape === "line") {
        node.style.borderTop = `${px(s.strokeWidth ?? 4)} solid ${s.stroke ?? "var(--theme-fg)"}`;
        node.style.height = "0px";
      } else {
        node.style.background = s.fill ?? "transparent";
        if (s.stroke) node.style.border = `${px(s.strokeWidth ?? 2)} solid ${s.stroke}`;
        node.style.borderRadius = el.shape === "ellipse" ? "50%" : px(s.radius ?? 0);
      }
      break;
    }
    case "qr": {
      if (el.style?.color) node.style.color = el.style.color;
      if (el.style?.background) node.style.background = el.style.background;
      const code = document.createElement("div");
      code.className = "qr-code";
      const caption = document.createElement("div");
      caption.className = "qr-caption";
      if (opts.joinUrl && opts.qrSvg) {
        // qrSvg is produced by the qrcode library from our own URL.
        code.innerHTML = opts.qrSvg;
        caption.textContent = opts.joinUrl.replace(/^https?:\/\//, "");
      } else {
        code.classList.add("qr-placeholder");
        caption.textContent = "El QR aparece al presentar";
      }
      node.append(code, caption);
      break;
    }
    case "icon": {
      const s = el.style ?? {};
      // Graphics need 3:1 against their ground; a faint accent (yellow on paper) falls back to the text colour.
      const ground = s.background ?? theme.colors.background;
      node.style.color = s.color ?? (contrastRatio(theme.colors.accent, ground) >= 3 ? "var(--theme-accent)" : "var(--theme-fg)");
      if (s.background) node.style.background = s.background;
      if (s.radius !== undefined) node.style.borderRadius = px(s.radius);
      if (s.background) {
        node.classList.add("has-background");
        // Percent padding would resolve against the 1920 px stage, not the icon box.
        node.style.padding = px(Math.min(el.box.w * STAGE_WIDTH, el.box.h * STAGE_HEIGHT) * 0.18);
      }
      const svg = renderIcon(el.name, s.strokeWidth ?? 2);
      if (svg) node.append(svg);
      break;
    }
    case "chart": {
      node.append(renderChart(el, { width: el.box.w * STAGE_WIDTH, height: el.box.h * STAGE_HEIGHT, accent: theme.colors.accent, palette: theme.palette }));
      break;
    }
    case "decor": {
      node.setAttribute("aria-hidden", "true");
      if (el.style?.opacity !== undefined) node.style.opacity = String(el.style.opacity);
      node.append(renderDecor(el.shape, el.style?.color ?? theme.colors.accent, el.box.w * STAGE_WIDTH, el.box.h * STAGE_HEIGHT));
      break;
    }
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Lucide icon from the curated set, built with DOM APIs; unknown names render nothing. */
function renderIcon(name: string, strokeWidth: number): SVGSVGElement | null {
  const nodes = iconNode(name);
  if (!nodes) return null;
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs: Record<string, string> = {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": String(strokeWidth),
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const [tag, props] of nodes) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(props)) if (v !== undefined) child.setAttribute(k, String(v));
    svg.append(child);
  }
  return svg;
}

function renderQuiz(slide: PublicSlide, opts: RenderOptions): HTMLElement {
  const quiz = slide.quiz!;
  const wrap = document.createElement("div");
  wrap.className = "quiz";
  wrap.dataset.optionCount = String(quiz.options.length);
  wrap.dataset.results = quiz.results ?? "ranking";
  wrap.dataset.view = "grid";
  if (quiz.zones) return renderZoneQuiz(wrap, quiz.zones, quiz.options, opts);

  const question = document.createElement("h2");
  question.className = "quiz-question";
  question.textContent = quiz.question;

  const list = document.createElement("ol");
  list.className = "quiz-options";
  quiz.options.forEach((label, i) => {
    const item = document.createElement("li");
    item.className = "quiz-option";
    item.dataset.optionIndex = String(i);
    const key = document.createElement("span");
    key.className = "quiz-key";
    key.textContent = String.fromCharCode(65 + i);
    const text = document.createElement("span");
    text.className = "quiz-label";
    text.textContent = label;
    const bar = document.createElement("span");
    bar.className = "quiz-bar";
    const count = document.createElement("span");
    count.className = "quiz-count";
    const rank = document.createElement("span");
    rank.className = "quiz-rank";
    item.append(bar, rank, key, text, count);
    list.append(item);
  });

  wrap.append(question, list, renderQuizStatus());
  return wrap;
}

function renderQuizStatus(): HTMLElement {
  const status = document.createElement("p");
  status.className = "quiz-status";
  status.setAttribute("aria-live", "polite");
  return status;
}

/**
 * Zone quiz: the question and options are part of the background image, so only
 * the live layer is drawn — one overlay per zone with the same hooks the quiz
 * overlay paints (bar, percentage, rank), plus the status pill.
 */
function renderZoneQuiz(wrap: HTMLElement, zones: Box[], options: string[], opts: RenderOptions): HTMLElement {
  wrap.dataset.layout = "zones";
  zones.forEach((zone, i) => {
    const letter = String.fromCharCode(65 + i);
    const item = document.createElement("div");
    item.className = "quiz-zone";
    item.dataset.optionIndex = String(i);
    item.setAttribute("aria-label", `${letter}: ${options[i] ?? ""}`);
    item.style.left = px(zone.x * STAGE_WIDTH);
    item.style.top = px(zone.y * STAGE_HEIGHT);
    item.style.width = px(zone.w * STAGE_WIDTH);
    item.style.height = px(zone.h * STAGE_HEIGHT);
    const bar = document.createElement("span");
    bar.className = "quiz-bar";
    const rank = document.createElement("span");
    rank.className = "quiz-rank";
    const count = document.createElement("span");
    count.className = "quiz-count";
    item.append(bar, rank, count);
    if (opts.showZones) {
      item.classList.add("has-guide");
      const key = document.createElement("span");
      key.className = "quiz-zone-key";
      key.textContent = letter;
      item.append(key);
    }
    wrap.append(item);
  });
  wrap.append(renderQuizStatus());
  return wrap;
}

/**
 * Scales a stage to fit its host while keeping 16:9, and keeps it fitted on resize.
 * Returns a disposer.
 */
export function fitStage(host: HTMLElement, stage: HTMLElement): () => void {
  const apply = () => {
    const scale = Math.min(host.clientWidth / STAGE_WIDTH, host.clientHeight / STAGE_HEIGHT) || 0;
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    host.style.setProperty("--stage-scale", String(scale));
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(host);
  return () => ro.disconnect();
}
