// Theme presets and the theme engine. Each preset is a complete visual world
// (colours, type, slide ground, card and heading treatment, chart palette) in
// a native light or dark mode plus a designed variant for the other mode. A
// deck picks a preset, may flip its mode, may set data-only custom fields
// (fonts from the allowlist, card, heading, art, pattern, palette) and may
// override colours; `resolveThemeSpec` folds all of that into one spec the
// renderer paints. No schema dependency, so the browser bundle can import it.
import { DEFAULT_THEME } from "./deck-core.ts";
import type { Theme } from "./deck.ts";
import { FONT_FAMILIES, fontStack, fontsHref, themeFont, type FontName, type ThemeFont } from "./fonts.ts";

export { fontStack, fontsHref };

export const PRESET_NAMES = ["estudio", "editorial", "neon", "papel", "brutalista", "corporativo"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];
export type ThemeMode = "light" | "dark";
export type ThemePattern = "dots" | "grid" | "lines" | "noise";

/** @deprecated name kept for existing imports; fonts now come from the allowlist. */
export type PresetFont = ThemeFont;

export interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  /** Card and panel surface. */
  surface: string;
  /** Text drawn on top of an accent fill. */
  onAccent: string;
}

export interface ThemeFonts {
  display: ThemeFont;
  body: ThemeFont;
  mono: ThemeFont;
  /** Used by `mark` text. */
  accent?: ThemeFont;
}

export interface CardTokens {
  radius: string;
  border: string;
  shadow: string;
  background: string;
  padding: string;
}

export interface HeadingTokens {
  weight: number;
  letterSpacing: string;
  textTransform: "none" | "uppercase";
}

/** What a mode variant may change: the ground, the art and card chrome, the chart palette. The type stays. */
export interface PresetVariant {
  colors: ThemeColors;
  /** CSS background-image layers painted over the ground colour (translucent so colour overrides still read). */
  art?: string;
  /** Built-in pattern painted over the ground. */
  pattern?: ThemePattern;
  card: CardTokens;
  /** Categorical chart palette in fixed order, each colour at 3:1 or better against `colors.background`. */
  palette: readonly string[];
}

export interface ThemePreset extends PresetVariant {
  /** The mode of the top-level values; `variant` is the other one. */
  native: ThemeMode;
  fonts: ThemeFonts;
  heading: HeadingTokens;
  variant: PresetVariant;
}

const sans = "ui-sans-serif, system-ui, sans-serif";
const serif = "ui-serif, Georgia, serif";
const mono = "ui-monospace, monospace";
const f = themeFont;

/** Card chrome shared by most presets: surface fill, hairline border, soft shadow. */
const softCard = (shadow: string, radius: string, border = "1px solid color-mix(in srgb, var(--theme-fg) 10%, transparent)"): CardTokens => ({
  radius,
  border,
  shadow,
  background: "var(--theme-surface)",
  padding: "40px",
});

