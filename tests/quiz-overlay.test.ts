// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Deck } from "../shared/deck.ts";
import { applyQuizView, quizStatusText } from "../web/src/render/quiz-overlay.ts";
import { renderSlide } from "../web/src/render/slide.ts";

const deck: Deck = {
  version: 1,
  title: "T",
  slides: [{ id: "q", layout: "quiz", elements: [], quiz: { question: "Q?", options: ["A", "B", "C"], correctIndex: 2, display: "live" } }],
};

describe("quiz overlay", () => {
  it("shows shares, the leading option and the viewer's vote", () => {
    const stage = renderSlide(deck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: [1, 3, 0], total: 4, correctIndex: null, endsAt: null }, { myVote: 0 });
    const opts = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(opts[1]!.style.getPropertyValue("--share")).toBe("0.75");
    expect(opts[1]!.querySelector(".quiz-count")!.textContent).toBe("75%");
    expect(opts[1]!.classList.contains("is-leading")).toBe(true);
    expect(opts[0]!.classList.contains("is-mine")).toBe(true);
    expect(opts.some((o) => o.classList.contains("is-correct"))).toBe(false);
  });

  it("hides counts when the viewer may not see them", () => {
    const stage = renderSlide(deck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: null, total: 4, correctIndex: null, endsAt: null });
    expect(stage.querySelector(".quiz-count")!.textContent).toBe("");
    expect(stage.querySelector(".quiz-status")!.textContent).toBe("Votación abierta · 4 votos");
  });

  it("marks the correct answer after reveal", () => {
    const stage = renderSlide(deck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "revealed", counts: [1, 0, 2], total: 3, correctIndex: 2, endsAt: null });
    const opts = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(opts[2]!.classList.contains("is-correct")).toBe(true);
    expect(opts[0]!.classList.contains("is-wrong")).toBe(true);
  });

  it("counts down timed quizzes using the server clock", () => {
    const now = Date.now();
    expect(quizStatusText({ slideId: "q", status: "open", counts: null, total: 1, correctIndex: null, endsAt: now + 10_000 }, 0)).toMatch(/quedan 10 s$/);
  });
});

describe("quiz keys", async () => {
  const { optionFromKey } = await import("../web/src/ui/quiz-panel.ts");
  it("maps letters and digits to options within range", () => {
    expect(optionFromKey("a", 4)).toBe(0);
    expect(optionFromKey("D", 4)).toBe(3);
    expect(optionFromKey("2", 4)).toBe(1);
    expect(optionFromKey("e", 4)).toBeNull();
    expect(optionFromKey("7", 6)).toBeNull();
    expect(optionFromKey("ArrowRight", 4)).toBeNull();
  });
});

describe("ranking view", () => {
  const rankDeck: Deck = {
    version: 1,
    title: "T",
    slides: [{ id: "q", layout: "quiz", elements: [], quiz: { question: "Q?", options: ["A", "B", "C"], correctIndex: 0, display: "live" } }],
  };

  it("orders options by votes and highlights the first place", () => {
    const stage = renderSlide(rankDeck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: [1, 4, 2], total: 7, correctIndex: null, endsAt: null });
    const quiz = stage.querySelector<HTMLElement>(".quiz")!;
    expect(quiz.dataset.view).toBe("ranking");
    const opts = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(opts.map((o) => o.style.order)).toEqual(["3", "1", "2"]);
    expect(opts[1]!.classList.contains("is-first")).toBe(true);
    expect(opts[1]!.querySelector(".quiz-rank")!.textContent).toBe("1º");
  });

  it("keeps the A-D grid while results are hidden, and with results: grid", () => {
    const stage = renderSlide(rankDeck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: null, total: 3, correctIndex: null, endsAt: null });
    expect(stage.querySelector<HTMLElement>(".quiz")!.dataset.view).toBe("grid");
    const gridDeck = structuredClone(rankDeck);
    gridDeck.slides[0]!.quiz!.results = "grid";
    const g = renderSlide(gridDeck, 0, { step: 0 });
    applyQuizView(g, { slideId: "q", status: "open", counts: [1, 4, 2], total: 7, correctIndex: null, endsAt: null });
    expect(g.querySelector<HTMLElement>(".quiz")!.dataset.view).toBe("grid");
  });
});
