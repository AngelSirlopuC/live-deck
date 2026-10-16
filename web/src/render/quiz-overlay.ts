import type { QuizView } from "../../../shared/protocol.ts";

export interface QuizOverlayOptions {
  /** This viewer's own vote, highlighted on the slide. */
  myVote?: number | undefined;
  /** Server clock offset (serverNow - Date.now()) for the countdown. */
  clockOffset?: number;
  /** Presenter monitors mark the answer before it is revealed. */
  presenter?: boolean;
}

export function remainingSeconds(view: QuizView, clockOffset = 0): number | null {
  if (view.status !== "open" || view.endsAt === null) return null;
  return Math.max(0, Math.ceil((view.endsAt - (Date.now() + clockOffset)) / 1000));
}

export function quizStatusText(view: QuizView, clockOffset = 0): string {
  const votes = `${view.total} ${view.total === 1 ? "voto" : "votos"}`;
  if (view.status === "revealed") return `Respuesta revelada · ${votes}`;
  if (view.status === "closed") return `Votación cerrada · ${votes}`;
  const left = remainingSeconds(view, clockOffset);
  return left === null ? `Votación abierta · ${votes}` : `Votación abierta · ${votes} · quedan ${left} s`;
}

/** Paints vote bars, counts, the answer and the viewer's vote onto a rendered quiz slide. */
export function applyQuizView(stage: HTMLElement, view: QuizView | null, opts: QuizOverlayOptions = {}) {
  const quiz = stage.querySelector<HTMLElement>(".quiz");
  if (!quiz) return;
  quiz.dataset.status = view?.status ?? "idle";
  const max = view?.counts ? Math.max(0, ...view.counts) : 0;
  for (const item of quiz.querySelectorAll<HTMLElement>("[data-option-index]")) {
    const i = Number(item.dataset.optionIndex);
    const count = view?.counts?.[i];
    const share = count !== undefined && view && view.total > 0 ? count / view.total : 0;
    item.style.setProperty("--share", String(share));
    item.querySelector(".quiz-count")!.textContent = count !== undefined ? `${Math.round(share * 100)}%` : "";
    const revealed = view?.status === "revealed";
    item.classList.toggle("is-correct", revealed && view?.correctIndex === i);
    item.classList.toggle("is-wrong", revealed && view?.correctIndex !== i);
    item.classList.toggle("is-answer", !revealed && !!opts.presenter && view?.correctIndex === i);
    item.classList.toggle("is-leading", count !== undefined && count > 0 && count === max);
    item.classList.toggle("is-mine", opts.myVote === i);
  }
  quiz.querySelector(".quiz-status")!.textContent = view ? quizStatusText(view, opts.clockOffset) : "";
}