export const THEME_PRESETS: Record<PresetName, ThemePreset> = {
  // Today's look: warm charcoal, cream type, amber accent. Light: warm paper, charcoal type, burnt orange.
  estudio: {
    native: "dark",
    colors: { ...DEFAULT_THEME, surface: "#1b202b", onAccent: "#10131a" },
    fonts: { display: f("Bricolage Grotesque"), body: f("Instrument Sans"), mono: f("JetBrains Mono") },
    art: "radial-gradient(1100px 760px at 88% -12%, rgba(255, 122, 69, 0.16), transparent 62%)",
    card: softCard("0 28px 56px -28px rgba(0, 0, 0, 0.7)", "28px"),
    heading: { weight: 800, letterSpacing: "-0.02em", textTransform: "none" },
    palette: ["#e8683a", "#3987e5", "#199e70", "#c98500", "#d55181", "#9085e9"],
    variant: {
      colors: { background: "#f6f1e7", foreground: "#1d1a17", accent: "#c24a16", muted: "#5d5750", surface: "#fffbf4", onAccent: "#fff8f0" },
      art: "radial-gradient(1100px 760px at 88% -12%, rgba(194, 74, 22, 0.14), transparent 62%)",
      card: softCard("0 24px 48px -28px rgba(40, 30, 20, 0.35)", "28px"),
      palette: ["#c24a16", "#2460b0", "#157a55", "#8a5e00", "#b03a68", "#5e4fc4"],
    },
  },
  // Warm paper, ink and vermilion; high-contrast serif, hairlines, square corners. Dark: ink page, paper type, coral.
  editorial: {
    native: "light",
    colors: { background: "#f3eee4", foreground: "#1a1714", accent: "#c8361b", muted: "#5f574d", surface: "#fbf8f2", onAccent: "#fbf8f2" },
    fonts: { display: f("Fraunces"), body: f("Newsreader"), mono: f("IBM Plex Mono") },
    card: softCard("none", "0px", "1px solid color-mix(in srgb, var(--theme-fg) 28%, transparent)"),
    heading: { weight: 800, letterSpacing: "-0.035em", textTransform: "none" },
    palette: ["#d9442a", "#2a6fc0", "#a87400", "#1b9a6a", "#b24f9a", "#6250d6"],
    variant: {
      colors: { background: "#15120f", foreground: "#f3eee4", accent: "#ff6a45", muted: "#b3a99a", surface: "#1f1b17", onAccent: "#15120f" },
      card: softCard("none", "0px", "1px solid color-mix(in srgb, var(--theme-fg) 28%, transparent)"),
      palette: ["#ff7a5c", "#6ea6ff", "#e0b84a", "#4fcf9a", "#e58cd0", "#a99bff"],
    },
  },
  // Near-black with colour glows, electric green and magenta, dark glass cards. Light: ice white with the same glows, deep teal and magenta.
  neon: {
    native: "dark",
    colors: { background: "#07080d", foreground: "#eef1ff", accent: "#2bf5b5", muted: "#a3a8c8", surface: "#12141f", onAccent: "#07080d" },
    fonts: { display: f("Unbounded"), body: f("Space Grotesk"), mono: f("Space Mono") },
    art:
      "radial-gradient(900px 680px at 12% 8%, rgba(43, 245, 181, 0.2), transparent 62%), " +
      "radial-gradient(1000px 760px at 92% 96%, rgba(224, 64, 200, 0.24), transparent 62%)",
    card: {
      radius: "22px",
      border: "1px solid color-mix(in srgb, var(--theme-accent) 55%, transparent)",
      shadow: "0 0 0 1px color-mix(in srgb, var(--theme-accent) 12%, transparent), 0 0 48px -10px color-mix(in srgb, var(--theme-accent) 45%, transparent)",
      background: "color-mix(in srgb, var(--theme-surface) 74%, transparent)",
      padding: "40px",
    },
    heading: { weight: 700, letterSpacing: "-0.02em", textTransform: "none" },
    palette: ["#13a87a", "#d63fbf", "#3d7fff", "#c98500", "#8f6bff", "#e8475d"],
    variant: {
      colors: { background: "#f2f4ff", foreground: "#0b0d1a", accent: "#00805f", muted: "#4b5176", surface: "#ffffff", onAccent: "#f2fff9" },
      art:
        "radial-gradient(900px 680px at 12% 8%, rgba(43, 245, 181, 0.28), transparent 62%), " +
        "radial-gradient(1000px 760px at 92% 96%, rgba(224, 64, 200, 0.2), transparent 62%)",
      card: {
        radius: "22px",
        border: "1px solid color-mix(in srgb, var(--theme-accent) 45%, transparent)",
        shadow: "0 0 0 1px color-mix(in srgb, var(--theme-accent) 10%, transparent), 0 24px 48px -24px color-mix(in srgb, var(--theme-accent) 40%, transparent)",
        background: "color-mix(in srgb, var(--theme-surface) 82%, transparent)",
        padding: "40px",
      },
      palette: ["#00805f", "#b8169a", "#1f5fe0", "#8a6000", "#6a4ff0", "#c8203a"],
    },
  },
  // Kraft paper with grain, brown ink, tomato accent, friendly rounded type and a hand for marks. Dark: kraft at night, cream ink, warm orange.
  papel: {
    native: "light",
    colors: { background: "#e6d3b3", foreground: "#3a2a1c", accent: "#b8381f", muted: "#5e4630", surface: "#f8f1e3", onAccent: "#fbf6ec" },
    fonts: { display: f("Fredoka"), body: f("Nunito"), mono: f("Courier Prime"), accent: f("Caveat") },
    art: "radial-gradient(1400px 900px at 50% 40%, transparent 55%, rgba(84, 52, 20, 0.18))",
    pattern: "noise",
    card: {
      radius: "6px",
      border: "1px solid rgba(84, 52, 20, 0.12)",
      shadow: "0 2px 0 rgba(84, 52, 20, 0.08), 0 18px 36px -18px rgba(84, 52, 20, 0.55)",
      background: "var(--theme-surface)",
      padding: "40px",
    },
    heading: { weight: 600, letterSpacing: "-0.01em", textTransform: "none" },
    palette: ["#c0402a", "#2f6aa3", "#a86a10", "#8e3f86", "#2a7d4f", "#5257b8"],
    variant: {
      colors: { background: "#2a1d12", foreground: "#f3e6cf", accent: "#ff8c5a", muted: "#c9b595", surface: "#3a2a1c", onAccent: "#2a1d12" },
      art: "radial-gradient(1400px 900px at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.35))",
      pattern: "noise",
      card: {
        radius: "6px",
        border: "1px solid rgba(243, 230, 207, 0.14)",
        shadow: "0 2px 0 rgba(0, 0, 0, 0.3), 0 18px 36px -18px rgba(0, 0, 0, 0.7)",
        background: "var(--theme-surface)",
        padding: "40px",
      },
      palette: ["#ff8c5a", "#7fb0e8", "#e0a84a", "#d98ad0", "#7fcf9a", "#a9a4ff"],
    },
  },
  // Neobrutalist: off-white, black, yellow, thick borders and hard offset shadows. Dark: black page, paper type, the same yellow.
  brutalista: {
    native: "light",
    colors: { background: "#f4f1e8", foreground: "#0a0a0a", accent: "#ffd400", muted: "#45423b", surface: "#ffffff", onAccent: "#0a0a0a" },
    fonts: { display: f("Archivo"), body: f("Archivo"), mono: f("Space Mono") },
    card: { radius: "0px", border: "5px solid var(--theme-fg)", shadow: "12px 12px 0 var(--theme-fg)", background: "var(--theme-surface)", padding: "36px" },
    heading: { weight: 900, letterSpacing: "-0.01em", textTransform: "uppercase" },
    palette: ["#e4572e", "#2a5bd7", "#a87c00", "#c2408a", "#1f8a3c", "#6250d6"],
    variant: {
      colors: { background: "#111111", foreground: "#f4f1e8", accent: "#ffd400", muted: "#bdb8ab", surface: "#1c1c1c", onAccent: "#0a0a0a" },
      card: { radius: "0px", border: "5px solid var(--theme-fg)", shadow: "12px 12px 0 var(--theme-accent)", background: "var(--theme-surface)", padding: "36px" },
      palette: ["#ff7a4f", "#6f94ff", "#ffd400", "#ff7ac0", "#5fd37a", "#a99bff"],
    },
  },
  // Deep navy gradient, white type, bright blue, soft rounded surfaces. Light: white and cool grey, navy type, blue accent (bright rooms).
  corporativo: {
    native: "dark",
    colors: { background: "#0b1a36", foreground: "#ffffff", accent: "#3d8bff", muted: "#a9b8d6", surface: "#14264a", onAccent: "#06122a" },
    fonts: { display: f("Plus Jakarta Sans"), body: f("Plus Jakarta Sans"), mono: f("JetBrains Mono") },
    art: "linear-gradient(160deg, transparent 10%, rgba(38, 92, 196, 0.34) 100%)",
    card: softCard("0 16px 40px -16px rgba(0, 0, 0, 0.55)", "16px"),
    heading: { weight: 800, letterSpacing: "-0.025em", textTransform: "none" },
    palette: ["#3b8cff", "#d9702a", "#169a84", "#b38a12", "#d0609f", "#8b7cf0"],
    variant: {
      colors: { background: "#f5f7fb", foreground: "#0b1a36", accent: "#1a63d6", muted: "#4b5a78", surface: "#ffffff", onAccent: "#ffffff" },
      art: "linear-gradient(160deg, transparent 10%, rgba(38, 92, 196, 0.12) 100%)",
      card: softCard("0 16px 40px -16px rgba(11, 26, 54, 0.18)", "16px"),
      palette: ["#1a63d6", "#b84e0e", "#0d7a66", "#7a5c00", "#a8347c", "#5e4bcf"],
    },
  },
};

