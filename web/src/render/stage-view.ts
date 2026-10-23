import type { RenderableDeck } from "../../../shared/deck-core.ts";
import { effectRect, zoomTransform, type PersistentEffect } from "../../../shared/effects.ts";
import type { Position } from "../../../shared/nav.ts";
import type { QuizView } from "../../../shared/protocol.ts";
import type { AskView } from "../../../shared/ask.ts";
import { applyAskView } from "./ask-overlay.ts";
import { applyQuizView, type QuizOverlayOptions } from "./quiz-overlay.ts";
import { STAGE_HEIGHT, STAGE_WIDTH, fitStage, renderSlide, type RenderOptions } from "./slide.ts";

interface Zoom {
  scale: number;
  tx: number;
  ty: number;
}

const NO_ZOOM: Zoom = { scale: 1, tx: 0, ty: 0 };

/** Owns a 16:9 host element, swaps slides into it, and renders presenter effects. */
/** The laser disappears when the presenter's cursor stops reporting for this long. */
const LASER_IDLE_MS = 4000;

export class StageView {
  readonly host: HTMLElement;
  private stage: HTMLElement | null = null;
  private disposeFit: (() => void) | null = null;
  private last: Position | null = null;
  private deck: RenderableDeck;
  private extra: Omit<RenderOptions, "step" | "enterStep">;
  private effects: PersistentEffect[] = [];
  private laserIdle: ReturnType<typeof setTimeout> | undefined;
  private zoom: Zoom = NO_ZOOM;
  private quizState: { view: QuizView | null; opts: QuizOverlayOptions } = { view: null, opts: {} };
  private asks: Record<string, AskView> = {};

  constructor(host: HTMLElement, deck: RenderableDeck, extra: Omit<RenderOptions, "step" | "enterStep"> = {}) {
    this.host = host;
    this.deck = deck;
    this.extra = extra;
    host.classList.add("stage-host");
  }

  get current(): HTMLElement | null {
    return this.stage;
  }

  get position(): Position | null {
    return this.last;
  }

  setOptions(extra: Omit<RenderOptions, "step" | "enterStep">) {
    this.extra = { ...this.extra, ...extra };
    if (this.last) this.show(this.last, { force: true });
  }

  show(pos: Position, { force = false } = {}) {
    const prev = this.last;
    if (!force && prev && prev.slide === pos.slide && prev.step === pos.step) return;
    const sameSlide = prev?.slide === pos.slide;
    const enterStep = sameSlide && prev && pos.step > prev.step ? pos.step : undefined;
    const next = renderSlide(this.deck, pos.slide, { ...this.extra, step: pos.step, enterStep });
    if (!sameSlide && prev) next.classList.add("stage-enter");

    this.disposeFit?.();
    this.stage?.remove();
    this.host.append(next);
    this.stage = next;
    this.disposeFit = fitStage(this.host, next);
    this.last = pos;
    if (!sameSlide) this.effects = [];
    this.applyEffect(false);
    applyQuizView(next, this.quizState.view, this.quizState.opts);
    applyAskView(next, this.askFor(pos.slide));
  }

  /** Live answers for open-question slides, by slide id; the slide on screen picks its own. */
  setAsks(asks: Record<string, AskView>) {
    this.asks = asks;
    if (this.stage && this.last) applyAskView(this.stage, this.askFor(this.last.slide));
  }

  private askFor(slide: number): AskView | null {
    const id = this.deck.slides[slide]?.id;
    return id ? (this.asks[id] ?? null) : null;
  }

  /** Paints the quiz state of the slide currently shown. */
  setQuiz(view: QuizView | null, opts: QuizOverlayOptions = {}) {
    this.quizState = { view, opts };
    if (this.stage) applyQuizView(this.stage, view, opts);
  }

  /** Re-measures the host now; for layout changes a ResizeObserver may report late (e.g. a backgrounded tab). */
  refit() {
    if (!this.stage) return;
    this.disposeFit?.();
    this.disposeFit = fitStage(this.host, this.stage);
  }

  /** Shows the presenter's persistent effects (focus and/or zoom) on the current slide. */
  setEffects(effects: readonly PersistentEffect[]) {
    if (JSON.stringify(effects) === JSON.stringify(this.effects)) return;
    this.effects = [...effects];
    this.applyEffect(true);
  }

