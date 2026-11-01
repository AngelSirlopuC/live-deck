import type { AskView } from "../../../shared/ask.ts";
import { h } from "../ui/dom.ts";

/** Answers shown on the slide at once; the rest are summed up as "+N más". */
export const ASK_OVERLAY_MAX = 40;

const people = (n: number) => (n === 1 ? "1 respuesta" : `${n} respuestas`);

/** The static part of an open-question slide: the question, an empty answer list and the status line. */
export function renderAsk(question: string): HTMLElement {
  return h(
    "section",
    { class: "stage-ask", "aria-live": "polite" },
    h("h2", { class: "stage-ask-question" }, question),
    h("p", { class: "stage-ask-empty" }, "Esperando respuestas…"),
    h("p", { class: "stage-ask-status" }, "Responde desde tu teléfono"),
  );
}

/** Fills an open-question slide with its grouped answers. Answers are always text, never markup. */
export function applyAskView(stage: HTMLElement, view: AskView | null) {
  const box = stage.querySelector<HTMLElement>(".stage-ask");
  if (!box) return;
  const question = box.querySelector(".stage-ask-question")!;
  if (!view) {
    delete box.dataset.status;
    box.replaceChildren(question, h("p", { class: "stage-ask-empty" }, "Esperando respuestas…"), h("p", { class: "stage-ask-status" }, "Responde desde tu teléfono"));
    return;
  }
  box.dataset.status = view.status;
  const shown = view.entries.slice(0, ASK_OVERLAY_MAX);
  const lead = shown[0]?.count ?? 0;
  const list = h(
    "ol",
    { class: "stage-ask-list" },
    ...shown.map((e) =>
      h(
        "li",
        { class: `stage-ask-entry${lead > 1 && e.count === lead ? " is-leading" : ""}` },
        h("span", { class: "stage-ask-text" }, e.text),
        e.count > 1 ? h("span", { class: "stage-ask-count" }, `×${e.count}`) : null,
      ),
    ),
  );
  const rest = view.entries.length - shown.length;
  const state = view.status === "open" ? "Abierta · Responde desde tu teléfono" : "Cerrada";
  box.replaceChildren(
    question,
    view.entries.length ? list : h("p", { class: "stage-ask-empty" }, "Esperando respuestas…"),
    h("p", { class: "stage-ask-status" }, `${people(view.total)}${rest > 0 ? ` · +${rest} más` : ""} · ${state}`),
  );
}
