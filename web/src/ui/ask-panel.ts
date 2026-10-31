import type { AskView } from "../../../shared/ask.ts";
import { h } from "./dom.ts";

export interface AskPanelState {
  view: AskView;
  /** This person's answer, as the server stored it. */
  mine: string | null;
  /** Answering is not possible (explore-only mode or presenter gone). */
  readOnly: boolean;
}

/** Answers are a few words: line breaks and repeated spaces collapse to one space. */
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Open-question slide on screen: the question, the person's answer and a button
 * that opens a modal text area to write it (or write it again while it is open).
 * The grouped answers of everyone stay on the slide itself (ask-overlay).
 */
export function createAskPanel(onSend: (slideId: string, text: string) => void) {
  const question = h("p", { class: "ask-panel-question" });
  const write = h("button", { type: "button", class: "key key-primary ask-panel-write" }, "Escribir respuesta");
  const status = h("p", { class: "ask-panel-status", role: "status", "aria-live": "polite" });
  const el = h("section", { class: "ask-panel", "aria-label": "Pregunta abierta", hidden: true }, h("h2", { class: "legend" }, "Pregunta abierta"), question, status, write);

  // Modal: one text area, a counter and the send / cancel actions.
  const sheetQuestion = h("h2", { id: "ask-sheet-title" });
  // Spellcheck and autocorrect on: the keyboard fixes typos before they split a word on screen.
  const textarea = h("textarea", {
    class: "ask-sheet-input",
    rows: "3",
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
  const hint = h("p", { class: "ask-panel-hint" }, "Activa la autocorrección de tu teclado o navegador para que tu palabra se agrupe bien con las demás.");
  const cancel = h("button", { type: "button", class: "key" }, "Cancelar");
  const send = h("button", { type: "submit", class: "key key-primary" }, "Enviar");
  const form = h("form", { class: "ask-sheet-form" }, sheetQuestion, textarea, count, hint, h("div", { class: "sheet-actions" }, cancel, send));
  const sheet = h("dialog", { class: "sheet ask-sheet", "aria-labelledby": "ask-sheet-title" }, form);

  let current: AskPanelState | null = null;
  let askId = "";
  /** Unsent text for the question on screen; null means "start from the sent answer". */
  let draft: string | null = null;
  let flash = "";

  const canAnswer = () => !!current && current.view.status === "open" && !current.readOnly;
  const syncCount = () => (count.textContent = current ? `${textarea.value.length}/${current.view.maxChars}` : "");
  const closeSheet = () => {
    if (sheet.open || sheet.hasAttribute("open")) sheet.close();
  };

  sheet.addEventListener("close", () => sheet.remove());
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });
  cancel.addEventListener("click", closeSheet);
  textarea.addEventListener("input", () => {
    draft = textarea.value;
    syncCount();
  });
  // Enter sends (answers are one line); Shift+Enter is ignored like any other line break.
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = clean(textarea.value);
    if (!text || !current || !canAnswer()) return;
    onSend(current.view.slideId, text);
    draft = null;
    closeSheet();
  });
  write.addEventListener("click", () => {
    if (!current || !canAnswer()) return;
    textarea.value = draft ?? current.mine ?? "";
    syncCount();
    if (!sheet.isConnected) document.body.append(sheet);
    sheet.showModal();
    textarea.focus();
    textarea.select();
  });

  function update(state: AskPanelState | null) {
    current = state;
    el.hidden = !state;
    if (!state) {
      closeSheet();
      return;
    }
    const { view, mine, readOnly } = state;
    // Another question starts from its own answer.
    if (view.slideId !== askId) {
      askId = view.slideId;
      draft = null;
      closeSheet();
    }
    const open = canAnswer();
    if (!open) closeSheet();
    question.textContent = view.question;
    sheetQuestion.textContent = view.question;
    textarea.maxLength = view.maxChars;
    write.hidden = !open;
    write.textContent = mine ? "Volver a escribir" : "Escribir respuesta";
    send.textContent = mine ? "Cambiar respuesta" : "Enviar";
    syncCount();
    status.dataset.tone = flash ? "bad" : "neutral";
    if (flash) status.textContent = flash;
    else if (readOnly) status.textContent = "Solo lectura: no puedes responder ahora.";
    else if (view.status === "closed") status.textContent = mine ? `La pregunta está cerrada. Tu respuesta: «${mine}».` : "La pregunta está cerrada.";
    else status.textContent = mine ? `Tu respuesta: «${mine}». Puedes volver a escribirla hasta que se cierre.` : "";
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
