// @vitest-environment jsdom
// Theme engine: resolved spec, light/dark variants, custom fields, fonts and
// what the renderer paints from them. Parity against the pre-engine renderer
// is pinned by tests/fixtures/theme-parity.json (captured from git HEAD before
// the engine existed): every preset without `mode` and every shipped deck
// must render identical CSS variables, art, pattern and font links.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { Deck, Theme } from "../shared/deck.ts";
import { FONT_FAMILIES, FONT_NAMES, fontsHref } from "../shared/fonts.ts";
import { PRESET_NAMES, THEME_PRESETS, contrastRatio, luminance, resolveTheme, resolveThemeSpec, type ThemeMode } from "../shared/themes.ts";
import { renderSlide } from "../web/src/render/slide.ts";

type Snapshot = {
  preset: string | null;
  style: Record<string, string>;
  presetLayer: boolean;
  art: string | null;
  pattern: string | null;
  links: string[];
  resolved: ReturnType<typeof resolveTheme>;
};
const parity = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/theme-parity.json`, "utf8")) as Record<string, Snapshot | Snapshot[]>;

const slide = { id: "s", elements: [] as never[] };
const deckWith = (theme?: Theme): Deck => ({ version: 1, title: "T", ...(theme ? { theme } : {}), slides: [slide] });

/** Same shape the fixture was captured with. `data-mode` is new and excluded on purpose. */
function snapshot(deck: Deck, index: number): Snapshot {
  document.head.replaceChildren();
  const stage = renderSlide(deck, index, { step: 99 });
  const style: Record<string, string> = {};
  for (let i = 0; i < stage.style.length; i++) {
    const prop = stage.style[i]!;
    style[prop] = stage.style.getPropertyValue(prop);
  }
  const art = stage.querySelector<HTMLElement>(".stage-bg-preset .stage-bg-art");
  const pattern = stage.querySelector<HTMLElement>(".stage-bg-preset .stage-bg-pattern");
  return {
    preset: stage.dataset.preset ?? null,
    style: Object.fromEntries(Object.entries(style).sort()),
    presetLayer: stage.querySelector(".stage-bg-preset") !== null,
    art: art?.style.getPropertyValue("--bg-art") ?? null,
    pattern: pattern?.dataset.pattern ?? null,
    links: [...document.head.querySelectorAll<HTMLLinkElement>("link")].map((l) => l.href),
    resolved: resolveTheme(deck.theme),
  };
}

const MODES: ThemeMode[] = ["light", "dark"];
const other = (m: ThemeMode): ThemeMode => (m === "light" ? "dark" : "light");

describe("render parity with the pre-engine renderer", () => {
  it("renders a deck without a theme exactly as before", () => {
    expect(snapshot(deckWith(), 0)).toEqual(parity["none"]);
  });

  for (const preset of PRESET_NAMES) {
    it(`renders ${preset} without a mode exactly as before`, () => {
      expect(snapshot(deckWith({ preset }), 0)).toEqual(parity[`preset:${preset}`]);
    });
  }

  for (const id of ["demo", "importadas-demo", "como-crear-una-presentacion"]) {
    it(`renders every slide of decks/${id} exactly as before`, () => {
      const deck = JSON.parse(readFileSync(`${process.cwd()}/decks/${id}/deck.json`, "utf8")) as Deck;
      const expected = parity[`deck:${id}`] as Snapshot[];
      expect(deck.slides.length).toBe(expected.length);
      deck.slides.forEach((_s, i) => expect(snapshot(deck, i)).toEqual(expected[i]));
    });
  }
});

describe("light and dark variants", () => {
  for (const preset of PRESET_NAMES) {
    const native = THEME_PRESETS[preset].native;

    it(`${preset}: its native mode is a no-op and the other mode flips the ground`, () => {
      expect(MODES).toContain(native);
      expect(resolveThemeSpec({ preset, mode: native })).toEqual(resolveThemeSpec({ preset }));
      expect(resolveThemeSpec({ preset }).mode).toBe(native);
      const flipped = resolveThemeSpec({ preset, mode: other(native) });
      expect(flipped.mode).toBe(other(native));
      const lum = luminance(flipped.colors.background);
      if (other(native) === "light") expect(lum).toBeGreaterThan(0.5);
      else expect(lum).toBeLessThan(0.2);
      // Same world: the type stays.
      expect(flipped.fonts).toEqual(resolveThemeSpec({ preset }).fonts);
    });

    for (const mode of MODES) {
      it(`${preset} ${mode}: meets the S2 contrast thresholds`, () => {
        const { colors, palette } = resolveThemeSpec({ preset, mode });
        expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(colors.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
        // Native brutalista keeps its yellow accent (1.3:1 on paper) for parity; icons already fall back to fg there.
        if (!(preset === "brutalista" && mode === native)) expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.foreground, colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(palette.length).toBeGreaterThanOrEqual(3);
        for (const c of palette) expect(contrastRatio(c, colors.background), `${c} on ${colors.background}`).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it("marks the stage with data-mode and keeps data-preset", () => {
    const stage = renderSlide(deckWith({ preset: "corporativo", mode: "light" }), 0, { step: 0 });
    expect(stage.dataset.preset).toBe("corporativo");
    expect(stage.dataset.mode).toBe("light");
    expect(stage.style.getPropertyValue("--theme-bg")).toBe(resolveThemeSpec({ preset: "corporativo", mode: "light" }).colors.background);
    expect(renderSlide(deckWith({ preset: "corporativo" }), 0, { step: 0 }).dataset.mode).toBe("dark");
  });
});

describe("custom theme fields", () => {
  it("applies preset, then mode variant, then custom fields, then colour overrides", () => {
    const spec = resolveThemeSpec({
      preset: "editorial",
      mode: "dark",
      fonts: { display: "Archivo" },
      card: { radius: 12, border: "thick", shadow: "hard" },
      heading: { weight: 500, uppercase: true, tracking: 0.1 },
      art: { kind: "glow" },
      pattern: "grid",
      palette: ["#111111", "#222222", "#333333"],
      accent: "#ff0000",
    });
    const dark = resolveThemeSpec({ preset: "editorial", mode: "dark" });
    expect(spec.colors.background).toBe(dark.colors.background);
    expect(spec.colors.accent).toBe("#ff0000");
    expect(spec.fonts.display.family).toBe("Archivo");
    expect(spec.fonts.body).toEqual(dark.fonts.body);
    expect(spec.card.radius).toBe("12px");
    expect(spec.card.border).toBe("3px solid var(--theme-fg)");
    expect(spec.card.shadow).toBe("8px 8px 0 var(--theme-fg)");
    expect(spec.heading).toEqual({ weight: 500, letterSpacing: "0.1em", textTransform: "uppercase" });
    // Glow uses the final accent, after colour overrides.
    expect(spec.art).toContain("radial-gradient");
    expect(spec.art).toContain("rgba(255, 0, 0,");
    expect(spec.pattern).toBe("grid");
    expect(spec.palette).toEqual(["#111111", "#222222", "#333333"]);
  });

  it("builds art only from validated data and removes it with none", () => {
    const grad = resolveThemeSpec({ preset: "estudio", art: { kind: "gradient", from: "#102030", to: "#405060", angle: 90 } });
    expect(grad.art).toBe("linear-gradient(90deg, rgba(16, 32, 48, 0.45), rgba(64, 80, 96, 0.45))");
    expect(resolveThemeSpec({ preset: "estudio", art: { kind: "none" } }).art).toBeUndefined();
    expect(resolveThemeSpec({ preset: "papel", pattern: "none" }).pattern).toBeUndefined();
    expect(resolveThemeSpec({ preset: "estudio", card: { border: "none", shadow: "none", radius: 0 } }).card).toMatchObject({ border: "none", shadow: "none", radius: "0px" });
  });

  it("gives a theme without a preset estudio tokens plus its custom fields and derived surface/onAccent", () => {
    const spec = resolveThemeSpec({ background: "#ffffff", foreground: "#111111", accent: "#0044cc", fonts: { body: "Lora" }, pattern: "dots" });
    expect(spec.preset).toBeUndefined();
    expect(spec.plain).toBe(false);
    expect(spec.mode).toBe("light");
    expect(spec.colors.surface).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrastRatio(spec.colors.onAccent, "#0044cc")).toBeGreaterThanOrEqual(4.5);
    expect(spec.fonts.body.family).toBe("Lora");
    expect(spec.fonts.display.family).toBe("Bricolage Grotesque");
    expect(spec.pattern).toBe("dots");
    expect(spec.card.radius).toBe("28px");
    // Plain colour decks (today's format) stay plain.
    const plain = resolveThemeSpec({ background: "#10131a", foreground: "#ffffff", accent: "#ff7a45" });
    expect(plain.plain).toBe(true);
    expect(plain.mode).toBe("dark");
    expect(resolveThemeSpec(undefined).plain).toBe(true);
  });

  it("renders custom card, heading, art, pattern and fonts on the stage", () => {
    document.head.replaceChildren();
    const stage = renderSlide(
      deckWith({ preset: "corporativo", mode: "light", fonts: { display: "Playfair Display", body: "Lora" }, card: { radius: 4, border: "hairline", shadow: "soft" }, heading: { weight: 600, uppercase: true, tracking: 0.05 }, art: { kind: "gradient", from: "#ff0000", to: "#0000ff" }, pattern: "lines" }),
      0,
      { step: 0 },
    );
    expect(stage.style.getPropertyValue("--font-display")).toContain("Playfair Display");
    expect(stage.style.getPropertyValue("--font-body")).toContain("Lora");
    expect(stage.style.getPropertyValue("--card-radius")).toBe("4px");
    expect(stage.style.getPropertyValue("--card-border")).toContain("1px solid");
    expect(stage.style.getPropertyValue("--card-shadow")).not.toBe("none");
    expect(stage.style.getPropertyValue("--heading-weight")).toBe("600");
    expect(stage.style.getPropertyValue("--heading-transform")).toBe("uppercase");
    expect(stage.style.getPropertyValue("--heading-tracking")).toBe("0.05em");
    expect(stage.querySelector<HTMLElement>(".stage-bg-art")!.style.getPropertyValue("--bg-art")).toContain("rgba(255, 0, 0,");
    expect(stage.querySelector<HTMLElement>(".stage-bg-pattern")!.dataset.pattern).toBe("lines");
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')!;
    expect(link.href).toContain("family=Playfair+Display");
    expect(link.href).toContain("family=Lora");
  });

  it("uses the custom palette for charts", () => {
    const palette = ["#aa0000", "#00aa00", "#0000aa"];
    const deck: Deck = { version: 1, title: "T", theme: { preset: "neon", palette }, slides: [{ id: "s", elements: [{ id: "c", type: "chart", kind: "donut", box: { x: 0, y: 0, w: 0.5, h: 0.5 }, data: [{ label: "a", value: 1 }, { label: "b", value: 2 }, { label: "c", value: 3 }] }] }] };
    const fills = [...renderSlide(deck, 0, { step: 0 }).querySelectorAll(".chart-slice")].map((s) => s.getAttribute("fill"));
    expect(fills).toEqual(palette);
  });
});

describe("fonts", () => {
  beforeEach(() => document.head.replaceChildren());

  it("curates a Google Fonts allowlist with weights and fallbacks", () => {
    expect(FONT_NAMES.length).toBeGreaterThanOrEqual(20);
    expect(FONT_NAMES.length).toBeLessThanOrEqual(24);
    for (const name of FONT_NAMES) {
      const f = FONT_FAMILIES[name];
      expect(f.weights.length).toBeGreaterThan(0);
      expect(f.fallback.length).toBeGreaterThan(0);
    }
    for (const preset of PRESET_NAMES) {
      const { display, body, mono, accent } = THEME_PRESETS[preset].fonts;
      for (const f of [display, body, mono, accent]) if (f) expect(FONT_NAMES).toContain(f.family);
    }
  });

  it("builds one href with the chosen families and their weights, merging duplicates", () => {
    const spec = resolveThemeSpec({ preset: "brutalista", fonts: { display: "Playfair Display" } });
    const href = fontsHref(spec.fonts);
    expect(href).toContain(`family=Playfair+Display:wght@${[...FONT_FAMILIES["Playfair Display"].weights].join(";")}`);
    expect(href.match(/family=Archivo:/g)).toHaveLength(1);
    expect(href).toContain("family=Space+Mono");
  });

  it("injects one link per family set and none for the families index.html already loads", () => {
    renderSlide(deckWith({ preset: "neon" }), 0, { step: 0 });
    renderSlide(deckWith({ preset: "neon", mode: "light" }), 0, { step: 0 });
    renderSlide(deckWith({ preset: "neon", fonts: { body: "Lora" } }), 0, { step: 0 });
    expect(document.head.querySelectorAll("link")).toHaveLength(2);
    document.head.replaceChildren();
    renderSlide(deckWith({ preset: "estudio", mode: "light" }), 0, { step: 0 });
    renderSlide(deckWith({ background: "#ffffff", foreground: "#000000", accent: "#cc0000", pattern: "dots" }), 0, { step: 0 });
    expect(document.head.querySelectorAll("link")).toHaveLength(0);
    renderSlide(deckWith({ preset: "estudio", fonts: { display: "Fraunces" } }), 0, { step: 0 });
    expect(document.head.querySelectorAll("link")).toHaveLength(1);
  });
});