/** The variant of a preset in a given mode. */
export function presetVariant(name: PresetName, mode: ThemeMode): PresetVariant {
  const preset = THEME_PRESETS[name];
  return mode === preset.native ? preset : preset.variant;
}

// ---------------------------------------------------------------------------
// Resolved spec

export interface ThemeSpec {
  preset?: PresetName;
  mode: ThemeMode;
  /** True for a deck with no preset and no custom fields: only its four colours apply (today's plain format). */
  plain: boolean;
  colors: ThemeColors;
  fonts: ThemeFonts;
  card: CardTokens;
  heading: HeadingTokens;
  /** CSS background-image layers, built from preset code or from validated hex/number data. */
  art?: string;
  pattern?: ThemePattern;
  palette: readonly string[];
}

const CUSTOM_KEYS = ["fonts", "card", "heading", "art", "pattern", "palette"] as const;

/** Deck-level card choices mapped to concrete CSS tokens (decks never carry CSS). */
const CARD_BORDER = { none: "none", hairline: "1px solid color-mix(in srgb, var(--theme-fg) 28%, transparent)", thick: "3px solid var(--theme-fg)" } as const;
const CARD_SHADOW = { none: "none", soft: "0 24px 48px -24px rgba(0, 0, 0, 0.45)", hard: "8px 8px 0 var(--theme-fg)" } as const;

