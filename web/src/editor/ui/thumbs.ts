// Slide thumbnails: the real renderer at "all fragments visible", scaled by a
// CSS variable the rail sets once per resize. Structural sharing makes the
// slide object a safe cache key; a theme change invalidates everything.
import type { Deck, Slide, Theme } from "../../../../shared/deck.ts";
import { slideSteps } from "../../../../shared/deck-core.ts";
import { renderSlide } from "../../render/slide.ts";

export interface ThumbCache {
  /** A fresh `.ed-thumb-stage` host for slide `index`; the render is reused while the slide object is unchanged. */
  get(deck: Deck, index: number): HTMLElement;
  /** Renders counted since creation (tests). */
  readonly renders: number;
}

export function createThumbCache(assetBase: string): ThumbCache {
  let theme: Theme | undefined;
  let cache = new Map<Slide, HTMLElement>();
  let renders = 0;
  return {
    get renders() {
      return renders;
    },
    get(deck, index) {
      if (deck.theme !== theme) {
        theme = deck.theme;
        cache = new Map();
      }
      const slide = deck.slides[index];
      if (!slide) throw new RangeError(`slide ${index} out of range`);
      let stage = cache.get(slide);
      if (!stage) {
        renders++;
        stage = renderSlide(deck, index, { step: slideSteps(slide), assetBase });
        stage.style.transform = "translate(-50%, -50%) scale(var(--thumb-scale, 0.1))";
        cache.set(slide, stage);
      }
      const host = document.createElement("div");
      host.className = "ed-thumb-stage";
      host.setAttribute("aria-hidden", "true");
      // The same slide can show in the rail and the overview at once, so each host gets its own copy.
      host.append(stage.cloneNode(true));
      return host;
    },
  };
}

/** Sets `--thumb-scale` on `root` to its thumbnails' width / 1920. */
export function applyThumbScale(root: HTMLElement, sampleSelector: string): void {
  const sample = root.querySelector<HTMLElement>(sampleSelector);
  const width = sample?.clientWidth ?? 0;
  if (width > 0) root.style.setProperty("--thumb-scale", String(width / 1920));
}

/** Keeps `--thumb-scale` on `root` current as it resizes. */
export function observeThumbScale(root: HTMLElement, sampleSelector: string): () => void {
  applyThumbScale(root, sampleSelector);
  if (typeof ResizeObserver === "undefined") return () => {};
  const ro = new ResizeObserver(() => applyThumbScale(root, sampleSelector));
  ro.observe(root);
  return () => ro.disconnect();
}
