// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createQuizPanel, type QuizPanelState } from "../web/src/ui/quiz-panel.ts";

const quiz = { question: "Q?", options: ["A", "B", "C"], display: "live" as const };
const state = (over: Partial<QuizPanelState> = {}): QuizPanelState => ({
  slideId: "q",
  quiz,
  view: { slideId: "q", status: "open", counts: [1, 3, 0], total: 4, correctIndex: null, endsAt: null },
  myVote: 0,
  readOnly: false,
  clockOffset: 0,
  ...over,
});

describe("phone quiz panel", () => {
  it("draws each option's share of votes as a bar when results are visible", () => {
    const sent: number[] = [];
    const panel = createQuizPanel((_, o) => void sent.push(o));
    panel.update(state());
    const buttons = [...panel.el.querySelectorAll<HTMLButtonElement>(".vote")];
    expect(buttons.map((b) => b.style.getPropertyValue("--share"))).toEqual(["0.25", "0.75", "0"]);
    expect(buttons.every((b) => b.querySelector(".vote-bar"))).toBe(true);
    expect(buttons[1]!.querySelector(".vote-share")!.textContent).toBe("75%");
    expect(buttons[1]!.querySelector(".vote-share")!.getAttribute("aria-label")).toBe("3 votos, 75%");
  });

  it("shows no bars while results are secret", () => {
    const panel = createQuizPanel(() => {});
    panel.update(state({ view: { slideId: "q", status: "open", counts: null, total: 4, correctIndex: null, endsAt: null } }));
    const buttons = [...panel.el.querySelectorAll<HTMLButtonElement>(".vote")];
    expect(buttons.map((b) => b.style.getPropertyValue("--share"))).toEqual(["0", "0", "0"]);
    expect(buttons.map((b) => b.querySelector(".vote-share")!.textContent)).toEqual(["", "", ""]);
  });

  it("lets the person change their vote while voting is open", () => {
    const sent: number[] = [];
    const panel = createQuizPanel((_, o) => void sent.push(o));
    panel.update(state({ myVote: 0 }));
    const buttons = [...panel.el.querySelectorAll<HTMLButtonElement>(".vote")];
    expect(buttons[2]!.disabled).toBe(false);
    buttons[2]!.click();
    expect(sent).toEqual([2]);
  });
});
