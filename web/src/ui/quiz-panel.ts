import type { PublicQuiz } from "../../../shared/deck-core.ts";
import type { LeaderboardRow, PersonalState, QuizView } from "../../../shared/protocol.ts";
import { rankOptions } from "../../../shared/ranking.ts";
import { quizStatusText } from "../render/quiz-overlay.ts";
import { h } from "./dom.ts";

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];

/** Maps A-F or 1-6 to an option index, or null. */
export function optionFromKey(key: string, optionCount: number): number | null {
  const k = key.toUpperCase();
  let i = OPTION_KEYS.indexOf(k);
  if (i < 0 && /^[1-6]$/.test(k)) i = Number(k) - 1;
  return i >= 0 && i < optionCount ? i : null;
}

export interface QuizPanelState {
  slideId: string;
  quiz: PublicQuiz;
  view: QuizView | null;
  myVote: number | undefined;
  /** Voting is not possible (explore-only mode or presenter gone). */
  readOnly: boolean;
  clockOffset: number;
}

/** Big one-thumb voting buttons for the quiz on the slide being viewed. */
export function createQuizPanel(onVote: (slideId: string, option: number) => void) {
  const status = h("p", { class: "quiz-panel-status", role: "status", "aria-live": "polite" });
  const list = h("div", { class: "quiz-panel-options", role: "group", "aria-label": "Opciones" });
  const result = h("p", { class: "quiz-panel-result", role: "status", "aria-live": "polite" });
  const hint = h("p", { class: "quiz-panel-hint" }, "También puedes votar con las teclas A–F o 1–6.");
  const el = h("section", { class: "quiz-panel", "aria-label": "Quiz" }, h("h2", { class: "legend" }, "Tu respuesta"), status, list, result, hint);
  let current: QuizPanelState | null = null;
  let flash = "";

  function update(state: QuizPanelState | null) {
    current = state;
    el.hidden = !state;
    if (!state) return;
    const { quiz, view, myVote, readOnly } = state;
    const open = view?.status === "open" && !readOnly;

    if (list.childElementCount !== quiz.options.length || list.dataset.slide !== state.slideId) {
      list.dataset.slide = state.slideId;
      list.replaceChildren(
        ...quiz.options.map((label, i) => {
          const b = h("button", { type: "button", class: "vote", "data-option": i, "aria-keyshortcuts": `${OPTION_KEYS[i]} ${i + 1}` }, h("span", { class: "vote-bar", "aria-hidden": "true" }), h("span", { class: "vote-key" }, OPTION_KEYS[i]!), h("span", { class: "vote-label" }, label), h("span", { class: "vote-share" }));
          b.addEventListener("click", () => current && onVote(current.slideId, i));
          return b;
        }),
      );
    }
    const ranks = view?.counts ? rankOptions(view.counts) : [];
    const leaderVotes = ranks[0]?.count ?? 0;
    list.querySelectorAll<HTMLButtonElement>(".vote").forEach((b, i) => {
      b.classList.toggle("is-first", leaderVotes > 0 && view?.counts?.[i] === leaderVotes);
      b.disabled = !open;
      b.setAttribute("aria-pressed", String(myVote === i));
      const revealed = view?.status === "revealed";
      b.classList.toggle("is-correct", revealed && view?.correctIndex === i);
      b.classList.toggle("is-wrong", revealed && view?.correctIndex !== i && myVote === i);
      // Visible results: each option shows its share as a bar behind the label, plus the percentage.
      const count = view?.counts?.[i];
      const share = count !== undefined && view && view.total ? count / view.total : 0;
      b.style.setProperty("--share", String(share));
      const pct = b.querySelector<HTMLElement>(".vote-share")!;
      pct.textContent = count !== undefined && view && view.total ? `${Math.round(share * 100)}%` : "";
      if (count !== undefined && view && view.total) pct.setAttribute("aria-label", `${count} ${count === 1 ? "voto" : "votos"}, ${Math.round(share * 100)}%`);
      else pct.removeAttribute("aria-label");
    });

    if (readOnly && view?.status !== "revealed") status.textContent = "Solo lectura: la votación no está disponible.";
    else if (!view) status.textContent = "La votación se abre cuando el ponente llegue a esta pregunta.";
    else status.textContent = quizStatusText(view, state.clockOffset);

    if (view?.status === "revealed") {
      const right = OPTION_KEYS[view.correctIndex ?? 0];
      result.dataset.tone = myVote === undefined ? "neutral" : myVote === view.correctIndex ? "ok" : "bad";
      result.textContent = myVote === undefined ? `No votaste. La correcta era la ${right}.` : myVote === view.correctIndex ? "¡Acertaste!" : `No acertaste. La correcta era la ${right}.`;
    } else if (flash) {
      result.dataset.tone = "bad";
      result.textContent = flash;
    } else {
      result.dataset.tone = "neutral";
      result.textContent = myVote !== undefined && open ? "Voto registrado. Puedes cambiarlo hasta que se cierre." : "";
    }
    hint.hidden = !open;
  }

  return {
    el,
    update,
    /** Shows a transient problem, e.g. a vote that arrived after closing. */
    error(message: string) {
      flash = message;
      update(current);
      setTimeout(() => {
        flash = "";
        update(current);
      }, 3000);
    },
    get state() {
      return current;
    },
  };
}

/** The viewer's own score and the leaderboard, when the presenter shows scores. */
export function createScorePanel() {
  const mine = h("p", { class: "score-mine" });
  const board = h("ol", { class: "leaderboard" });
  const el = h("section", { class: "score-panel", "aria-label": "Puntaje" }, h("h2", { class: "legend" }, "Ranking"), mine, board);
  return {
    el,
    update(showScore: boolean, me: PersonalState | null, rows: LeaderboardRow[] | null, myName: string) {
      el.hidden = !showScore;
      if (el.hidden) return;
      const s = me?.score;
      mine.textContent =
        s && s.answered
          ? `Tus aciertos: ${s.correct} de ${s.answered}${me?.rank ? ` · Puesto ${me.rank.rank} de ${me.rank.of}` : ""}`
          : rows && rows.length
            ? "Responde la próxima pregunta para entrar al ranking."
            : "El ranking aparece cuando el ponente revele la primera respuesta.";
      board.hidden = !rows || rows.length === 0;
      board.replaceChildren(
        ...rows!.map((r) =>
          h("li", { class: r.name === myName ? "is-me" : "" }, h("span", { class: "lb-rank" }, String(r.rank)), h("span", { class: "lb-name" }, r.name), h("span", { class: "lb-score" }, `${r.correct}/${r.answered}`)),
        ),
      );
    },
  };
}
