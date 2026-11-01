import type { AskView } from "../../../shared/ask.ts";
import { h } from "../ui/dom.ts";

/** Answers shown on the slide at once; the rest are summed up as "+N más". */
export const ASK_OVERLAY_MAX = 40;

const people = (n: number) => (n === 1 ? "1 respuesta" : `${n} respuestas`);

/** Paints the live free-text question over the slide, or removes it. Answers are always text, never markup. */
export function applyAskView(stage: HTMLElement, view: AskView | null) {
  let box = stage.querySelector<HTMLElement>(".stage-ask");
  if (!view) {
    box?.remove();
    return;
  }
  if (!box) {
    box = h("section", { class: "stage-ask", "aria-live": "polite" });
    stage.append(box);
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
    h("h2", { class: "stage-ask-question" }, view.question),
    view.entries.length ? list : h("p", { class: "stage-ask-empty" }, "Esperando respuestas…"),
    h("p", { class: "stage-ask-status" }, `${people(view.total)}${rest > 0 ? ` · +${rest} más` : ""} · ${state}`),
  );
}
