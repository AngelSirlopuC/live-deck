import type { QuizView } from "../../../shared/protocol.ts";
import { rankOptions } from "../../../shared/ranking.ts";

export interface QuizOverlayOptions {
  /** This viewer's own vote, highlighted on the slide. */
  myVote?: number | undefined;
  /** Server clock offset (serverNow - Date.now()) for the countdown. */
  clockOffset?: number;
  /** Presenter monitors mark the answer before it is revealed. */
  presenter?: boolean;
}

/**
 * Quiz options for the console's own slide. It marks the answer for the presenter,
 * except while that same slide is projected to the audience (presentation mode).
 */
export function consoleQuizOptions(projected: boolean, clockOffset?: number): QuizOverlayOptions {
  return { presenter: !projected, ...(clockOffset !== undefined ? { clockOffset } : {}) };
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
  const items = [...quiz.querySelectorAll<HTMLElement>("[data-option-index]")];
  const counts = view?.counts ?? null;
  // Zones are fixed regions of a designed image: they show rank badges but never move.
  const zones = quiz.dataset.layout === "zones";
  // One vertical column whenever results are a ranking; options re-order only once counts are visible.
  const column = !zones && quiz.dataset.results !== "grid";
  const ranking = column && !!counts;
  const showRanks = ranking || (!!counts && zones);
  const ranks = counts ? rankOptions(counts) : [];
  const anyVotes = !!counts && counts.some((c) => c > 0);

  // Remember where items were so a re-order can glide instead of jump.
  const before = ranking && quiz.isConnected ? new Map(items.map((el) => [el, el.getBoundingClientRect().top])) : null;
  quiz.dataset.view = column ? "ranking" : "grid";

  for (const item of items) {
    const i = Number(item.dataset.optionIndex);
    const count = counts?.[i];
    const share = count !== undefined && view && view.total > 0 ? count / view.total : 0;
    const position = ranks.findIndex((r) => r.index === i);
    const rank = ranks[position]?.rank;
    item.style.setProperty("--share", String(share));
    item.style.order = ranking ? String(position + 1) : "";
    item.querySelector(".quiz-count")!.textContent = count !== undefined ? `${Math.round(share * 100)}%` : "";
    item.querySelector(".quiz-rank")!.textContent = showRanks && anyVotes && rank ? `${rank}º` : "";
    const revealed = view?.status === "revealed";
    item.classList.toggle("is-correct", revealed && view?.correctIndex === i);
    item.classList.toggle("is-wrong", revealed && view?.correctIndex !== i);
    item.classList.toggle("is-answer", !revealed && !!opts.presenter && view?.correctIndex === i);
    item.classList.toggle("is-first", anyVotes && rank === 1);
    item.classList.toggle("is-leading", anyVotes && rank === 1);
    item.classList.toggle("is-mine", opts.myVote === i);
  }
  quiz.querySelector(".quiz-status")!.textContent = view ? quizStatusText(view, opts.clockOffset) : "";

  if (before) {
    for (const item of items) {
      const from = before.get(item)!;
      const to = item.getBoundingClientRect().top;
      const scale = item.getBoundingClientRect().height / (item.offsetHeight || 1) || 1;
      const dy = (from - to) / scale;
      if (Math.abs(dy) < 1) continue;
      item.animate?.([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
  }
}