/** Preset native → mode variant → custom fields → colour overrides. Without a preset: the plain colours plus custom fields on estudio tokens. */
export function resolveThemeSpec(theme: Theme | undefined): ThemeSpec {
  const presetName = theme?.preset;
  const preset = THEME_PRESETS[presetName ?? "estudio"];
  const mode: ThemeMode = theme?.mode ?? (presetName ? preset.native : modeOf(theme?.background ?? DEFAULT_THEME.background));
  const variant = presetName ? presetVariant(presetName, mode) : undefined;
  const base: PresetVariant = variant ?? { colors: { ...DEFAULT_THEME, surface: "", onAccent: "" }, card: preset.card, palette: preset.palette };

  const colors: ThemeColors = {
    background: theme?.background ?? base.colors.background,
    foreground: theme?.foreground ?? base.colors.foreground,
    accent: theme?.accent ?? base.colors.accent,
    muted: theme?.muted ?? base.colors.muted,
    surface: theme?.surface ?? base.colors.surface,
    onAccent: base.colors.onAccent,
  };
  if (!colors.surface) colors.surface = mixHex(colors.foreground, colors.background, 0.08);
  if (!colors.onAccent) colors.onAccent = contrastRatio(colors.foreground, colors.accent) >= contrastRatio(colors.background, colors.accent) ? colors.foreground : colors.background;

  const fonts: ThemeFonts = {
    display: theme?.fonts?.display ? themeFont(theme.fonts.display) : preset.fonts.display,
    body: theme?.fonts?.body ? themeFont(theme.fonts.body) : preset.fonts.body,
    mono: preset.fonts.mono,
    ...(preset.fonts.accent ? { accent: preset.fonts.accent } : {}),
  };
  const card: CardTokens = {
    ...base.card,
    ...(theme?.card?.radius !== undefined ? { radius: `${theme.card.radius}px` } : {}),
    ...(theme?.card?.border ? { border: CARD_BORDER[theme.card.border] } : {}),
    ...(theme?.card?.shadow ? { shadow: CARD_SHADOW[theme.card.shadow] } : {}),
  };
  const heading: HeadingTokens = {
    weight: theme?.heading?.weight ?? preset.heading.weight,
    letterSpacing: theme?.heading?.tracking !== undefined ? `${theme.heading.tracking}em` : preset.heading.letterSpacing,
    textTransform: theme?.heading?.uppercase !== undefined ? (theme.heading.uppercase ? "uppercase" : "none") : preset.heading.textTransform,
  };
  const art = theme?.art ? customArt(theme.art, colors) : presetName ? base.art : undefined;
  const pattern = theme?.pattern !== undefined ? (theme.pattern === "none" ? undefined : theme.pattern) : presetName ? base.pattern : undefined;
  const palette = theme?.palette ?? base.palette;
  const plain = !presetName && !CUSTOM_KEYS.some((k) => theme?.[k] !== undefined);

  return {
    ...(presetName ? { preset: presetName } : {}),
    mode,
    plain,
    colors,
    fonts,
    card,
    heading,
    ...(art ? { art } : {}),
    ...(pattern ? { pattern } : {}),
    palette,
  };
}

