import type { Deck } from "../../../shared/deck.ts";
import type { PresenterCommand, SessionSnapshot } from "../../../shared/protocol.ts";
import { h } from "./dom.ts";

/** How many top answers the presenter sees in the side panel. */
const PREVIEW = 5;

const people = (n: number) => (n === 1 ? "1 respuesta" : `${n} respuestas`);

/** Presenter controls for the open-question slide on screen: follow the answers and close them. */
export function createPresenterAsk(deck: Deck, send: (cmd: PresenterCommand) => void) {
  const close = h("button", { type: "button", class: "key" }, "Cerrar respuestas");
  const status = h("p", { class: "pq-status", role: "status", "aria-live": "polite" });
  const top = h("ol", { class: "pa-ask-top" });
  const el = h("section", { class: "pq pa-ask", "aria-label": "Pregunta abierta", hidden: true }, h("h2", { class: "legend" }, "Pregunta abierta"), status, top, h("div", { class: "pq-actions" }, close));
  close.addEventListener("click", () => send({ t: "ask-close" }));

  return {
    el,
    update(s: Pick<SessionSnapshot, "position" | "asks">) {
      const slide = deck.slides[s.position.slide];
      el.hidden = !slide?.ask;
      if (!slide?.ask) return;
      const view = s.asks[slide.id];
      close.disabled = view?.status !== "open";
      if (!view) {
        status.textContent = "Las respuestas se abren al iniciar.";
        top.replaceChildren();
        return;
      }
      status.textContent = `${people(view.total)} · ${view.status === "open" ? "abierta" : "cerrada"} · máx. ${view.maxChars}`;
      top.replaceChildren(
        ...view.entries.slice(0, PREVIEW).map((e) => h("li", {}, h("span", { class: "pa-ask-text" }, e.text), e.count > 1 ? h("span", { class: "pa-ask-count" }, `×${e.count}`) : null)),
      );
    },
  };
}
