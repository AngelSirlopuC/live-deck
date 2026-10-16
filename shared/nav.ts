import { slideSteps } from "./deck-core.ts";
import type { Slide } from "./deck.ts";

export interface Position {
  slide: number;
  step: number;
}

type NavSlide = Pick<Slide, "elements">;

/** PowerPoint "next": reveal the next fragment, otherwise go to the next slide. */
export function nextPosition(slides: readonly NavSlide[], pos: Position): Position {
  const current = slides[pos.slide];
  if (current && pos.step < slideSteps(current)) return { slide: pos.slide, step: pos.step + 1 };
  if (pos.slide < slides.length - 1) return { slide: pos.slide + 1, step: 0 };
  return pos;
}

/** PowerPoint "previous": hide the last fragment, otherwise show the fully built previous slide. */
export function prevPosition(slides: readonly NavSlide[], pos: Position): Position {
  if (pos.step > 0) return { slide: pos.slide, step: pos.step - 1 };
  const previous = slides[pos.slide - 1];
  if (previous) return { slide: pos.slide - 1, step: slideSteps(previous) };
  return pos;
}

export function isAfter(a: Position, b: Position): boolean {
  return a.slide > b.slide || (a.slide === b.slide && a.step > b.step);
}

/** "Next" while exploring: bounded by the presenter's high water, or free when `limit` is null. */
export function exploreNext(slides: readonly NavSlide[], pos: Position, limit: Position | null): Position {
  const next = nextPosition(slides, pos);
  return limit && isAfter(next, limit) ? pos : next;
}
