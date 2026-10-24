// @vitest-environment jsdom
// Theme colour tokens (S8): element and slide colours may name a theme role
// instead of a hex, so switching the preset recolours them. Hex keeps working
// byte for byte (tests/theme-spec.test.ts pins that parity).
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { parseDeck, type Deck, type DeckElement, type Slide } from "../shared/deck.ts";
import { THEME_COLOR_TOKENS, THEME_COLOR_VARS, resolveColor, resolveColorHex, tokenForHex } from "../shared/theme-colors.ts";
import { THEME_PRESETS, contrastRatio, resolveThemeSpec } from "../shared/themes.ts";
import { createElementPanel, themeSwatches } from "../web/src/editor/ui/inspector/element.ts";
import { createSlidePanel } from "../web/src/editor/ui/inspector/slide.ts";
import { pasteFromClipboard, serializeElements } from "../web/src/editor/model/clipboard.ts";
import { validateDeck } from "../web/src/editor/model/validate.ts";
import { renderSlide } from "../web/src/render/slide.ts";
import { loadedController } from "./editor-ui/helpers.ts";

const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
const deckWith = (elements: DeckElement[], theme: Deck["theme"] = { preset: "estudio" }, slide: Partial<Slide> = {}): Deck => ({
  version: 1,
  title: "T",
  theme,
  slides: [{ id: "s", elements, ...slide }],
});

/** Every colour slot of the format, as a function of one colour value. */
const SLOTS: Record<string, (c: string) => Deck> = {
  "text color": (c) => deckWith([{ id: "a", type: "text", box, text: "x", style: { color: c } }]),
  "text background": (c) => deckWith([{ id: "a", type: "text", box, text: "x", style: { background: c } }]),
  "shape fill": (c) => deckWith([{ id: "a", type: "shape", shape: "rect", box, style: { fill: c } }]),
  "shape stroke": (c) => deckWith([{ id: "a", type: "shape", shape: "rect", box, style: { stroke: c } }]),
  "line stroke": (c) => deckWith([{ id: "a", type: "shape", shape: "line", box: { ...box, h: 0 }, style: { stroke: c } }]),
  "icon color": (c) => deckWith([{ id: "a", type: "icon", name: "rocket", box, style: { color: c } }]),
  "icon background": (c) => deckWith([{ id: "a", type: "icon", name: "rocket", box, style: { background: c } }]),
  "chart color": (c) => deckWith([{ id: "a", type: "chart", kind: "bar", box, data: [{ label: "a", value: 1 }], style: { color: c } }]),
  "decor color": (c) => deckWith([{ id: "a", type: "decor", shape: "star", box, style: { color: c } }]),
  "qr color": (c) => deckWith([{ id: "a", type: "qr", box, style: { color: c } }]),
  "qr background": (c) => deckWith([{ id: "a", type: "qr", box, style: { background: c } }]),
  "slide background string": (c) => deckWith([], { preset: "estudio" }, { background: c }),
  "slide background color": (c) => deckWith([], { preset: "estudio" }, { background: { color: c } }),
  "gradient from": (c) => deckWith([], { preset: "estudio" }, { background: { gradient: { from: c, to: "#000000" } } }),
  "gradient to": (c) => deckWith([], { preset: "estudio" }, { background: { gradient: { from: "#000000", to: c } } }),
};

describe("schema: colour fields accept a hex or a theme token", () => {
  for (const [slot, make] of Object.entries(SLOTS)) {
    it(`${slot}: accepts every token and a hex, rejects anything else`, () => {
      for (const token of THEME_COLOR_TOKENS) expect(parseDeck(make(token)).ok, token).toBe(true);
      expect(parseDeck(make("#ab12cd")).ok).toBe(true);
      for (const bad of ["red", "var(--theme-fg)", "primary", "Text", "#ggg", "rgb(1,2,3)"]) {
        const r = parseDeck(make(bad));
        expect(r.ok, bad).toBe(false);
        if (!r.ok) expect(r.error).toMatch(/hex|token/);
      }
    });
  }

  it("keeps theme-level colours, palette and art stops hex-only", () => {
    expect(parseDeck(deckWith([], { preset: "estudio", accent: "text" })).ok).toBe(false);
    expect(parseDeck(deckWith([], { preset: "estudio", surface: "surface" })).ok).toBe(false);
    expect(parseDeck(deckWith([], { preset: "estudio", palette: ["accent", "#000", "#fff"] })).ok).toBe(false);
    expect(parseDeck(deckWith([], { preset: "estudio", art: { kind: "glow", from: "accent" } })).ok).toBe(false);
  });
});

