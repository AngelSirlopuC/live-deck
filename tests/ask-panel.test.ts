// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { createAskPanel } from "../web/src/ui/ask-panel.ts";
import type { AskView } from "../shared/ask.ts";

const view = (over: Partial<AskView> = {}): AskView => ({ slideId: "s1", question: "¿Una palabra?", maxChars: 20, status: "open", entries: [], total: 0, ...over });

beforeAll(() => {
  // jsdom has no modal dialogs: mimic the open attribute and the close event.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

function setup() {
  const sent: string[] = [];
  const panel = createAskPanel((slideId, t) => void sent.push(`${slideId}:${t}`));
  document.body.replaceChildren(panel.el);
  const write = panel.el.querySelector<HTMLButtonElement>(".ask-panel-write")!;
  const dialog = () => document.querySelector<HTMLDialogElement>("dialog.ask-sheet");
  const textarea = () => dialog()!.querySelector("textarea")!;
  const form = () => dialog()!.querySelector("form")!;
  return { panel, sent, write, dialog, textarea, form };
}

describe("audience open-question panel", () => {
  it("is hidden without a question", () => {
    const { panel } = setup();
    panel.update(null);
    expect(panel.el.hidden).toBe(true);
  });

  it("shows the question and a button that opens a modal text area with autocorrection", () => {
    const { panel, write, dialog, textarea } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    expect(panel.el.hidden).toBe(false);
    expect(panel.el.textContent).toContain("¿Una palabra?");
    expect(panel.el.querySelector("input, textarea")).toBeNull();
    expect(write.hidden).toBe(false);
    expect(write.textContent).toBe("Escribir respuesta");
    expect(dialog()?.hasAttribute("open") ?? false).toBe(false);

    write.click();
    expect(dialog()!.hasAttribute("open")).toBe(true);
    expect(dialog()!.textContent).toContain("¿Una palabra?");
    expect(textarea().maxLength).toBe(20);
    expect(textarea().getAttribute("spellcheck")).toBe("true");
    expect(textarea().getAttribute("autocorrect")).toBe("on");
    expect(textarea().getAttribute("autocapitalize")).toBe("sentences");
    expect(dialog()!.textContent).toContain("autocorrección");
  });

  it("sends the trimmed answer from the modal, then closes it", () => {
    const { panel, sent, write, dialog, textarea, form } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    write.click();
    textarea().value = "  Rojo \n vivo ";
    textarea().dispatchEvent(new Event("input"));
    expect(dialog()!.textContent).toContain("14/20");
    form().dispatchEvent(new Event("submit", { cancelable: true }));
    expect(sent).toEqual(["s1:Rojo vivo"]);
    expect(dialog()?.hasAttribute("open") ?? false).toBe(false);
  });

  it("sends with Enter and keeps the modal open for an empty answer", () => {
    const { panel, sent, write, dialog, textarea } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    write.click();
    textarea().value = "   ";
    textarea().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(sent).toEqual([]);
    expect(dialog()!.hasAttribute("open")).toBe(true);
    textarea().value = "Azul";
    textarea().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(sent).toEqual(["s1:Azul"]);
  });

  it("shows the sent answer and lets the person write it again, starting from it", () => {
    const { panel, write, dialog, textarea } = setup();
    panel.update({ view: view({ total: 4 }), mine: "Rojo", readOnly: false });
    expect(panel.el.textContent).toContain("Tu respuesta: «Rojo»");
    expect(write.textContent).toBe("Volver a escribir");
    write.click();
    expect(dialog()!.hasAttribute("open")).toBe(true);
    expect(textarea().value).toBe("Rojo");
  });

  it("keeps an unsent draft when the modal is dismissed and reopened", () => {
    const { panel, write, dialog, textarea } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    write.click();
    textarea().value = "Verde";
    textarea().dispatchEvent(new Event("input"));
    dialog()!.close();
    panel.update({ view: view({ total: 2 }), mine: null, readOnly: false });
    write.click();
    expect(textarea().value).toBe("Verde");
  });

  it("hides the button and closes the modal once the question closes or in read-only mode", () => {
    const { panel, write, dialog } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    write.click();
    panel.update({ view: view({ status: "closed" }), mine: "Rojo", readOnly: false });
    expect(dialog()?.hasAttribute("open") ?? false).toBe(false);
    expect(write.hidden).toBe(true);
    expect(panel.el.textContent).toContain("La pregunta está cerrada");
    panel.update({ view: view(), mine: null, readOnly: true });
    expect(write.hidden).toBe(true);
    expect(panel.el.textContent).toContain("Solo lectura");
  });

  it("starts from the person's own answer when another question slide shows", () => {
    const { panel, write, dialog, textarea } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    write.click();
    textarea().value = "algo";
    textarea().dispatchEvent(new Event("input"));
    panel.update({ view: view({ slideId: "s2", question: "Otra" }), mine: null, readOnly: false });
    expect(dialog()?.hasAttribute("open") ?? false).toBe(false);
    write.click();
    expect(textarea().value).toBe("");
    expect(dialog()!.textContent).toContain("Otra");
    dialog()!.close();
    panel.update({ view: view(), mine: "Rojo", readOnly: false });
    write.click();
    expect(textarea().value).toBe("Rojo");
  });

  it("shows a transient error in the panel", () => {
    const { panel } = setup();
    panel.update({ view: view(), mine: null, readOnly: false });
    panel.error("La pregunta ya está cerrada.");
    expect(panel.el.textContent).toContain("La pregunta ya está cerrada.");
  });
});
