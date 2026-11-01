import { ASK_QUESTION_MAX, ASK_TEXT_DEFAULT, ASK_TEXT_MAX, ASK_TEXT_MIN } from "../../../shared/ask.ts";
import type { PresenterCommand, SessionSnapshot } from "../../../shared/protocol.ts";
import { h } from "./dom.ts";

/** How many top answers the presenter sees in the side panel. */
const PREVIEW = 5;

/** Sheet to write a free-text question and its answer limit; resolves undefined when cancelled. */
function askSheet(): Promise<{ question: string; maxChars: number } | undefined> {
  return new Promise((resolve) => {
    const question = h("textarea", { id: "ask-question", rows: 3, maxlength: ASK_QUESTION_MAX, placeholder: "¿Qué palabra describe tu semana?", lang: "es", spellcheck: "true" });
    const limit = h("input", { id: "ask-limit", type: "number", inputmode: "numeric", min: ASK_TEXT_MIN, max: ASK_TEXT_MAX, step: 1, value: ASK_TEXT_DEFAULT });
    const error = h("p", { class: "form-error", role: "alert" });
    const launch = h("button", { type: "submit", class: "key key-primary" }, "Lanzar");
    const cancel = h("button", { type: "button", class: "key key-ghost" }, "Cancelar");
    const form = h(
      "form",
      { method: "dialog" },
      h("h2", { id: "ask-title" }, "Pregunta abierta"),
      h("p", {}, "Aparece sobre la diapositiva y el público responde con texto libre. Las respuestas iguales se agrupan con ×N."),
      h("div", { class: "field" }, h("label", { for: "ask-question", class: "legend" }, "Pregunta"), question),
      h("div", { class: "field" }, h("label", { for: "ask-limit", class: "legend" }, "Máximo de caracteres por respuesta"), limit),
      error,
      h("div", { class: "sheet-actions" }, cancel, launch),
    );
    const sheet = h("dialog", { class: "sheet", "aria-labelledby": "ask-title" }, form);
    const done = (v: { question: string; maxChars: number } | undefined) => {
      sheet.close();
      sheet.remove();
      resolve(v);
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = question.value.trim();
      const n = Number(limit.value);
      if (!q) {
        error.textContent = "Escribe la pregunta.";
        return;
      }
      if (!Number.isInteger(n) || n < ASK_TEXT_MIN || n > ASK_TEXT_MAX) {
        error.textContent = `Escribe un máximo entero, de ${ASK_TEXT_MIN} a ${ASK_TEXT_MAX} caracteres.`;
        return;
      }
      done({ question: q, maxChars: n });
    });
    cancel.addEventListener("click", () => done(undefined));
    sheet.addEventListener("cancel", () => done(undefined));
    document.body.append(sheet);
    sheet.showModal();
    question.focus();
  });
}

/** Presenter controls for the live free-text question: launch, follow the answers, close, remove. */
export function createPresenterAsk(send: (cmd: PresenterCommand) => void) {
  const launch = h("button", { type: "button", class: "key key-primary" }, "Lanzar pregunta");
  const again = h("button", { type: "button", class: "key" }, "Nueva pregunta");
  const close = h("button", { type: "button", class: "key" }, "Cerrar respuestas");
  const clear = h("button", { type: "button", class: "key key-ghost" }, "Quitar de pantalla");
  const question = h("p", { class: "pa-ask-question" });
  const status = h("p", { class: "pq-status", role: "status", "aria-live": "polite" });
  const top = h("ol", { class: "pa-ask-top" });
  const hint = h("p", { class: "pa-ask-hint" }, "Lanza una pregunta y el público responde con texto libre desde su teléfono.");
  const el = h("section", { class: "pq pa-ask", "aria-label": "Pregunta abierta" }, h("h2", { class: "legend" }, "Pregunta abierta"), hint, question, status, top, h("div", { class: "pq-actions" }, launch, again, close, clear));

  const open = async () => {
    const r = await askSheet();
    if (r) send({ t: "ask-open", ...r });
  };
  launch.addEventListener("click", open);
  again.addEventListener("click", open);
  close.addEventListener("click", () => send({ t: "ask-close" }));
  clear.addEventListener("click", () => send({ t: "ask-clear" }));

  return {
    el,
    update(s: Pick<SessionSnapshot, "status" | "ask">) {
      const ask = s.ask;
      const live = s.status === "live";
      launch.hidden = !!ask;
      launch.disabled = !live;
      launch.title = live ? "" : "Inicia la presentación para lanzar una pregunta";
      hint.hidden = !!ask;
      again.hidden = !ask;
      again.disabled = !live;
      close.hidden = !ask || ask.status !== "open";
      clear.hidden = !ask;
      question.hidden = status.hidden = top.hidden = !ask;
      if (!ask) return;
      question.textContent = ask.question;
      status.textContent = `${ask.total === 1 ? "1 respuesta" : `${ask.total} respuestas`} · ${ask.status === "open" ? "abierta" : "cerrada"} · máx. ${ask.maxChars}`;
      top.replaceChildren(
        ...ask.entries.slice(0, PREVIEW).map((e) => h("li", {}, h("span", { class: "pa-ask-text" }, e.text), e.count > 1 ? h("span", { class: "pa-ask-count" }, `×${e.count}`) : null)),
      );
    },
  };
}