describe("resolveColor", () => {
  const spec = resolveThemeSpec({ preset: "papel" });

  it("maps each token to its stage variable and a hex to itself", () => {
    for (const token of THEME_COLOR_TOKENS) expect(resolveColor(token, spec)).toBe(`var(${THEME_COLOR_VARS[token]})`);
    expect(resolveColor("#123456", spec)).toBe("#123456");
  });

  it("resolves tokens to the theme hex, so contrast maths can use them", () => {
    expect(resolveColorHex("accent", spec)).toBe(THEME_PRESETS.papel.colors.accent);
    expect(resolveColorHex("on-accent", spec)).toBe(THEME_PRESETS.papel.colors.onAccent);
    expect(resolveColorHex("#123456", spec)).toBe("#123456");
  });

  it("gives plain decks a hex fallback for the variables their stage never defines", () => {
    const plain = resolveThemeSpec({ background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45" });
    expect(resolveColor("surface", plain)).toBe(`var(--theme-surface, ${plain.colors.surface})`);
    expect(resolveColor("on-accent", plain)).toBe(`var(--theme-on-accent, ${plain.colors.onAccent})`);
    expect(resolveColor("accent", plain)).toBe("var(--theme-accent)");
  });

  it("finds the token of an exact theme hex", () => {
    expect(tokenForHex("#B8381F", spec.colors)).toBe("accent");
    expect(tokenForHex("#123456", spec.colors)).toBeUndefined();
  });
});

const render = (deck: Deck) => renderSlide(deck, 0, { step: 0 });
/** jsdom serialises a hex colour as rgb(). */
const rgbOf = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const node = (deck: Deck) => render(deck).querySelector<HTMLElement>('[data-element-id="a"]')!;

describe("renderer: tokens become stage variables, hex stays as written", () => {
  it("text colour and background", () => {
    const n = node(deckWith([{ id: "a", type: "text", box, text: "x", style: { color: "muted", background: "surface" } }]));
    expect(n.style.color).toBe("var(--theme-muted)");
    expect(n.style.background).toBe("var(--theme-surface)");
    const hex = node(deckWith([{ id: "a", type: "text", box, text: "x", style: { color: "#9aa3b2", background: "#1b2130" } }]));
    expect(hex.style.color).toBe("rgb(154, 163, 178)");
    expect(hex.style.getPropertyValue("background")).toBe("rgb(27, 33, 48)");
  });

  it("shape fill and stroke, line stroke", () => {
    const n = node(deckWith([{ id: "a", type: "shape", shape: "rect", box, style: { fill: "accent", stroke: "text", strokeWidth: 3 } }]));
    expect(n.style.background).toBe("var(--theme-accent)");
    expect(n.style.border).toBe("3px solid var(--theme-fg)");
    const line = node(deckWith([{ id: "a", type: "shape", shape: "line", box: { ...box, h: 0 }, style: { stroke: "muted" } }]));
    expect(line.style.borderTop).toBe("4px solid var(--theme-muted)");
  });

  it("icon colour and background", () => {
    const n = node(deckWith([{ id: "a", type: "icon", name: "rocket", box, style: { color: "on-accent", background: "accent" } }]));
    expect(n.style.color).toBe("var(--theme-on-accent)");
    expect(n.style.background).toBe("var(--theme-accent)");
  });

  it("icon contrast fallback reads a token background as its hex", () => {
    // Brutalista accent on an accent tile: 1:1, so the default icon colour falls back to the text colour.
    const onAccent = node(deckWith([{ id: "a", type: "icon", name: "rocket", box, style: { background: "accent" } }], { preset: "brutalista" }));
    expect(onAccent.style.color).toBe("var(--theme-fg)");
    // Neon accent on the neon surface reads fine: the accent stays.
    const onSurface = node(deckWith([{ id: "a", type: "icon", name: "rocket", box, style: { background: "surface" } }], { preset: "neon" }));
    expect(onSurface.style.color).toBe("var(--theme-accent)");
    const neon = resolveThemeSpec({ preset: "neon" });
    expect(contrastRatio(neon.colors.accent, neon.colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it("chart bar colour", () => {
    const n = node(deckWith([{ id: "a", type: "chart", kind: "bar", box, data: [{ label: "a", value: 1 }], style: { color: "muted" } }]));
    const bar = n.querySelector<SVGElement>(".chart-bar")!;
    expect(bar.style.fill).toBe("var(--theme-muted)");
    const hex = node(deckWith([{ id: "a", type: "chart", kind: "bar", box, data: [{ label: "a", value: 1 }], style: { color: "#123456" } }]));
    expect(hex.querySelector(".chart-bar")!.getAttribute("fill")).toBe("#123456");
  });

  it("decor colour", () => {
    const n = node(deckWith([{ id: "a", type: "decor", shape: "star", box, style: { color: "muted" } }]));
    expect(n.querySelector<SVGElement>("path")!.style.fill).toBe("var(--theme-muted)");
    const stroked = node(deckWith([{ id: "a", type: "decor", shape: "rings", box, style: { color: "text" } }]));
    expect(stroked.querySelector<SVGElement>("circle")!.style.stroke).toBe("var(--theme-fg)");
    const hex = node(deckWith([{ id: "a", type: "decor", shape: "star", box, style: { color: "#123456" } }]));
    expect(hex.querySelector("path")!.getAttribute("fill")).toBe("#123456");
  });

  it("qr colour and background", () => {
    const n = node(deckWith([{ id: "a", type: "qr", box, style: { color: "background", background: "text" } }]));
    expect(n.style.color).toBe("var(--theme-bg)");
    expect(n.style.background).toBe("var(--theme-fg)");
  });

  it("slide ground tokens resolve to the theme hex on the stage, gradient stops to variables", () => {
    const papel = resolveThemeSpec({ preset: "papel" });
    const str = render(deckWith([], { preset: "papel" }, { background: "accent" }));
    expect(str.style.getPropertyValue("--theme-bg")).toBe(papel.colors.accent);
    const obj = render(deckWith([], { preset: "papel" }, { background: { color: "surface" } }));
    expect(obj.style.getPropertyValue("--theme-bg")).toBe(papel.colors.surface);
    const grad = render(deckWith([], { preset: "papel" }, { background: { gradient: { from: "accent", to: "background", angle: 90 } } }));
    expect(grad.querySelector<HTMLElement>(".stage-bg-gradient")!.style.getPropertyValue("--bg-gradient")).toBe("linear-gradient(90deg, var(--theme-accent), var(--theme-bg))");
  });

  it("`background` keeps meaning the theme background on a slide with its own ground", () => {
    const papel = resolveThemeSpec({ preset: "papel" });
    const inverted = render(deckWith([{ id: "a", type: "text", box, text: "x", style: { color: "background" } }], { preset: "papel" }, { background: { color: "text" } }));
    expect(inverted.style.getPropertyValue("--theme-bg")).toBe(papel.colors.foreground);
    expect(inverted.querySelector<HTMLElement>('[data-element-id="a"]')!.style.color).not.toBe("var(--theme-bg)");
    expect(inverted.querySelector<HTMLElement>('[data-element-id="a"]')!.style.color).toBe(rgbOf(papel.colors.background));
    const grad = render(deckWith([], { preset: "papel" }, { background: { color: "accent", gradient: { from: "accent", to: "background" } } }));
    expect(grad.querySelector<HTMLElement>(".stage-bg-gradient")!.style.getPropertyValue("--bg-gradient")).toBe(`linear-gradient(135deg, var(--theme-accent), ${papel.colors.background})`);
    // A slide on the theme ground keeps the variable, so the preset switch still recolours it live.
    const plainGround = node(deckWith([{ id: "a", type: "text", box, text: "x", style: { color: "background" } }], { preset: "papel" }));
    expect(plainGround.style.color).toBe("var(--theme-bg)");
  });

  it("switching the preset recolours a token-coloured element", () => {
    const card: DeckElement = { id: "a", type: "text", box, text: "x", style: { color: "text", background: "surface" } };
    const estudio = render(deckWith([card], { preset: "estudio" }));
    const papel = render(deckWith([card], { preset: "papel" }));
    const resolved = (stage: HTMLElement, v: string) => stage.style.getPropertyValue(v);
    expect(resolved(estudio, "--theme-surface")).toBe(THEME_PRESETS.estudio.colors.surface);
    expect(resolved(papel, "--theme-surface")).toBe(THEME_PRESETS.papel.colors.surface);
    expect(resolved(estudio, "--theme-surface")).not.toBe(resolved(papel, "--theme-surface"));
    expect(estudio.querySelector<HTMLElement>('[data-element-id="a"]')!.style.background).toBe("var(--theme-surface)");
    expect(papel.querySelector<HTMLElement>('[data-element-id="a"]')!.style.background).toBe("var(--theme-surface)");
  });
});

describe("editor model: validateDeck mirrors the colour rule", () => {
  const base = deckWith([{ id: "a", type: "text", box, text: "x", style: { color: "accent", background: "#1b2130" } }]);

  it("accepts tokens and hex everywhere, rejects other strings with a Spanish message", () => {
    expect(validateDeck(base)).toEqual([]);
    const bad = deckWith(
      [
        { id: "a", type: "text", box, text: "x", style: { color: "rojo" } },
        { id: "b", type: "shape", shape: "rect", box, style: { fill: "var(--x)" } },
        { id: "c", type: "icon", name: "rocket", box, style: { background: "Accent" } },
      ],
      { preset: "estudio" },
      { background: { gradient: { from: "accent", to: "blue" } } },
    );
    const issues = validateDeck(bad);
    expect(issues.map((i) => i.path)).toEqual(["slides.0.background.gradient.to", "slides.0.elements.0.style.color", "slides.0.elements.1.style.fill", "slides.0.elements.2.style.background"]);
    for (const i of issues) expect(i.message).toMatch(/hex .*color del tema|text, muted, accent, surface, background, on-accent/);
  });

  it("keeps theme-level colours hex-only", () => {
    expect(validateDeck({ ...base, theme: { preset: "estudio", accent: "text" } }).map((i) => i.path)).toEqual(["theme.accent"]);
  });
});

describe("editor UI: colour fields offer token swatches", () => {
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
    const found = id ? (document.getElementById(id) as HTMLInputElement | null) : null;
    if (!found) throw new Error(`no field ${label}`);
    return found;
  };
  const type = (n: HTMLInputElement, value: string) => {
    n.value = value;
    n.dispatchEvent(new Event("input", { bubbles: true }));
    n.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const swatch = (el: Element, field: string, name: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${field}: ${name}"]`)!;

  it("lists the six roles with Spanish labels and the resolved preview colour", async () => {
    const { ctrl } = await loadedController();
    const swatches = themeSwatches(ctrl.state);
    expect(swatches.map((s) => s.name)).toEqual(["Texto", "Apagado", "Acento", "Superficie", "Fondo", "Sobre acento"]);
    expect(swatches.map((s) => s.token)).toEqual(["text", "muted", "accent", "surface", "background", "on-accent"]);
    expect(swatches.find((s) => s.token === "accent")?.value).toBe(THEME_PRESETS.estudio.colors.accent);
  });

  it("a swatch writes the token, shows it pressed, and a typed hex replaces it", async () => {
    const { ctrl } = await loadedController();
    const panel = createElementPanel(ctrl, { openAssetPicker: () => {}, openIconPicker: () => {} });
    document.body.append(panel.el);
    ctrl.subscribe(panel.render);
    ctrl.selectOne("titulo");

    swatch(panel.el, "Color", "Acento").click();
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { color: "accent" } });
    expect(swatch(panel.el, "Color", "Acento").getAttribute("aria-pressed")).toBe("true");
    expect(swatch(panel.el, "Color", "Texto").getAttribute("aria-pressed")).toBe("false");
    const row = swatch(panel.el, "Color", "Acento").closest(".ed-field")!;
    const picker = row.querySelector<HTMLInputElement>(".ed-color-picker")!;
    expect(picker.value).toBe(THEME_PRESETS.estudio.colors.accent);
    const hex = input(panel.el, "Color");
    expect(hex.value).toBe("");
    expect(hex.placeholder).toContain(THEME_PRESETS.estudio.colors.accent);

    type(hex, "#ff0000");
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { color: "#ff0000" } });
    expect(swatch(panel.el, "Color", "Acento").getAttribute("aria-pressed")).toBe("false");
    // A hex the native picker cannot show (8 digits) still stays visible in the box.
    type(hex, "#ff000080");
    expect(ctrl.selectedElements[0]).toMatchObject({ style: { color: "#ff000080" } });
    panel.render(ctrl.state);
    expect(hex.value).toBe("#ff000080");

    // Swatches of the slide background behave the same way.
    const slidePanel = createSlidePanel(ctrl, { openAssetPicker: () => {} });
    document.body.append(slidePanel.el);
    ctrl.subscribe(slidePanel.render);
    slidePanel.render(ctrl.state);
    type(input(slidePanel.el, "Fondo") as HTMLInputElement, "color");
    swatch(slidePanel.el, "Color", "Superficie").click();
    expect(ctrl.currentSlide?.background).toEqual({ color: "surface" });
  });

  it("copy, paste and duplicate keep tokens", async () => {
    const { ctrl } = await loadedController();
    ctrl.selectOne("titulo");
    ctrl.patchSelected({ style: { color: "accent" } });
    ctrl.duplicateSelected();
    const copies = ctrl.currentSlide!.elements.filter((e) => e.type === "text" && e.style?.color === "accent");
    expect(copies.length).toBe(2);
    const pasted = pasteFromClipboard(ctrl.deck, 1, serializeElements(copies), 0);
    expect(pasted.slides[1]!.elements.filter((e) => e.type === "text" && e.style?.color === "accent").length).toBe(2);
  });
});

describe("skill references", () => {
  it("layout recipes carry no theme hex: only the two photo-overlay recipes keep a literal white/black", () => {
    const md = readFileSync(`${process.cwd()}/skills/live-deck/references/layout-recipes.md`, "utf8");
    const lines = md.split("\n").filter((l) => /"#[0-9a-fA-F]{3,8}"/.test(l));
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('"id": "word"');
    expect(lines[1]).toContain('"id": "qr"');
    for (const hex of md.match(/"#[0-9a-fA-F]{3,8}"/g) ?? []) expect(["\"#ffffff\"", "\"#000000\""]).toContain(hex);
    // No preset colour (other than white) is hard-coded anywhere in the recipes.
    const presetHex = new Set(Object.values(THEME_PRESETS).flatMap((p) => [...Object.values(p.colors), ...Object.values(p.variant.colors)].map((c) => c.toLowerCase())));
    for (const hex of md.match(/#[0-9a-fA-F]{6}/g) ?? []) if (hex !== "#ffffff") expect(presetHex.has(hex.toLowerCase()), hex).toBe(false);
  });

  it("every JSON example in the references and SKILL.md that is a whole deck parses", () => {
    const files = ["skills/live-deck/SKILL.md", "skills/live-deck/references/layout-recipes.md", "skills/live-deck/references/deck-format.md", "skills/live-deck/references/themes.md"];
    let decks = 0;
    for (const f of files) {
      const md = readFileSync(`${process.cwd()}/${f}`, "utf8");
      for (const m of md.matchAll(/```json\n([\s\S]*?)```/g)) {
        let data: unknown;
        try {
          data = JSON.parse(m[1]!);
        } catch {
          continue; // fragments (single elements, arrays) are not whole decks
        }
        if (data && typeof data === "object" && "version" in data && "slides" in data) {
          decks++;
          const r = parseDeck(data);
          expect(r.ok, `${f}: ${r.ok ? "" : r.error}`).toBe(true);
        }
      }
    }
    expect(decks).toBeGreaterThan(0);
  });
});
