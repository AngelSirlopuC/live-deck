import type { RenderableDeck } from "../../../shared/deck-core.ts";
import { effectRect, zoomTransform, type PersistentEffect } from "../../../shared/effects.ts";
import type { Position } from "../../../shared/nav.ts";
import type { QuizView } from "../../../shared/protocol.ts";
import { applyQuizView, type QuizOverlayOptions } from "./quiz-overlay.ts";
import { STAGE_HEIGHT, STAGE_WIDTH, fitStage, renderSlide, type RenderOptions } from "./slide.ts";

interface Zoom {
  scale: number;
  tx: number;
  ty: number;
}

const NO_ZOOM: Zoom = { scale: 1, tx: 0, ty: 0 };

/** Owns a 16:9 host element, swaps slides into it, and renders presenter effects. */
export class StageView {
  readonly host: HTMLElement;
  private stage: HTMLElement | null = null;
  private disposeFit: (() => void) | null = null;
  private last: Position | null = null;
  private deck: RenderableDeck;
  private extra: Omit<RenderOptions, "step" | "enterStep">;
  private effect: PersistentEffect | null = null;
  private zoom: Zoom = NO_ZOOM;
  private quizState: { view: QuizView | null; opts: QuizOverlayOptions } = { view: null, opts: {} };

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
    if (!sameSlide) this.effect = null;
    this.applyEffect(false);
    applyQuizView(next, this.quizState.view, this.quizState.opts);
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

  /** Shows (or clears) the presenter's persistent effect on the current slide. */
  setEffect(effect: PersistentEffect | null) {
    if (JSON.stringify(effect) === JSON.stringify(this.effect)) return;
    this.effect = effect;
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
    const rect = this.effect ? effectRect(slide, this.effect.target) : null;

    // Zoom: scale the content so the rect fills the stage, without exposing edges.
    if (this.effect?.kind === "zoom" && rect) {
      const z = zoomTransform(rect);
      const tx = Math.min(0, Math.max(STAGE_WIDTH - STAGE_WIDTH * z.scale, STAGE_WIDTH / 2 - z.cx * STAGE_WIDTH * z.scale));
      const ty = Math.min(0, Math.max(STAGE_HEIGHT - STAGE_HEIGHT * z.scale, STAGE_HEIGHT / 2 - z.cy * STAGE_HEIGHT * z.scale));
      this.zoom = { scale: z.scale, tx, ty };
    } else {
      this.zoom = NO_ZOOM;
    }
    layer.style.transform = this.zoom === NO_ZOOM ? "" : `translate(${this.zoom.tx}px, ${this.zoom.ty}px) scale(${this.zoom.scale})`;
    stage.dataset.effect = this.effect?.kind ?? "";

    // Focus: darken everything except the rect.
    let mask = fx.querySelector<HTMLElement>(".fx-focus");
    if (this.effect?.kind === "focus" && rect) {
      if (!mask) {
        mask = document.createElement("div");
        mask.className = "fx-focus";
        if (animate) mask.classList.add("fx-focus-enter");
        fx.prepend(mask);
      }
      mask.style.left = `${rect.x * STAGE_WIDTH}px`;
      mask.style.top = `${rect.y * STAGE_HEIGHT}px`;
      mask.style.width = `${rect.w * STAGE_WIDTH}px`;
      mask.style.height = `${rect.h * STAGE_HEIGHT}px`;
    } else {
      mask?.remove();
    }
  }

  destroy() {
    this.disposeFit?.();
    this.stage?.remove();
  }
}
