// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { AskView } from "../shared/ask.ts";
import type { Deck } from "../shared/deck.ts";
import { createPresenterAsk } from "../web/src/ui/presenter-ask.ts";

const deck: Deck = {
  version: 1,
  title: "T",
  slides: [
    { id: "intro", elements: [] },
    { id: "color", layout: "ask", elements: [], ask: { question: "¿Color?", maxChars: 20 } },
  ],
};
const view = (over: Partial<AskView> = {}): AskView => ({ slideId: "color", question: "¿Color?", maxChars: 20, status: "open", entries: [], total: 0, ...over });
const at = (slide: number, asks: Record<string, AskView> = {}) => ({ position: { slide, step: 0 }, asks }) as any;
const button = (root: ParentNode, label: string) => [...root.querySelectorAll("button")].find((b) => b.textContent === label)!;

function setup() {
  const sent: unknown[] = [];
  const pa = createPresenterAsk(deck, (c) => void sent.push(c));
  document.body.replaceChildren(pa.el);
  return { pa, sent };
}

describe("presenter open-question controls", () => {
  it("shows only on an open-question slide and has no way to launch a question", () => {
    const { pa } = setup();
    pa.update(at(0));
    expect(pa.el.hidden).toBe(true);
    pa.update(at(1));
    expect(pa.el.hidden).toBe(false);
    expect(pa.el.textContent).toContain("Las respuestas se abren al iniciar");
    expect(pa.el.textContent).not.toContain("Lanzar");
  });

  it("follows the answers and closes them", () => {
    const { pa, sent } = setup();
    pa.update(at(1, { color: view({ total: 3, entries: [{ text: "Rojo", count: 2 }, { text: "azul", count: 1 }] }) }));
    expect(pa.el.textContent).toContain("3 respuestas");
    expect(pa.el.textContent).toContain("Rojo×2");
    button(pa.el, "Cerrar respuestas").click();
    expect(sent).toEqual([{ t: "ask-close" }]);
    pa.update(at(1, { color: view({ status: "closed" }) }));
    expect(button(pa.el, "Cerrar respuestas").disabled).toBe(true);
  });
});
