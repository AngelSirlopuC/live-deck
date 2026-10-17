// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Deck } from "../shared/deck.ts";
import { STAGE_HEIGHT, STAGE_WIDTH, renderSlide } from "../web/src/render/slide.ts";

const deck: Deck = {
  version: 1,
  title: "T",
  slides: [
    {
      id: "s1",
      elements: [
        { id: "a", type: "text", box: { x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, text: "<b>raw</b>\nline" },
        { id: "b", type: "text", box: { x: 0, y: 0, w: 0.1, h: 0.1 }, text: "later", fragment: 2 },
        { id: "q", type: "qr", box: { x: 0, y: 0, w: 0.2, h: 0.2 } },
      ],
    },
    {
      id: "s2",
      layout: "quiz",
      elements: [],
      quiz: { question: "Best?", options: ["One", "Two", "Three"], correctIndex: 1, display: "secret" },
    },
  ],
};

describe("renderSlide", () => {
  it("maps normalized boxes onto the 1920x1080 logical stage", () => {
    const el = renderSlide(deck, 0, { step: 0 });
    expect(el.style.width).toBe(`${STAGE_WIDTH}px`);
    expect(el.style.height).toBe(`${STAGE_HEIGHT}px`);
    const a = el.querySelector<HTMLElement>('[data-element-id="a"]')!;
    expect(a.style.left).toBe("960px");
    expect(a.style.top).toBe("540px");
    expect(a.style.width).toBe("480px");
    expect(a.style.height).toBe("270px");
  });

  it("renders text as text, never as HTML", () => {
    const el = renderSlide(deck, 0, { step: 0 });
    const a = el.querySelector('[data-element-id="a"]')!;
    expect(a.querySelector("b")).toBeNull();
    expect(a.textContent).toBe("<b>raw</b>\nline");
  });

  it("hides fragments until their step", () => {
    const at1 = renderSlide(deck, 0, { step: 1 }).querySelector<HTMLElement>('[data-element-id="b"]')!;
    expect(at1.hidden).toBe(true);
    const at2 = renderSlide(deck, 0, { step: 2 }).querySelector<HTMLElement>('[data-element-id="b"]')!;
    expect(at2.hidden).toBe(false);
  });

  it("fills qr elements with the join url when provided", () => {
    const withUrl = renderSlide(deck, 0, { step: 0, joinUrl: "https://x.test/s/ABC", qrSvg: "<svg data-qr></svg>" });
    const q = withUrl.querySelector('[data-element-id="q"]')!;
    expect(q.querySelector("svg")).not.toBeNull();
    expect(q.textContent).toContain("x.test/s/ABC");
    const placeholder = renderSlide(deck, 0, { step: 0 }).querySelector('[data-element-id="q"]')!;
    expect(placeholder.querySelector("svg")).toBeNull();
    expect(placeholder.textContent).toContain("El QR aparece al presentar");
  });

  it("lays out quiz slides with one option per choice and no answer leak", () => {
    const el = renderSlide(deck, 1, { step: 0 });
    const options = el.querySelectorAll("[data-option-index]");
    expect(options).toHaveLength(3);
    expect(el.textContent).toContain("Best?");
    expect(el.innerHTML).not.toContain("correct");
  });
});
