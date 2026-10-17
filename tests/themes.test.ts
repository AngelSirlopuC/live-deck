import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "../shared/deck-core.ts";
import { ICON_NAMES, ICON_NODES } from "../shared/icons.ts";
import { PRESET_NAMES, THEME_PRESETS, presetFontsHref, resolveTheme } from "../shared/themes.ts";

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme presets", () => {
  it("ships the six named presets", () => {
    expect([...PRESET_NAMES]).toEqual(["estudio", "editorial", "neon", "papel", "brutalista", "corporativo"]);
  });

  it("keeps estudio identical to the default look", () => {
    const { background, foreground, accent, muted } = THEME_PRESETS.estudio.colors;
    expect({ background, foreground, accent, muted }).toEqual(DEFAULT_THEME);
  });

  for (const name of PRESET_NAMES) {
    describe(name, () => {
      const preset = THEME_PRESETS[name];

      it("defines hex colours and a categorical palette of at most six", () => {
        for (const c of Object.values(preset.colors)) expect(c).toMatch(HEX);
        expect(preset.palette.length).toBeGreaterThanOrEqual(2);
        expect(preset.palette.length).toBeLessThanOrEqual(6);
        for (const c of preset.palette) expect(c).toMatch(HEX);
      });

      it("keeps text readable on its ground and on its cards", () => {
        const { background, foreground, muted, surface, accent, onAccent } = preset.colors;
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
      });

      it("names display, body and mono font families", () => {
        expect(preset.fonts.display.family).not.toMatch(/^(Inter|Roboto|Arial)$/);
        for (const role of ["display", "body", "mono"] as const) expect(preset.fonts[role].family.length).toBeGreaterThan(0);
      });
    });
  }

  it("builds one Google Fonts stylesheet URL per preset with merged families", () => {
    const href = presetFontsHref("brutalista");
    expect(href.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
    expect(href.match(/family=Archivo:/g)).toHaveLength(1);
    expect(href).toContain("display=swap");
    expect(presetFontsHref("editorial")).toContain("family=Fraunces");
  });
});

describe("resolveTheme", () => {
  it("falls back to the default colours without a theme", () => {
    const t = resolveTheme(undefined);
    expect(t.preset).toBeUndefined();
    expect(t.colors.background).toBe(DEFAULT_THEME.background);
    expect(t.palette).toEqual(THEME_PRESETS.estudio.palette);
  });

  it("uses a legacy theme as-is", () => {
    const t = resolveTheme({ background: "#ffffff", foreground: "#000000", accent: "#ff0000" });
    expect(t.colors).toMatchObject({ background: "#ffffff", foreground: "#000000", accent: "#ff0000", muted: DEFAULT_THEME.muted });
  });

  it("applies preset colours and then the deck overrides", () => {
    const t = resolveTheme({ preset: "neon", accent: "#123456", surface: "#222222" });
    expect(t.preset).toBe("neon");
    expect(t.colors.accent).toBe("#123456");
    expect(t.colors.surface).toBe("#222222");
    expect(t.colors.background).toBe(THEME_PRESETS.neon.colors.background);
  });
});

describe("icons", () => {
  it("curates about eighty Lucide icons by kebab-case name", () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(70);
    expect(ICON_NAMES.length).toBeLessThanOrEqual(100);
    for (const name of ICON_NAMES) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(ICON_NODES[name].length).toBeGreaterThan(0);
    }
    expect(ICON_NAMES).toEqual(expect.arrayContaining(["rocket", "message-circle", "bar-chart-3"]));
  });
});
