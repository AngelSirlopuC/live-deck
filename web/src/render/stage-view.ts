import type { RenderableDeck } from "../../../shared/deck.ts";
import type { Position } from "../../../shared/nav.ts";
import { fitStage, renderSlide, type RenderOptions } from "./slide.ts";

/** Owns a 16:9 host element and swaps slides into it with a short transition. */
export class StageView {
  readonly host: HTMLElement;
  private stage: HTMLElement | null = null;
  private disposeFit: (() => void) | null = null;
  private last: Position | null = null;
  private deck: RenderableDeck;
  private extra: Omit<RenderOptions, "step" | "enterStep">;

  constructor(host: HTMLElement, deck: RenderableDeck, extra: Omit<RenderOptions, "step" | "enterStep"> = {}) {
    this.host = host;
    this.deck = deck;
    this.extra = extra;
    host.classList.add("stage-host");
  }

  get current(): HTMLElement | null {
    return this.stage;
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
  }

  destroy() {
    this.disposeFit?.();
    this.stage?.remove();
  }
}
