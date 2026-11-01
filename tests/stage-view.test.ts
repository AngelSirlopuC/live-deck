// @vitest-environment jsdom
// StageView decides when entrances play: on every slide change (first show
// included) for the always-visible elements, and on a forward step for that
// step's elements only. Re-renders of the same position stay still.
import { beforeAll, describe, expect, it } from "vitest";
import type { Deck } from "../shared/deck.ts";
import { StageView } from "../web/src/render/stage-view.ts";

const deck: Deck = {
  version: 1,
  title: "T",
  slides: [
    {
      id: "s1",
      elements: [
        { id: "always", type: "text", box: { x: 0, y: 0, w: 0.5, h: 0.1 }, text: "a" },
        { id: "later", type: "text", box: { x: 0, y: 0.5, w: 0.5, h: 0.1 }, text: "b", fragment: 1 },
      ],
    },
    { id: "s2", elements: [{ id: "two", type: "text", box: { x: 0, y: 0, w: 0.5, h: 0.1 }, text: "c" }] },
  ],
};

const entering = (view: StageView) => [...view.current!.querySelectorAll<HTMLElement>(".el.enter")].map((n) => n.dataset.elementId);

function mount(d: Deck = deck) {
  const host = document.body.appendChild(document.createElement("div"));
  Object.defineProperty(host, "clientWidth", { get: () => 960 });
  Object.defineProperty(host, "clientHeight", { get: () => 540 });
  return new StageView(host, d);
}

beforeAll(() => {
  (globalThis as any).ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

describe("StageView entrances", () => {
  it("plays the slide entrance on first show and on every slide change", () => {
    const view = mount();
    view.show({ slide: 0, step: 0 });
    expect(entering(view)).toEqual(["always"]);
    expect(view.current!.classList.contains("stage-enter")).toBe(false);
    view.show({ slide: 1, step: 0 });
    expect(entering(view)).toEqual(["two"]);
    expect(view.current!.classList.contains("stage-enter")).toBe(true);
  });

  it("plays only the revealed step on a forward step and nothing going back", () => {
    const view = mount();
    view.show({ slide: 0, step: 0 });
    view.show({ slide: 0, step: 1 });
    expect(entering(view)).toEqual(["later"]);
    view.show({ slide: 0, step: 0 });
    expect(entering(view)).toEqual([]);
  });

  it("keeps a forced re-render of the same position still", () => {
    const view = mount();
    view.show({ slide: 0, step: 1 });
    view.setOptions({ showZones: true });
    expect(entering(view)).toEqual([]);
    expect(view.current!.classList.contains("stage-enter")).toBe(false);
  });

  it("plays nothing when the deck motion is none", () => {
    const view = mount({ ...deck, motion: "none" });
    view.show({ slide: 0, step: 0 });
    view.show({ slide: 1, step: 0 });
    expect(entering(view)).toEqual([]);
    expect(view.current!.dataset.motion).toBe("none");
  });
});
