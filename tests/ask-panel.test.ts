// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createAskPanel } from "../web/src/ui/ask-panel.ts";
import type { AskView } from "../shared/ask.ts";

const view = (over: Partial<AskView> = {}): AskView => ({ slideId: "s1", question: "¿Una palabra?", maxChars: 20, status: "open", entries: [], total: 0, ...over });

function setup() {
  const sent: string[] = [];
  const panel = createAskPanel((slideId, t) => void sent.push(`${slideId}:${t}`));
  document.body.replaceChildren(panel.el);
  const input = panel.el.querySelector("input")!;
  const form = panel.el.querySelector("form")!;
  return { panel, sent, input, form };
}

describe("audience open-question panel", () => {
  it("is hidden without a question", () => {
    const { panel } = setup();
    panel.update(null);
    expect(panel.el.hidden).toBe(true);
  });

  it("shows the question, limits the input and turns on the browser's autocorrection", () => {
    const { panel, input } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    expect(panel.el.hidden).toBe(false);
    expect(panel.el.textContent).toContain("¿Una palabra?");
    expect(input.maxLength).toBe(20);
    expect(input.getAttribute("spellcheck")).toBe("true");
    expect(input.getAttribute("autocorrect")).toBe("on");
    expect(input.getAttribute("autocapitalize")).toBe("sentences");
    expect(panel.el.textContent).toContain("autocorrección");
  });

  it("sends the trimmed answer and confirms it, keeping what is typed across updates", () => {
    const { panel, sent, input, form } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    input.value = "  Rojo ";
    input.dispatchEvent(new Event("input"));
    expect(panel.el.textContent).toContain("7/20");
    panel.update({ view: view({ total: 3 }), mine: null, readOnly: false });
    expect(input.value).toBe("  Rojo ");
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(sent).toEqual(["s1:Rojo"]);
    panel.update({ view: view({ total: 4 }), mine: "Rojo", readOnly: false });
    expect(panel.el.textContent).toContain("Respuesta enviada: «Rojo»");
  });

  it("does not send an empty answer", () => {
    const { panel, sent, input, form } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    input.value = "   ";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(sent).toEqual([]);
  });

  it("locks the input once the question closes or in read-only mode", () => {
    const { panel, input } = setup();
    panel.update({ view: view({ status: "closed" }), mine: "Rojo", readOnly: false });
    expect(input.disabled).toBe(true);
    expect(panel.el.textContent).toContain("La pregunta está cerrada");
    panel.update({ view: view(), mine: null, readOnly: true });
    expect(input.disabled).toBe(true);
  });

  it("starts from the person's own answer when another question slide shows", () => {
    const { panel, input } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    input.value = "algo";
    panel.update({ view: view({ slideId: "s2", question: "Otra" }), mine: null, readOnly: false });
    expect(input.value).toBe("");
    panel.update({ view: view(), mine: "Rojo", readOnly: false });
    expect(input.value).toBe("Rojo");
  });
});
