// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { contrastHints, createDesignPanel } from "../../web/src/editor/ui/inspector/design.ts";
import { contrastRatio, THEME_PRESETS } from "../../shared/themes.ts";
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
  document.head.querySelectorAll("link[data-theme-fonts]").forEach((l) => l.remove());
});

const field = (el: Element, label: string) => {
  const lab = [...el.querySelectorAll("label")].find((l) => l.textContent === label);
  const id = lab?.getAttribute("for");
  const node = id ? (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null) : null;
  if (!node) throw new Error(`no field ${label}`);
  return node;
};
const type = (node: HTMLInputElement | HTMLSelectElement, value: string) => {
  node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
};
const segment = (el: Element, group: string, value: string) => {
  const b = el.querySelector<HTMLButtonElement>(`[role="group"][aria-label="${group}"] .ed-seg[data-value="${value}"]`);
  if (!b) throw new Error(`no segment ${group}/${value}`);
  return b;
};
const button = (el: Element, text: string) => {
  const b = [...el.querySelectorAll("button")].find((x) => x.textContent?.trim() === text);
  if (!b) throw new Error(`no button ${text}`);
  return b;
};

async function panel() {
  const { ctrl } = await loadedController();
  const p = createDesignPanel(ctrl);
  document.body.append(p.el);
  ctrl.subscribe(p.render);
  p.render(ctrl.state);
  return { ctrl, el: p.el };
}

