import type { AskView } from "../../../shared/ask.ts";
import { h } from "./dom.ts";

export interface AskPanelState {
  view: AskView;
  /** This person's answer, as the server stored it. */
  mine: string | null;
  /** Answering is not possible (explore-only mode or presenter gone). */
  readOnly: boolean;
}

/** Answer box for the open-question slide on screen. */
export function createAskPanel(onSend: (slideId: string, text: string) => void) {
  const question = h("p", { class: "ask-panel-question" });
  // Spellcheck and autocorrect on: the keyboard fixes typos before they split a word on screen.
  const input = h("input", {
    class: "ask-panel-input",
    type: "text",
    lang: "es",
    spellcheck: "true",
    autocorrect: "on",
    autocapitalize: "sentences",
    autocomplete: "off",
    enterkeyhint: "send",
    placeholder: "Tu respuesta",
    "aria-label": "Tu respuesta",
  });
  const count = h("span", { class: "ask-panel-count", "aria-hidden": "true" });
  const send = h("button", { type: "submit", class: "key key-primary" }, "Enviar");
  const form = h("form", { class: "ask-panel-form" }, input, send);
  const hint = h("p", { class: "ask-panel-hint" }, "Activa la autocorrección de tu teclado o navegador para que tu palabra se agrupe bien con las demás.");
  const status = h("p", { class: "ask-panel-status", role: "status", "aria-live": "polite" });
  const el = h("section", { class: "ask-panel", "aria-label": "Pregunta abierta", hidden: true }, h("h2", { class: "legend" }, "Pregunta abierta"), question, form, count, status, hint);
  let current: AskPanelState | null = null;
  let askId = "";
  let flash = "";

  const syncCount = () => (count.textContent = current ? `${input.value.length}/${current.view.maxChars}` : "");
  input.addEventListener("input", syncCount);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || input.disabled || !current) return;
    onSend(current.view.slideId, text);
  });

  function update(state: AskPanelState | null) {
    current = state;
    el.hidden = !state;
    if (!state) return;
    const { view, mine, readOnly } = state;
    // Another question starts from its own answer; otherwise keep what is being typed.
    if (view.slideId !== askId) {
      askId = view.slideId;
      input.value = mine ?? "";
    }
    const open = view.status === "open" && !readOnly;
    question.textContent = view.question;
    input.maxLength = view.maxChars;
    input.disabled = !open;
    send.disabled = !open;
    send.textContent = mine ? "Cambiar" : "Enviar";
    hint.hidden = !open;
    syncCount();
    status.dataset.tone = flash ? "bad" : "neutral";
    if (flash) status.textContent = flash;
    else if (readOnly) status.textContent = "Solo lectura: no puedes responder ahora.";
    else if (view.status === "closed") status.textContent = mine ? `La pregunta está cerrada. Tu respuesta: «${mine}».` : "La pregunta está cerrada.";
    else status.textContent = mine ? `Respuesta enviada: «${mine}». Puedes cambiarla hasta que se cierre.` : "";
  }

  return {
    el,
    update,
    /** Shows a transient problem, e.g. an answer that arrived after closing. */
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
