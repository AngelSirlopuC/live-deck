// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDesignPanel, contrastHints } from "../../web/src/editor/ui/inspector/design.ts";
import { createElementPanel } from "../../web/src/editor/ui/inspector/element.ts";
import { backgroundMode, createSlidePanel } from "../../web/src/editor/ui/inspector/slide.ts";
import { toPickerHex } from "../../web/src/editor/ui/fields.ts";
import { resolveTheme } from "../../shared/themes.ts";
import { loadedController } from "./helpers.ts";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  document.body.innerHTML = "";
});

const input = (el: Element, label: string) => {
  const lab = [...el.querySelectorAll("label")].find((l) => l.textContent === label);
  const id = lab?.getAttribute("for");
  const node = id ? (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) : null;
  if (!node) throw new Error(`no field ${label}`);
  return node;
};
const type = (node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("element inspector", () => {
  it("patches text style, box and fragment from the fields", async () => {
    const { ctrl } = await loadedController();
    const panel = createElementPanel(ctrl, { openAssetPicker: () => {}, openIconPicker: () => {} });
    document.body.append(panel.el);
    ctrl.subscribe(panel.render);
    ctrl.selectOne("titulo");
    expect(panel.el.querySelector(".ed-panel-title")?.textContent).toBe("Texto");

    type(input(panel.el, "Tamaño"), "64");
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { fontSize: 64, fontWeight: 800 } });
    type(input(panel.el, "Contenido"), "Cambiado");
    expect(ctrl.selectedElements[0]).toMatchObject({ text: "Cambiado" });
    type(input(panel.el, "X"), "25");
    expect(ctrl.selectedElements[0]?.box.x).toBe(0.25);
    type(input(panel.el, "Aparece en el paso"), "2");
    expect(ctrl.selectedElements[0]?.fragment).toBe(2);
    type(input(panel.el, "Aparece en el paso"), "");
    expect(ctrl.selectedElements[0]?.fragment).toBeUndefined();
    type(input(panel.el, "Peso"), "");
    expect((ctrl.selectedElements[0] as { style?: { fontWeight?: number } }).style?.fontWeight).toBeUndefined();

    const colorHex = input(panel.el, "Color");
    type(colorHex, "#ff0000");
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { color: "#ff0000" } });
    type(colorHex, "nope");
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { color: "#ff0000" } });
    panel.el.querySelector<HTMLButtonElement>('[aria-label="Quitar color"]')!.click();
    expect((ctrl.selectedElements[0] as { style?: { color?: string } }).style?.color).toBeUndefined();

    // Typing is one coalesced undo step per field until the field commits.
    ctrl.undo();
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { color: "#ff0000" } });
  });

  it("keeps the focused field untouched while refreshing the rest", async () => {
    const { ctrl } = await loadedController();
    const panel = createElementPanel(ctrl, { openAssetPicker: () => {}, openIconPicker: () => {} });
    document.body.append(panel.el);
    ctrl.subscribe(panel.render);
    ctrl.selectOne("titulo");
    const content = input(panel.el, "Contenido") as HTMLTextAreaElement;
    const x = input(panel.el, "X") as HTMLInputElement;
    content.focus();
    content.value = "escribiendo";
    ctrl.setBoxes({ titulo: { x: 0.4, y: 0.1, w: 0.5, h: 0.2 } });
    expect(x.value).toBe("40");
    expect(content.value).toBe("escribiendo");
    expect(panel.el.contains(content)).toBe(true);
  });

  it("edits chart rows within the kind's limits", async () => {
    const { ctrl } = await loadedController();
    const panel = createElementPanel(ctrl, { openAssetPicker: () => {}, openIconPicker: () => {} });
    document.body.append(panel.el);
    ctrl.subscribe(panel.render);
    ctrl.addElement({ kind: "chart", chart: "donut" });
    const add = [...panel.el.querySelectorAll("button")].find((b) => b.textContent?.includes("Añadir dato"))!;
    add.click();
    add.click();
    add.click();
    expect((ctrl.selectedElements[0] as { data: unknown[] }).data).toHaveLength(6);
    expect(add.disabled).toBe(true);
    const label = panel.el.querySelector<HTMLInputElement>('[aria-label="Etiqueta 1"]')!;
    type(label, "Sí");
    expect((ctrl.selectedElements[0] as { data: { label: string }[] }).data[0]?.label).toBe("Sí");
    for (let i = 0; i < 5; i++) panel.el.querySelector<HTMLButtonElement>('[aria-label="Quitar dato 1"]')!.click();
    expect((ctrl.selectedElements[0] as { data: unknown[] }).data).toHaveLength(2);
  });
});