  /** One-shot pulse at a normalized point of the slide. */
  ripple(x: number, y: number) {
    const fx = this.stage?.querySelector<HTMLElement>(".stage-fx");
    if (!fx) return;
    const dot = document.createElement("div");
    dot.className = "fx-ripple";
    // Ripples are given in slide coordinates; map them through the zoom.
    dot.style.left = `${x * STAGE_WIDTH * this.zoom.scale + this.zoom.tx}px`;
    dot.style.top = `${y * STAGE_HEIGHT * this.zoom.scale + this.zoom.ty}px`;
    for (let i = 0; i < 3; i++) dot.append(document.createElement("span"));
    fx.append(dot);
    setTimeout(() => dot.remove(), 1400);
  }

  /** Presenter's live cursor at a normalized point of the slide; null hides it. */
  laser(at: { x: number; y: number } | null) {
    const fx = this.stage?.querySelector<HTMLElement>(".stage-fx");
    if (!fx) return;
    clearTimeout(this.laserIdle);
    let dot = fx.querySelector<HTMLElement>(".fx-laser");
    if (!at) {
      dot?.remove();
      return;
    }
    const fresh = !dot;
    if (!dot) {
      dot = document.createElement("div");
      dot.className = "fx-laser";
      fx.append(dot);
    }
    dot.classList.toggle("is-fresh", fresh);
    dot.style.transform = `translate(${at.x * STAGE_WIDTH * this.zoom.scale + this.zoom.tx}px, ${at.y * STAGE_HEIGHT * this.zoom.scale + this.zoom.ty}px)`;
    // A lost "hide" message must not leave a dot stuck on screen.
    this.laserIdle = setTimeout(() => dot?.remove(), LASER_IDLE_MS);
  }

  /** Converts a viewport point to normalized slide coordinates, undoing the zoom. */
  toSlidePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.stage) return null;
    const r = this.stage.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const sx = ((clientX - r.left) / r.width) * STAGE_WIDTH;
    const sy = ((clientY - r.top) / r.height) * STAGE_HEIGHT;
    const x = (sx - this.zoom.tx) / this.zoom.scale / STAGE_WIDTH;
    const y = (sy - this.zoom.ty) / this.zoom.scale / STAGE_HEIGHT;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }

  private applyEffect(animate: boolean) {
    const stage = this.stage;
    const pos = this.last;
    if (!stage || !pos) return;
    const layer = stage.querySelector<HTMLElement>(".stage-layer")!;
    const fx = stage.querySelector<HTMLElement>(".stage-fx")!;
    stage.classList.toggle("fx-animate", animate);

    const slide = this.deck.slides[pos.slide]!;
    const rectOf = (kind: PersistentEffect["kind"]) => {
      const e = this.effects.find((x) => x.kind === kind);
      return e ? effectRect(slide, e.target) : null;
    };
    const zoomRect = rectOf("zoom");
    const rect = rectOf("focus");

    // Zoom: scale the content so the rect fills the stage, without exposing edges.
    if (zoomRect) {
      const z = zoomTransform(zoomRect);
      const tx = Math.min(0, Math.max(STAGE_WIDTH - STAGE_WIDTH * z.scale, STAGE_WIDTH / 2 - z.cx * STAGE_WIDTH * z.scale));
      const ty = Math.min(0, Math.max(STAGE_HEIGHT - STAGE_HEIGHT * z.scale, STAGE_HEIGHT / 2 - z.cy * STAGE_HEIGHT * z.scale));
      this.zoom = { scale: z.scale, tx, ty };
    } else {
      this.zoom = NO_ZOOM;
    }
    layer.style.transform = this.zoom === NO_ZOOM ? "" : `translate(${this.zoom.tx}px, ${this.zoom.ty}px) scale(${this.zoom.scale})`;
    stage.dataset.effect = this.effects.map((e) => e.kind).join(" ");

    // Focus: darken everything except the rect, mapped through the zoom.
    let mask = fx.querySelector<HTMLElement>(".fx-focus");
    if (rect) {
      if (!mask) {
        mask = document.createElement("div");
        mask.className = "fx-focus";
        if (animate) mask.classList.add("fx-focus-enter");
        fx.prepend(mask);
      }
      const { scale, tx, ty } = this.zoom;
      mask.style.left = `${rect.x * STAGE_WIDTH * scale + tx}px`;
      mask.style.top = `${rect.y * STAGE_HEIGHT * scale + ty}px`;
      mask.style.width = `${rect.w * STAGE_WIDTH * scale}px`;
      mask.style.height = `${rect.h * STAGE_HEIGHT * scale}px`;
    } else {
      mask?.remove();
    }
  }

  destroy() {
    this.disposeFit?.();
    this.stage?.remove();
  }
}