describe("design panel: preset pick", () => {
  it("applies the whole preset look: drops colour and style overrides, keeps the mode, and undo brings them back", async () => {
    const { ctrl, el } = await panel();
    const plain = { background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" };
    ctrl.dispatch({ type: "setTheme", patch: { preset: undefined, ...plain, fonts: { display: "Oswald" }, card: { radius: 4 }, palette: ["#111111", "#222222", "#333333"] } });
    ctrl.dispatch({ type: "setTheme", patch: { preset: "estudio", mode: "light" } });
    el.querySelector<HTMLButtonElement>('[data-preset="papel"]')!.click();
    expect(ctrl.deck.theme).toEqual({ preset: "papel", mode: "light" });
    expect(el.querySelector('[data-preset="papel"]')!.getAttribute("aria-checked")).toBe("true");
    ctrl.undo();
    expect(ctrl.deck.theme).toMatchObject({ preset: "estudio", mode: "light", ...plain, fonts: { display: "Oswald" } });
  });

  it("a plain-colour deck switches to the preset's colours", async () => {
    const { ctrl, el } = await panel();
    ctrl.dispatch({ type: "setTheme", patch: { preset: undefined, background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45" } });
    el.querySelector<HTMLButtonElement>('[data-preset="papel"]')!.click();
    expect(ctrl.deck.theme).toEqual({ preset: "papel" });
  });
});

describe("design panel: mode", () => {
  it("writes mode on Claro/Oscuro, removes it on Original, and paints preset cards in the current mode", async () => {
    const { ctrl, el } = await panel();
    const corporativo = el.querySelector<HTMLButtonElement>('[data-preset="corporativo"]')!;
    expect(corporativo.style.getPropertyValue("--p-bg")).toBe(THEME_PRESETS.corporativo.colors.background);
    expect(segment(el, "Modo", "original").getAttribute("aria-pressed")).toBe("true");
    segment(el, "Modo", "light").click();
    expect(ctrl.deck.theme).toEqual({ preset: "estudio", mode: "light" });
    expect(segment(el, "Modo", "light").getAttribute("aria-pressed")).toBe("true");
    expect(corporativo.style.getPropertyValue("--p-bg")).toBe(THEME_PRESETS.corporativo.variant.colors.background);
    expect(el.querySelector<HTMLButtonElement>('[data-preset="papel"]')!.style.getPropertyValue("--p-bg")).toBe(THEME_PRESETS.papel.colors.background);
    segment(el, "Modo", "dark").click();
    expect(ctrl.deck.theme?.mode).toBe("dark");
    segment(el, "Modo", "original").click();
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
    expect(corporativo.style.getPropertyValue("--p-bg")).toBe(THEME_PRESETS.corporativo.colors.background);
  });

  it("keeps the mode when switching preset and disables the switch without a preset", async () => {
    const { ctrl, el } = await panel();
    segment(el, "Modo", "light").click();
    el.querySelector<HTMLButtonElement>('[data-preset="neon"]')!.click();
    expect(ctrl.deck.theme).toEqual({ preset: "neon", mode: "light" });
    ctrl.dispatch({ type: "setTheme", patch: { preset: undefined, mode: undefined, background: "#000000", foreground: "#ffffff", accent: "#ff0000" } });
    expect(segment(el, "Modo", "light").disabled).toBe(true);
  });
});

describe("design panel: fonts", () => {
  it("writes and removes fonts.display and fonts.body, grouping families by voice with a live specimen", async () => {
    const { ctrl, el } = await panel();
    const display = field(el, "Fuente de títulos") as HTMLSelectElement;
    expect(display.value).toBe("");
    expect(display.querySelectorAll("optgroup").length).toBeGreaterThan(3);
    expect([...display.options].some((o) => o.value === "Fraunces")).toBe(true);
    type(display, "Fraunces");
    expect(ctrl.deck.theme?.fonts).toEqual({ display: "Fraunces" });
    const specimen = el.querySelector<HTMLElement>('.ed-specimen[data-role="display"]')!;
    expect(specimen.style.fontFamily).toContain("Fraunces");
    expect(document.head.querySelector('link[data-theme-fonts*="Fraunces"]')).not.toBeNull();
    type(field(el, "Fuente de texto") as HTMLSelectElement, "Lora");
    expect(ctrl.deck.theme?.fonts).toEqual({ display: "Fraunces", body: "Lora" });
    type(display, "");
    expect(ctrl.deck.theme?.fonts).toEqual({ body: "Lora" });
    type(field(el, "Fuente de texto") as HTMLSelectElement, "");
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
    expect(el.querySelector<HTMLElement>('.ed-specimen[data-role="body"]')!.style.fontFamily).toContain("Instrument Sans");
  });
});

describe("design panel: cards, headings, art, pattern", () => {
  it("patches card radius, border and shadow and resets each to the preset", async () => {
    const { ctrl, el } = await panel();
    const radius = field(el, "Radio") as HTMLInputElement;
    expect(radius.placeholder).toBe("28");
    type(radius, "12");
    expect(ctrl.deck.theme?.card).toEqual({ radius: 12 });
    type(radius, "99");
    expect(ctrl.deck.theme?.card).toEqual({ radius: 12 });
    segment(el, "Borde", "thick").click();
    segment(el, "Sombra", "hard").click();
    expect(ctrl.deck.theme?.card).toEqual({ radius: 12, border: "thick", shadow: "hard" });
    expect(segment(el, "Borde", "thick").getAttribute("aria-pressed")).toBe("true");
    segment(el, "Borde", "").click();
    segment(el, "Sombra", "").click();
    type(radius, "");
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
  });

  it("patches heading weight, uppercase (tri-state) and tracking", async () => {
    const { ctrl, el } = await panel();
    type(field(el, "Peso de títulos") as HTMLSelectElement, "900");
    expect(ctrl.deck.theme?.heading).toEqual({ weight: 900 });
    segment(el, "Mayúsculas", "true").click();
    expect(ctrl.deck.theme?.heading).toEqual({ weight: 900, uppercase: true });
    segment(el, "Mayúsculas", "false").click();
    expect(ctrl.deck.theme?.heading?.uppercase).toBe(false);
    type(field(el, "Espaciado") as HTMLInputElement, "0.1");
    expect(ctrl.deck.theme?.heading?.tracking).toBe(0.1);
    type(field(el, "Espaciado") as HTMLInputElement, "0.5");
    expect(ctrl.deck.theme?.heading?.tracking).toBe(0.1);
    type(field(el, "Peso de títulos") as HTMLSelectElement, "");
    segment(el, "Mayúsculas", "").click();
    type(field(el, "Espaciado") as HTMLInputElement, "");
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
  });

  it("patches art kind with from/to/angle shown only when relevant, and the pattern", async () => {
    const { ctrl, el } = await panel();
    expect(el.querySelector<HTMLElement>(".ed-art-fields")!.hidden).toBe(true);
    segment(el, "Arte", "glow").click();
    expect(ctrl.deck.theme?.art).toEqual({ kind: "glow" });
    expect(el.querySelector<HTMLElement>(".ed-art-fields")!.hidden).toBe(false);
    const from = field(el, "Desde") as HTMLInputElement;
    expect(from.placeholder).toBe(THEME_PRESETS.estudio.colors.accent);
    type(from, "#123456");
    expect(ctrl.deck.theme?.art).toEqual({ kind: "glow", from: "#123456" });
    expect(field(el, "Ángulo").closest(".ed-field")!.hasAttribute("hidden")).toBe(true);
    segment(el, "Arte", "gradient").click();
    expect(field(el, "Ángulo").closest(".ed-field")!.hasAttribute("hidden")).toBe(false);
    type(field(el, "Ángulo") as HTMLInputElement, "45");
    expect(ctrl.deck.theme?.art).toEqual({ kind: "gradient", from: "#123456", angle: 45 });
    segment(el, "Arte", "none").click();
    expect(ctrl.deck.theme?.art).toEqual({ kind: "none" });
    segment(el, "Arte", "").click();
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
    type(field(el, "Trama") as HTMLSelectElement, "grid");
    expect(ctrl.deck.theme?.pattern).toBe("grid");
    type(field(el, "Trama") as HTMLSelectElement, "");
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
  });
});

describe("design panel: palette", () => {
  it("starts from the preset's palette, edits, adds and removes within 3..8, and resets", async () => {
    const { ctrl, el } = await panel();
    expect(el.querySelectorAll(".ed-palette-chip")).toHaveLength(6);
    button(el, "Personalizar").click();
    expect(ctrl.deck.theme?.palette).toEqual([...THEME_PRESETS.estudio.palette]);
    const colors = () => [...el.querySelectorAll<HTMLInputElement>(".ed-palette-color")];
    expect(colors()).toHaveLength(6);
    type(colors()[0]!, "#112233");
    expect(ctrl.deck.theme?.palette?.[0]).toBe("#112233");
    button(el, "Añadir color").click();
    button(el, "Añadir color").click();
    expect(ctrl.deck.theme?.palette).toHaveLength(8);
    expect(button(el, "Añadir color").disabled).toBe(true);
    for (let i = 0; i < 5; i++) el.querySelector<HTMLButtonElement>('[aria-label="Quitar color 1"]')!.click();
    expect(ctrl.deck.theme?.palette).toHaveLength(3);
    expect(el.querySelector<HTMLButtonElement>('[aria-label="Quitar color 1"]')!.disabled).toBe(true);
    button(el, "Del preset").click();
    expect(ctrl.deck.theme).toEqual({ preset: "estudio" });
    expect(el.querySelectorAll(".ed-palette-chip")).toHaveLength(6);
  });
});

describe("design panel: colours and contrast", () => {
  it("shows the effective colour as placeholder and hints at the three S4 thresholds", async () => {
    const { ctrl, el } = await panel();
    const bg = field(el, "Fondo") as HTMLInputElement;
    expect(bg.placeholder).toBe(THEME_PRESETS.estudio.colors.background);
    segment(el, "Modo", "light").click();
    expect(bg.placeholder).toBe(THEME_PRESETS.estudio.variant.colors.background);
    const lightBg = THEME_PRESETS.estudio.variant.colors.background;
    const ratio = (c: string) => contrastRatio(c, lightBg).toFixed(1);
    type(field(el, "Apagado") as HTMLInputElement, "#bbbbbb");
    expect(ctrl.deck.theme?.muted).toBe("#bbbbbb");
    const contrast = el.querySelector(".ed-contrast")!;
    expect(contrast.classList.contains("is-warning")).toBe(true);
    expect(contrast.textContent).toContain(`Apagado sobre fondo: ${ratio("#bbbbbb")}:1, por debajo de 3:1.`);
    type(field(el, "Acento") as HTMLInputElement, "#eeeeee");
    expect(contrast.textContent).toContain(`Acento sobre fondo: ${ratio("#eeeeee")}:1, por debajo de 3:1.`);
    type(field(el, "Texto") as HTMLInputElement, "#999999");
    expect(contrast.textContent).toContain(`Texto sobre fondo: ${ratio("#999999")}:1, por debajo de 4.5:1.`);
    expect(Number(ratio("#999999"))).toBeLessThan(4.5);
    button(el, "Restablecer").click();
    expect(ctrl.deck.theme).toEqual({ preset: "estudio", mode: "light" });
    expect(contrast.classList.contains("is-warning")).toBe(false);
  });

  it("contrastHints mirrors contrastWarnings, native brutalista included", () => {
    expect(contrastHints({ preset: "brutalista" })).toEqual([]);
    expect(contrastHints({ preset: "brutalista", mode: "dark" })).toEqual([]);
    expect(contrastHints({ background: "#ffffff", foreground: "#eeeeee", accent: "#ffff00" })).toHaveLength(3);
  });
});
