// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createShell } from "../../web/src/editor/ui/shell.ts";
import { fakeServer, loadedController } from "./helpers.ts";

beforeAll(() => {
  // jsdom has no layout engine; the editor only needs these to exist.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const key = (k: string, mods: Partial<{ meta: boolean; shift: boolean; alt: boolean }> = {}, target: EventTarget = window) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: k, metaKey: !!mods.meta, shiftKey: !!mods.shift, altKey: !!mods.alt, bubbles: true, cancelable: true }));

async function mountShell(server = fakeServer()) {
  const { ctrl } = await loadedController(server);
  const print = vi.fn();
  const shell = createShell(ctrl, { assetBase: "/decks/prueba/", previewUrl: "/preview/prueba", print });
  const root = document.createElement("div");
  document.body.append(root);
  shell.mount(root);
  return { ctrl, shell, root, server, print };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("editor shell", () => {
  it("renders rail, canvas and inspector from the loaded deck", async () => {
    const { root, ctrl } = await mountShell();
    expect(root.querySelectorAll(".ed-slide")).toHaveLength(3);
    expect(root.querySelector(".ed-stage-host .stage")?.getAttribute("data-slide-id")).toBe("portada");
    expect(root.querySelector<HTMLInputElement>(".ed-title")?.value).toBe("Prueba");
    expect(root.querySelector(".ed-lamp")?.textContent).toBe("Guardado");
    expect(root.querySelectorAll(".ed-frag")).toHaveLength(1);
    ctrl.selectSlide(1);
    expect(root.querySelector(".ed-stage-host .stage")?.getAttribute("data-slide-id")).toBe("quiz");
    expect(root.querySelector(".ed-slide-badge")?.textContent).toBe("Quiz");
  });

  it("selecting an element switches to the Elemento tab and paints handles", async () => {
    const { root, ctrl, shell } = await mountShell();
    expect(shell.tabs.current).toBe("slide");
    ctrl.selectOne("titulo");
    expect(shell.tabs.current).toBe("element");
    expect(root.querySelectorAll(".ed-sel")).toHaveLength(1);
    expect(root.querySelectorAll(".ed-handle")).toHaveLength(8);
    ctrl.select(["titulo", "caja"]);
    expect(root.querySelectorAll(".ed-sel")).toHaveLength(2);
    expect(root.querySelectorAll(".ed-handle")).toHaveLength(0);
    expect(root.querySelector(".ed-panel-element .ed-panel-title")?.textContent).toBe("2 elementos");
  });

  it("keyboard shortcuts drive the controller and skip typing targets", async () => {
    const { root, ctrl } = await mountShell();
    ctrl.selectOne("caja");
    key("ArrowRight");
    expect(ctrl.selectedElements[0]?.box.x).toBeCloseTo(0.6025, 4);
    key("d", { meta: true });
    expect(ctrl.currentSlide?.elements).toHaveLength(4);
    key("z", { meta: true });
    expect(ctrl.currentSlide?.elements).toHaveLength(3);
    key("z", { meta: true, shift: true });
    expect(ctrl.currentSlide?.elements).toHaveLength(4);
    // Undo pruned the selection, so Backspace has nothing to delete until something is picked.
    key("Backspace");
    expect(ctrl.currentSlide?.elements).toHaveLength(4);
    ctrl.selectOne("caja-2");
    key("Backspace");
    expect(ctrl.currentSlide?.elements).toHaveLength(3);
    expect(ctrl.state.selection.ids).toEqual([]);

    // Typing in the title must not delete elements or undo the deck.
    ctrl.selectOne("caja");
    const title = root.querySelector<HTMLInputElement>(".ed-title")!;
    title.focus();
    key("Backspace", {}, title);
    expect(ctrl.currentSlide?.elements).toHaveLength(3);
    key("Escape", {}, title);
    expect(ctrl.state.selection.ids).toEqual([]);
    key("a", { meta: true });
    expect(ctrl.state.selection.ids).toHaveLength(3);
    key("Escape");
    expect(ctrl.state.selection.ids).toEqual([]);
    key("ArrowDown", { alt: true });
    expect(ctrl.deck.slides[1]?.id).toBe("portada");
  });

  it("⌘S saves through PUT and the lamp follows the save state", async () => {
    const { root, ctrl, server } = await mountShell();
    ctrl.dispatch({ type: "setTitle", title: "Guardado por teclado" });
    expect(root.querySelector(".ed-lamp")?.getAttribute("data-state")).toBe("standby");
    key("s", { meta: true });
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === "PUT")).toBe(true));
    await vi.waitFor(() => expect(root.querySelector(".ed-lamp")?.textContent).toBe("Guardado"));
    expect(server.deck.title).toBe("Guardado por teclado");
  });

  it("validation issues open the issues sheet and jump to the slide and element", async () => {
    const { ctrl, shell } = await mountShell();
    ctrl.selectSlide(1);
    ctrl.dispatch({ type: "setSlide", index: 1, patch: { quiz: { question: "" } } });
    ctrl.selectSlide(0);
    await shell.save();
    const sheet = document.querySelector<HTMLDialogElement>("dialog.ed-sheet")!;
    expect(sheet.querySelector("h2")?.textContent).toBe("Revisa antes de guardar");
    const issue = sheet.querySelector<HTMLButtonElement>(".ed-issue")!;
    expect(issue.textContent).toContain("Diapositiva 2");
    issue.click();
    expect(ctrl.state.selection.slide).toBe(1);
    expect(shell.tabs.current).toBe("slide");
    expect(document.querySelector("dialog.ed-sheet")).toBeNull();
  });

  it("409 opens the conflict sheet; Sobrescribir saves mine, Recargar discards", async () => {
    const { ctrl, shell, server } = await mountShell();
    ctrl.dispatch({ type: "setTitle", title: "Mío" });
    server.revision = "rev-other";
    await shell.save();
    const sheet = document.querySelector<HTMLDialogElement>("dialog.ed-sheet")!;
    expect(sheet.querySelector("h2")?.textContent).toBe("Otra persona cambió este deck");
    [...sheet.querySelectorAll("button")].find((b) => b.textContent === "Sobrescribir")!.click();
    await vi.waitFor(() => expect(server.deck.title).toBe("Mío"));
    expect(ctrl.state.saveState).toBe("saved");

    ctrl.dispatch({ type: "setTitle", title: "Otra" });
    server.revision = "rev-else";
    server.deck = { ...server.deck, title: "Ajeno" };
    await shell.save();
    [...document.querySelectorAll<HTMLButtonElement>("dialog.ed-sheet button")].find((b) => b.textContent === "Recargar")!.click();
    await vi.waitFor(() => expect(ctrl.deck.title).toBe("Ajeno"));
    expect(ctrl.state.saveState).toBe("saved");
  });

  it("shows the key prompt on 401 and reloads with the key", async () => {
    const server = fakeServer();
    server.respond((_, init) => (new Headers(init.headers as HeadersInit).get("x-admin-key") ? undefined : new Response("{}", { status: 401 })));
    const { ctrl } = await loadedController(server, null);
    const shell = createShell(ctrl, { assetBase: "/", previewUrl: "/preview/prueba" });
    const root = document.createElement("div");
    document.body.append(root);
    shell.mount(root);
    expect(ctrl.state.phase).toBe("unauthorized");
    const form = document.querySelector<HTMLFormElement>(".ed-key-form")!;
    form.querySelector("input")!.value = "secreta";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(ctrl.state.phase).toBe("ready"));
    expect(server.calls.at(-1)?.headers["x-admin-key"]).toBe("secreta");
  });

  it("inline text edit commits on ⌘Enter and cancels on Esc", async () => {
    const { ctrl, shell } = await mountShell();
    ctrl.selectOne("titulo");
    shell.canvas.startInlineEdit("titulo");
    const box = document.querySelector<HTMLElement>(".ed-inline")!;
    expect(box.textContent).toBe("Hola\nmundo");
    expect(box.getAttribute("contenteditable")).toBe("plaintext-only");
    box.textContent = "Nuevo\ntexto";
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true, cancelable: true }));
    expect(ctrl.selectedElements[0]).toMatchObject({ text: "Nuevo\ntexto" });
    expect(document.querySelector(".ed-inline")).toBeNull();

    shell.canvas.startInlineEdit("titulo");
    const again = document.querySelector<HTMLElement>(".ed-inline")!;
    again.textContent = "Descartado";
    again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(ctrl.selectedElements[0]).toMatchObject({ text: "Nuevo\ntexto" });
  });

  it("rail buttons add, duplicate and delete slides (delete confirms)", async () => {
    const { root, ctrl } = await mountShell();
    root.querySelector<HTMLButtonElement>(".ed-rail-add")!.click();
    const menu = document.querySelector(".ed-menu")!;
    [...menu.querySelectorAll("button")].find((b) => b.textContent?.includes("Pregunta abierta"))!.click();
    expect(ctrl.deck.slides).toHaveLength(4);
    expect(ctrl.currentSlide?.layout).toBe("ask");
    root.querySelector<HTMLButtonElement>('[aria-label="Duplicar diapositiva"]')!.click();
    expect(ctrl.deck.slides).toHaveLength(5);
    root.querySelector<HTMLButtonElement>('[aria-label="Borrar diapositiva"]')!.click();
    await vi.waitFor(() => expect(document.querySelector("dialog.ed-sheet")).not.toBeNull());
    [...document.querySelectorAll<HTMLButtonElement>("dialog.ed-sheet button")].find((b) => b.textContent === "Borrar")!.click();
    await vi.waitFor(() => expect(ctrl.deck.slides).toHaveLength(4));
  });

  it("the overview grid toggles with G and jumps on click", async () => {
    const { root, ctrl } = await mountShell();
    key("g");
    expect(ctrl.state.overview).toBe(true);
    const grid = root.querySelector<HTMLElement>(".ed-overview")!;
    expect(grid.hidden).toBe(false);
    expect(grid.querySelectorAll(".ed-slide")).toHaveLength(3);
    grid.querySelectorAll<HTMLButtonElement>(".ed-slide-btn")[2]!.click();
    expect(ctrl.state.selection.slide).toBe(2);
    expect(ctrl.state.overview).toBe(false);
  });

  it("Exportar PDF prints the current deck", async () => {
    const { root, print, ctrl } = await mountShell();
    [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("Exportar PDF"))!.click();
    expect(print).toHaveBeenCalledWith(ctrl.deck);
  });
});

