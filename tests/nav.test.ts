import { describe, expect, it } from "vitest";
import { exploreNext, isAfter, nextPosition, prevPosition } from "../shared/nav.ts";

const slides = [
  { elements: [] },
  { elements: [{ fragment: 1 }, { fragment: 2 }, {}] },
  { elements: [{}] },
] as any;

describe("deck navigation", () => {
  it("advances fragments before moving to the next slide", () => {
    expect(nextPosition(slides, { slide: 0, step: 0 })).toEqual({ slide: 1, step: 0 });
    expect(nextPosition(slides, { slide: 1, step: 0 })).toEqual({ slide: 1, step: 1 });
    expect(nextPosition(slides, { slide: 1, step: 2 })).toEqual({ slide: 2, step: 0 });
  });

  it("stays on the last slide", () => {
    expect(nextPosition(slides, { slide: 2, step: 0 })).toEqual({ slide: 2, step: 0 });
  });

  it("goes back through fragments and lands on the fully built previous slide", () => {
    expect(prevPosition(slides, { slide: 1, step: 2 })).toEqual({ slide: 1, step: 1 });
    expect(prevPosition(slides, { slide: 2, step: 0 })).toEqual({ slide: 1, step: 2 });
    expect(prevPosition(slides, { slide: 0, step: 0 })).toEqual({ slide: 0, step: 0 });
  });
});

describe("explore navigation", () => {
  it("never goes past the presenter's high water", () => {
    const limit = { slide: 1, step: 1 };
    expect(exploreNext(slides, { slide: 1, step: 0 }, limit)).toEqual({ slide: 1, step: 1 });
    expect(exploreNext(slides, { slide: 1, step: 1 }, limit)).toEqual({ slide: 1, step: 1 });
    expect(exploreNext(slides, { slide: 0, step: 0 }, limit)).toEqual({ slide: 1, step: 0 });
  });

  it("goes anywhere when the whole deck is unlocked", () => {
    expect(exploreNext(slides, { slide: 1, step: 2 }, null)).toEqual({ slide: 2, step: 0 });
  });

  it("knows whether a position is still behind the limit", () => {
    expect(isAfter({ slide: 2, step: 0 }, { slide: 1, step: 2 })).toBe(true);
    expect(isAfter({ slide: 1, step: 2 }, { slide: 1, step: 2 })).toBe(false);
  });
});
