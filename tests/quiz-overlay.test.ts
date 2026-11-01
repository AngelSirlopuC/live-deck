// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Deck } from "../shared/deck.ts";
import { applyQuizView, consoleQuizOptions, quizStatusText } from "../web/src/render/quiz-overlay.ts";
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

  it("the console marks the answer before reveal only while it is not projected", () => {
    const open = { slideId: "q", status: "open" as const, counts: [1, 0, 2], total: 3, correctIndex: 2, endsAt: null };
    const marked = (projected: boolean) => {
      const stage = renderSlide(deck, 0, { step: 0 });
      applyQuizView(stage, open, consoleQuizOptions(projected));
      return [...stage.querySelectorAll<HTMLElement>("[data-option-index]")].map((o) => o.classList.contains("is-answer"));
    };
    expect(marked(false)).toEqual([false, false, true]);
    // Projected to the audience (presentation mode): no hint of the answer until it is revealed.
    expect(marked(true)).toEqual([false, false, false]);
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

  it("results: ranking is one vertical column from the start, before any vote and while results are hidden", () => {
    const stage = renderSlide(rankDeck, 0, { step: 0 });
    expect(stage.querySelector<HTMLElement>(".quiz")!.dataset.view).toBe("ranking");
    applyQuizView(stage, { slideId: "q", status: "open", counts: null, total: 3, correctIndex: null, endsAt: null });
    const quiz = stage.querySelector<HTMLElement>(".quiz")!;
    expect(quiz.dataset.view).toBe("ranking");
    // No counts yet: keep A, B, C order and show no rank.
    const opts = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(opts.map((o) => o.style.order)).toEqual(["", "", ""]);
    expect(opts.map((o) => o.querySelector(".quiz-rank")!.textContent)).toEqual(["", "", ""]);
  });

  it("results: grid keeps two columns before and after votes", () => {
    const gridDeck = structuredClone(rankDeck);
    gridDeck.slides[0]!.quiz!.results = "grid";
    const g = renderSlide(gridDeck, 0, { step: 0 });
    expect(g.querySelector<HTMLElement>(".quiz")!.dataset.view).toBe("grid");
    applyQuizView(g, { slideId: "q", status: "open", counts: [1, 4, 2], total: 7, correctIndex: null, endsAt: null });
    expect(g.querySelector<HTMLElement>(".quiz")!.dataset.view).toBe("grid");
  });

  it("an empty rank slot takes no space before votes", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "web/src/styles/stage.css"), "utf8");
    expect(css).toMatch(/\.quiz\[data-view="ranking"\] \.quiz-rank:empty\s*\{[^}]*display:\s*none/);
  });
});

describe("zone quiz overlay", () => {
  const zoneDeck: Deck = {
    version: 1,
    title: "T",
    slides: [
      {
        id: "q",
        layout: "quiz",
        background: { image: "assets/slide-01.png" },
        elements: [],
        quiz: {
          question: "Q?",
          options: ["A", "B", "C"],
          correctIndex: 2,
          display: "live",
          zones: [
            { x: 0, y: 0, w: 0.3, h: 0.3 },
            { x: 0.35, y: 0, w: 0.3, h: 0.3 },
            { x: 0.7, y: 0, w: 0.3, h: 0.3 },
          ],
        },
      },
    ],
  };

  it("paints shares and rank badges without re-ordering zones", () => {
    const stage = renderSlide(zoneDeck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: [1, 4, 2], total: 7, correctIndex: null, endsAt: null }, { myVote: 0 });
    const quiz = stage.querySelector<HTMLElement>(".quiz")!;
    expect(quiz.dataset.view).toBe("grid");
    const zones = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(zones.map((z) => z.style.order)).toEqual(["", "", ""]);
    expect(zones.map((z) => z.querySelector(".quiz-rank")!.textContent)).toEqual(["3º", "1º", "2º"]);
    expect(zones[1]!.querySelector(".quiz-count")!.textContent).toBe("57%");
    expect(zones[1]!.style.getPropertyValue("--share")).toBe(String(4 / 7));
    expect(zones[1]!.classList.contains("is-first")).toBe(true);
    expect(zones[1]!.classList.contains("is-leading")).toBe(true);
    expect(zones[0]!.classList.contains("is-mine")).toBe(true);
    expect(quiz.querySelector(".quiz-status")!.textContent).toBe("Votación abierta · 7 votos");
  });

  it("marks correct and wrong zones after reveal and hides badges while counts are hidden", () => {
    const stage = renderSlide(zoneDeck, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: null, total: 2, correctIndex: null, endsAt: null });
    const zones = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(zones.map((z) => z.querySelector(".quiz-rank")!.textContent)).toEqual(["", "", ""]);
    expect(zones.map((z) => z.querySelector(".quiz-count")!.textContent)).toEqual(["", "", ""]);
    applyQuizView(stage, { slideId: "q", status: "revealed", counts: [1, 0, 2], total: 3, correctIndex: 2, endsAt: null });
    expect(zones[2]!.classList.contains("is-correct")).toBe(true);
    expect(zones[0]!.classList.contains("is-wrong")).toBe(true);
    expect(zones.map((z) => z.style.order)).toEqual(["", "", ""]);
  });
});

describe("rank badges before any vote", () => {
  it("shows no rank badges while every option has zero votes", () => {
    const d: Deck = { version: 1, title: "T", slides: [{ id: "q", layout: "quiz", elements: [], quiz: { question: "Q?", options: ["A", "B"], correctIndex: 0, display: "live" } }] };
    const stage = renderSlide(d, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: [0, 0], total: 0, correctIndex: null, endsAt: null });
    expect([...stage.querySelectorAll(".quiz-rank")].map((e) => e.textContent)).toEqual(["", ""]);
  });
});

describe("grid results keep no rank badges", () => {
  it("does not show rank badges with results: grid even with votes", () => {
    const d: Deck = { version: 1, title: "T", slides: [{ id: "q", layout: "quiz", elements: [], quiz: { question: "Q?", options: ["A", "B"], correctIndex: 0, display: "live", results: "grid" } }] };
    const stage = renderSlide(d, 0, { step: 0 });
    applyQuizView(stage, { slideId: "q", status: "open", counts: [2, 1], total: 3, correctIndex: null, endsAt: null });
    expect([...stage.querySelectorAll(".quiz-rank")].map((e) => e.textContent)).toEqual(["", ""]);
  });
});