describe("editor shell: discard and pickers", () => {
  it("Descartar shows only when dirty, confirms, and reloads the saved deck", async () => {
    const { root, ctrl, shell } = await mountShell();
    const discard = root.querySelector<HTMLButtonElement>(".ed-discard")!;
    expect(discard.hidden).toBe(true);
    ctrl.dispatch({ type: "setTitle", title: "Cambio sin guardar" });
    expect(discard.hidden).toBe(false);
    const pending = shell.discard();
    await vi.waitFor(() => expect(document.querySelector("dialog.ed-sheet")).not.toBeNull());
    [...document.querySelectorAll<HTMLButtonElement>("dialog.ed-sheet button")].find((b) => b.textContent === "Descartar")!.click();
    expect(await pending).toBe(true);
    expect(ctrl.deck.title).toBe("Prueba");
    expect(ctrl.state.saveState).toBe("saved");
    expect(ctrl.state.canUndo).toBe(false);
  });

  it("a 401 on save asks for the key and saves again with it", async () => {
    const { ctrl, shell, server } = await mountShell();
    ctrl.dispatch({ type: "setTitle", title: "Con clave nueva" });
    server.respond((_, init) => (init.method === "PUT" && new Headers(init.headers as HeadersInit).get("x-admin-key") !== "nueva" ? new Response("{}", { status: 401 }) : undefined));
    await shell.save();
    const form = document.querySelector<HTMLFormElement>(".ed-key-form")!;
    form.querySelector("input")!.value = "nueva";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(server.deck.title).toBe("Con clave nueva"));
    await vi.waitFor(() => expect(ctrl.state.saveState).toBe("saved"));
  });
});