/** Art from validated data only: hex colours become rgba(), angles are numbers. */
function customArt(art: NonNullable<Theme["art"]>, colors: ThemeColors): string | undefined {
  if (art.kind === "none") return undefined;
  if (art.kind === "glow") {
    const first = `radial-gradient(1100px 760px at 88% -12%, ${rgba(art.from ?? colors.accent, 0.18)}, transparent 62%)`;
    return art.to ? `${first}, radial-gradient(1000px 760px at 8% 100%, ${rgba(art.to, 0.16)}, transparent 62%)` : first;
  }
  return `linear-gradient(${art.angle ?? 160}deg, ${rgba(art.from ?? colors.accent, 0.45)}, ${rgba(art.to ?? colors.background, 0.45)})`;
}

// ---------------------------------------------------------------------------
// Legacy shape for colour-only consumers

export interface ResolvedTheme {
  preset?: PresetName;
  colors: { background: string; foreground: string; accent: string; muted: string; surface?: string; onAccent?: string };
  palette: readonly string[];
}

/** Colours and palette only; plain decks report surface only when they declare one and no onAccent, as before. */
export function resolveTheme(theme: Theme | undefined): ResolvedTheme {
  const spec = resolveThemeSpec(theme);
  const { background, foreground, accent, muted, surface, onAccent } = spec.colors;
  return {
    ...(spec.preset ? { preset: spec.preset } : {}),
    colors: {
      background,
      foreground,
      accent,
      muted,
      ...(!spec.plain || theme?.surface ? { surface } : {}),
      ...(!spec.plain ? { onAccent } : {}),
    },
    palette: spec.palette,
  };
}

/** One Google Fonts css2 URL for every family a preset uses in its native mode. */
export function presetFontsHref(name: PresetName): string {
  const { display, body, mono, accent } = THEME_PRESETS[name].fonts;
  return fontsHref([display, body, mono, accent]);
}

/** Weights available for a family, for pickers. */
export function fontWeights(name: FontName): readonly number[] {
  return FONT_FAMILIES[name].weights;
}

// ---------------------------------------------------------------------------
// Colour maths

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (WCAG) of a hex colour. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Light when the ground reflects more than half. */
export function modeOf(background: string): ThemeMode {
  return luminance(background) > 0.5 ? "light" : "dark";
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** `amount` of `top` mixed into `bottom`, as a six-digit hex. */
function mixHex(top: string, bottom: string, amount: number): string {
  const a = rgb(top);
  const b = rgb(bottom);
  const mix = a.map((c, i) => Math.round(c * amount + b[i]! * (1 - amount)));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