describe("slide inspector", () => {
  it("derives the background mode and edits layout, notes, quiz and ask", async () => {
    expect(backgroundMode(undefined)).toBe("none");
    expect(backgroundMode("#fff")).toBe("color");
    expect(backgroundMode({ gradient: { from: "#000", to: "#fff" } })).toBe("gradient");
    expect(backgroundMode({ image: "assets/a.png", dim: 0.5 })).toBe("image");
    expect(backgroundMode({ pattern: "dots" })).toBe("pattern");

    const { ctrl } = await loadedController();
    const panel = createSlidePanel(ctrl, { openAssetPicker: () => {} });
    document.body.append(panel.el);
    ctrl.subscribe(panel.render);
    panel.render(ctrl.state);
    type(input(panel.el, "Notas del ponente"), "Nuevas notas");
    expect(ctrl.currentSlide?.notes).toBe("Nuevas notas");
    type(input(panel.el, "Fondo"), "color");
    expect(ctrl.currentSlide?.background).toEqual({ color: "#1a1a1a" });
    type(input(panel.el, "Oscurecer"), "0.5");
    expect(ctrl.currentSlide?.background).toEqual({ color: "#1a1a1a", dim: 0.5 });
    type(input(panel.el, "Fondo"), "none");
    expect(ctrl.currentSlide?.background).toBeUndefined();

    ctrl.selectSlide(1);
    expect(panel.el.querySelectorAll(".ed-option")).toHaveLength(3);
    type(panel.el.querySelector<HTMLInputElement>('[aria-label="Opción B"]')!, "Bravo");
    expect(ctrl.currentSlide?.quiz?.options[1]).toBe("Bravo");
    panel.el.querySelector<HTMLInputElement>('[aria-label="C es la correcta"]')!.click();
    expect(ctrl.currentSlide?.quiz?.correctIndex).toBe(2);
    panel.el.querySelector<HTMLButtonElement>('[aria-label="Quitar opción C"]')!.click();
    expect(ctrl.currentSlide?.quiz?.options).toEqual(["A", "Bravo"]);
    expect(ctrl.currentSlide?.quiz?.correctIndex).toBe(0);
    type(input(panel.el, "Temporizador"), "30");
    expect(ctrl.currentSlide?.quiz?.timerSec).toBe(30);

    ctrl.selectSlide(2);
    type(input(panel.el, "Largo máximo de respuesta"), "60");
    expect(ctrl.currentSlide?.ask?.maxChars).toBe(60);
    [...panel.el.querySelectorAll<HTMLButtonElement>(".ed-seg")].find((b) => b.textContent === "Libre")!.click();
    expect(ctrl.currentSlide?.layout).toBeUndefined();
    expect(ctrl.currentSlide?.ask).toBeUndefined();
  });
});

describe("design inspector", () => {
  it("switches presets, overrides colours and warns about contrast", async () => {
    const { ctrl } = await loadedController();
    const panel = createDesignPanel(ctrl);
    document.body.append(panel.el);
    ctrl.subscribe(panel.render);
    panel.el.querySelector<HTMLButtonElement>('[data-preset="neon"]')!.click();
    expect(ctrl.deck.theme?.preset).toBe("neon");
    expect(panel.el.querySelector('[data-preset="neon"]')?.getAttribute("aria-checked")).toBe("true");
    type(input(panel.el, "Texto"), "#111111");
    expect(ctrl.deck.theme?.foreground).toBe("#111111");
    expect(panel.el.querySelector(".ed-contrast")?.classList.contains("is-warning")).toBe(true);
    [...panel.el.querySelectorAll("button")].find((b) => b.textContent?.includes("Restablecer"))!.click();
    expect(ctrl.deck.theme).toEqual({ preset: "neon" });
    expect(panel.el.querySelector(".ed-contrast")?.classList.contains("is-warning")).toBe(false);
    type(input(panel.el, "Título del deck"), "Otro título");
    expect(ctrl.deck.title).toBe("Otro título");
  });

  it("contrastHints and toPickerHex", () => {
    expect(contrastHints(resolveTheme({ preset: "estudio" }))).toEqual([]);
    expect(contrastHints(resolveTheme({ background: "#ffffff", foreground: "#eeeeee", accent: "#ffff00" }))).toHaveLength(2);
    expect(toPickerHex("#abc")).toBe("#aabbcc");
    expect(toPickerHex("#AABBCCDD")).toBe("#aabbcc");
    expect(toPickerHex("red")).toBeNull();
  });
});
