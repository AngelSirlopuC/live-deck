import type { Deck } from "../../../shared/deck.ts";
import type { PresenterCommand, SessionSnapshot } from "../../../shared/protocol.ts";
import { quizStatusText } from "../render/quiz-overlay.ts";
import { h } from "./dom.ts";
import { OPTION_KEYS } from "./quiz-panel.ts";

/** Presenter controls for the quiz on the current slide, plus the score switch and leaderboard. */
export function createPresenterQuiz(deck: Deck, send: (cmd: PresenterCommand) => void, opts: { leaderboard: boolean }) {
  const status = h("p", { class: "pq-status", role: "status", "aria-live": "polite" });
  const bars = h("ol", { class: "pq-bars" });
  const close = h("button", { type: "button", class: "key" }, "Cerrar votación");
  const reveal = h("button", { type: "button", class: "key key-primary" }, "Revelar respuesta");
  close.addEventListener("click", () => send({ t: "quiz", action: "close" }));
  reveal.addEventListener("click", () => send({ t: "quiz", action: "reveal" }));
  const quizBox = h("section", { class: "pq", "aria-label": "Quiz actual" }, h("h2", { class: "legend" }, "Quiz"), status, bars, h("div", { class: "pq-actions" }, close, reveal));

  const scoreSwitch = h("input", { type: "checkbox", id: "show-score", role: "switch" });
  scoreSwitch.addEventListener("change", () => send({ t: "settings", showScore: scoreSwitch.checked }));
  const board = h("ol", { class: "leaderboard" });
  const boardBox = h(
    "section",
    { class: "pq-board", "aria-label": "Ranking" },
    h("label", { class: "pq-switch", for: "show-score" }, scoreSwitch, h("span", {}, "Mostrar puntaje al público")),
    board,
  );
  boardBox.hidden = !opts.leaderboard;

  return {
    quizEl: quizBox,
    boardEl: boardBox,
    update(s: SessionSnapshot, clockOffset: number) {
      const slide = deck.slides[s.position.slide]!;
      const view = s.quizzes[slide.id];
      quizBox.hidden = !slide.quiz;
      if (slide.quiz) {
        status.textContent = view ? quizStatusText(view, clockOffset) : "La votación se abre al iniciar.";
        bars.replaceChildren(
          ...slide.quiz.options.map((label, i) => {
            const count = view?.counts?.[i] ?? 0;
            const share = view && view.total ? count / view.total : 0;
            const li = h("li", { class: i === slide.quiz!.correctIndex ? "is-answer" : "" }, h("span", { class: "pq-key" }, OPTION_KEYS[i]!), h("span", { class: "pq-label" }, label), h("span", { class: "pq-count" }, String(count)));
            li.style.setProperty("--share", String(share));
            return li;
          }),
        );
        close.disabled = view?.status !== "open";
        reveal.disabled = !view || view.status === "revealed";
      }
      scoreSwitch.checked = s.showScore;
      const rows = s.leaderboard ?? [];
      board.replaceChildren(
        ...(rows.length
          ? rows.map((r) => h("li", {}, h("span", { class: "lb-rank" }, String(r.rank)), h("span", { class: "lb-name" }, r.name), h("span", { class: "lb-score" }, `${r.correct}/${r.answered}`)))
          : [h("li", { class: "lb-empty" }, "El ranking aparece cuando reveles la primera respuesta.")]),
      );
    },
  };
}
