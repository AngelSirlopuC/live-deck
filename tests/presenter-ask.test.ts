// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { createPresenterAsk } from "../web/src/ui/presenter-ask.ts";
import type { AskView } from "../shared/ask.ts";

beforeAll(() => {
  // jsdom has <dialog> without the modal methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const live = (ask: AskView | null) => ({ status: "live", ask }) as any;
const view = (over: Partial<AskView> = {}): AskView => ({ id: "a1", question: "¿Color?", maxChars: 40, status: "open", entries: [], total: 0, ...over });
const button = (root: ParentNode, label: string) => [...root.querySelectorAll("button")].find((b) => b.textContent === label)!;

function setup() {
  const sent: unknown[] = [];
  const pa = createPresenterAsk((c) => void sent.push(c));
  document.body.replaceChildren(pa.el);
  return { pa, sent };
}

describe("presenter free-text controls", () => {
  it("launches a question with the chosen limit from the sheet, default 40", async () => {
    const { pa, sent } = setup();
    pa.update(live(null));
    button(pa.el, "Lanzar pregunta").click();
    const dialog = document.querySelector("dialog")!;
    const q = dialog.querySelector("textarea")!;
    const limit = dialog.querySelector<HTMLInputElement>("input[type=number]")!;
    expect(limit.value).toBe("40");
    expect(q.maxLength).toBe(200);
    q.value = "¿Qué esperas de hoy?";
    limit.value = "25";
    dialog.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await Promise.resolve();
    expect(sent).toEqual([{ t: "ask-open", question: "¿Qué esperas de hoy?", maxChars: 25 }]);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("rejects an empty question or a limit out of range in the sheet", () => {
    const { pa, sent } = setup();
    pa.update(live(null));
    button(pa.el, "Lanzar pregunta").click();
    const dialog = document.querySelector("dialog")!;
    const form = dialog.querySelector("form")!;
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(dialog.textContent).toContain("Escribe la pregunta");
    dialog.querySelector("textarea")!.value = "Q";
    dialog.querySelector<HTMLInputElement>("input[type=number]")!.value = "5";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(dialog.textContent).toContain("de 10 a 100");
    expect(sent).toEqual([]);
  });

  it("needs the session to be live", () => {
    const { pa } = setup();
    pa.update({ status: "waiting", ask: null } as any);
    expect(button(pa.el, "Lanzar pregunta").disabled).toBe(true);
  });

  it("shows the running question and closes or removes it", () => {
    const { pa, sent } = setup();
    pa.update(live(view({ total: 3, entries: [{ text: "Rojo", count: 2 }, { text: "azul", count: 1 }] })));
    expect(pa.el.textContent).toContain("¿Color?");
    expect(pa.el.textContent).toContain("3 respuestas");
    expect(pa.el.textContent).toContain("Rojo×2");
    button(pa.el, "Cerrar respuestas").click();
    button(pa.el, "Quitar de pantalla").click();
    expect(sent).toEqual([{ t: "ask-close" }, { t: "ask-clear" }]);
    pa.update(live(view({ status: "closed" })));
    expect(button(pa.el, "Cerrar respuestas").hidden).toBe(true);
  });
});
