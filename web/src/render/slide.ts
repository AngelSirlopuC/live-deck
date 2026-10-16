import { DEFAULT_THEME, type PublicSlide, type RenderableDeck } from "../../../shared/deck-core.ts";
import type { DeckElement, TextStyle } from "../../../shared/deck.ts";

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
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export function renderSlide(deck: RenderableDeck, index: number, opts: RenderOptions): HTMLElement {
  const slide = deck.slides[index];
  if (!slide) throw new RangeError(`slide ${index} out of range`);
  const theme = { ...DEFAULT_THEME, ...deck.theme };

  const stage = document.createElement("div");
  stage.className = "stage";
  stage.dataset.slideId = slide.id;
  stage.style.width = px(STAGE_WIDTH);
  stage.style.height = px(STAGE_HEIGHT);
  stage.style.setProperty("--theme-bg", slide.background ?? theme.background);
  stage.style.setProperty("--theme-fg", theme.foreground);
  stage.style.setProperty("--theme-accent", theme.accent);
  stage.style.setProperty("--theme-muted", theme.muted ?? theme.foreground);

  // Content sits in its own layer so presenter zoom can transform it while the
  // effects layer (focus mask, ripples) stays in stage coordinates.
  const layer = document.createElement("div");
  layer.className = "stage-layer";
  for (const el of slide.elements) layer.append(renderElement(el, opts));
  if (slide.layout === "quiz" && slide.quiz) layer.append(renderQuiz(slide));
  const fx = document.createElement("div");
  fx.className = "stage-fx";
  stage.append(layer, fx);
  return stage;
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
}

function renderElement(el: DeckElement, opts: RenderOptions): HTMLElement {
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
      inner.textContent = el.text;
      node.append(inner);
      applyText(node, el.style);
      break;
    }
    case "image": {
      const img = document.createElement("img");
      img.alt = el.alt;
      img.decoding = "async";
      img.src = el.src.startsWith("assets/") ? `${opts.assetBase ?? ""}${el.src}` : el.src;
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
        caption.textContent = "QR de la sesión";
      }
      node.append(code, caption);
      break;
    }
  }
  return node;
}

function renderQuiz(slide: PublicSlide): HTMLElement {
  const quiz = slide.quiz!;
  const wrap = document.createElement("div");
  wrap.className = "quiz";
  wrap.dataset.optionCount = String(quiz.options.length);

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
    item.append(bar, key, text, count);
    list.append(item);
  });

  const status = document.createElement("p");
  status.className = "quiz-status";
  status.setAttribute("aria-live", "polite");
  wrap.append(question, list, status);
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
