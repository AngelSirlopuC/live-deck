// Theme presets: each one is a complete visual world (colours, type, slide
// ground, card and heading treatment, chart palette). No schema dependency, so
// the browser bundle can import it. A deck picks a preset and may override its
// colours; decks without a preset keep the plain colours they declare.
import { DEFAULT_THEME } from "./deck-core.ts";
import type { Theme } from "./deck.ts";

export const PRESET_NAMES = ["estudio", "editorial", "neon", "papel", "brutalista", "corporativo"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export interface PresetFont {
  /** Google Fonts family name. */
  family: string;
  /** Weights to load. */
  weights: readonly number[];
  /** CSS fallback stack appended after the family. */
  fallback: string;
}

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

export interface ThemePreset {
  colors: ThemeColors;
  fonts: { display: PresetFont; body: PresetFont; mono: PresetFont; /** Used by `mark` text. */ accent?: PresetFont };
  /** CSS background-image layers painted over the ground colour (translucent so colour overrides still read). */
  art?: string;
  /** Built-in pattern painted over the ground. */
  pattern?: "dots" | "grid" | "lines" | "noise";
  card: { radius: string; border: string; shadow: string; background: string; padding: string };
  heading: { weight: number; letterSpacing: string; textTransform: "none" | "uppercase" };
  /** Categorical chart palette in fixed order, validated with the dataviz validator against `colors.background`. */
  palette: readonly string[];
}

const sans = "ui-sans-serif, system-ui, sans-serif";
const serif = "ui-serif, Georgia, serif";
const mono = "ui-monospace, monospace";

export const THEME_PRESETS: Record<PresetName, ThemePreset> = {
  // Today's look: warm charcoal, cream type, amber accent.
  estudio: {
    colors: { ...DEFAULT_THEME, surface: "#1b202b", onAccent: "#10131a" },
    fonts: {
      display: { family: "Bricolage Grotesque", weights: [500, 600, 700, 800], fallback: sans },
      body: { family: "Instrument Sans", weights: [400, 500, 600, 700], fallback: sans },
      mono: { family: "JetBrains Mono", weights: [500, 700], fallback: mono },
    },
    art: "radial-gradient(1100px 760px at 88% -12%, rgba(255, 122, 69, 0.16), transparent 62%)",
    card: {
      radius: "28px",
      border: "1px solid color-mix(in srgb, var(--theme-fg) 10%, transparent)",
      shadow: "0 28px 56px -28px rgba(0, 0, 0, 0.7)",
      background: "var(--theme-surface)",
      padding: "40px",
    },
    heading: { weight: 800, letterSpacing: "-0.02em", textTransform: "none" },
    palette: ["#e8683a", "#3987e5", "#199e70", "#c98500", "#d55181", "#9085e9"],
  },
  // Warm paper, ink and vermilion; high-contrast serif, hairlines, square corners.
  editorial: {
    colors: { background: "#f3eee4", foreground: "#1a1714", accent: "#c8361b", muted: "#5f574d", surface: "#fbf8f2", onAccent: "#fbf8f2" },
    fonts: {
      display: { family: "Fraunces", weights: [400, 600, 800], fallback: serif },
      body: { family: "Newsreader", weights: [400, 500, 600], fallback: serif },
      mono: { family: "IBM Plex Mono", weights: [500, 600], fallback: mono },
    },
    card: {
      radius: "0px",
      border: "1px solid color-mix(in srgb, var(--theme-fg) 28%, transparent)",
      shadow: "none",
      background: "var(--theme-surface)",
      padding: "40px",
    },
    heading: { weight: 800, letterSpacing: "-0.035em", textTransform: "none" },
    palette: ["#d9442a", "#2a6fc0", "#a87400", "#1b9a6a", "#b24f9a", "#6250d6"],
  },
  // Near-black with colour glows, electric green and magenta, dark glass cards.
  neon: {
    colors: { background: "#07080d", foreground: "#eef1ff", accent: "#2bf5b5", muted: "#a3a8c8", surface: "#12141f", onAccent: "#07080d" },
    fonts: {
      display: { family: "Unbounded", weights: [500, 700, 800], fallback: sans },
      body: { family: "Space Grotesk", weights: [400, 500, 700], fallback: sans },
      mono: { family: "Space Mono", weights: [400, 700], fallback: mono },
    },
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
  },
  // Kraft paper with grain, brown ink, tomato accent, friendly rounded type and a hand for marks.
  papel: {
    colors: { background: "#e6d3b3", foreground: "#3a2a1c", accent: "#b8381f", muted: "#5e4630", surface: "#f8f1e3", onAccent: "#fbf6ec" },
    fonts: {
      display: { family: "Fredoka", weights: [500, 600, 700], fallback: sans },
      body: { family: "Nunito", weights: [400, 600, 700], fallback: sans },
      mono: { family: "Courier Prime", weights: [400, 700], fallback: mono },
      accent: { family: "Caveat", weights: [600, 700], fallback: "cursive" },
    },
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
  },
  // Neobrutalist: off-white, black, yellow, thick borders and hard offset shadows.
  brutalista: {
    colors: { background: "#f4f1e8", foreground: "#0a0a0a", accent: "#ffd400", muted: "#45423b", surface: "#ffffff", onAccent: "#0a0a0a" },
    fonts: {
      display: { family: "Archivo", weights: [800, 900], fallback: sans },
      body: { family: "Archivo", weights: [400, 500, 600, 700], fallback: sans },
      mono: { family: "Space Mono", weights: [400, 700], fallback: mono },
    },
    card: {
      radius: "0px",
      border: "5px solid var(--theme-fg)",
      shadow: "12px 12px 0 var(--theme-fg)",
      background: "var(--theme-surface)",
      padding: "36px",
    },
    heading: { weight: 900, letterSpacing: "-0.01em", textTransform: "uppercase" },
    palette: ["#e4572e", "#2a5bd7", "#a87c00", "#c2408a", "#1f8a3c", "#6250d6"],
  },
  // Deep navy gradient, white type, bright blue, soft rounded surfaces.
  corporativo: {
    colors: { background: "#0b1a36", foreground: "#ffffff", accent: "#3d8bff", muted: "#a9b8d6", surface: "#14264a", onAccent: "#06122a" },
    fonts: {
      display: { family: "Plus Jakarta Sans", weights: [600, 700, 800], fallback: sans },
      body: { family: "Plus Jakarta Sans", weights: [400, 500, 600], fallback: sans },
      mono: { family: "JetBrains Mono", weights: [500, 700], fallback: mono },
    },
    art: "linear-gradient(160deg, transparent 10%, rgba(38, 92, 196, 0.34) 100%)",
    card: {
      radius: "16px",
      border: "1px solid color-mix(in srgb, var(--theme-fg) 10%, transparent)",
      shadow: "0 16px 40px -16px rgba(0, 0, 0, 0.55)",
      background: "var(--theme-surface)",
      padding: "40px",
    },
    heading: { weight: 800, letterSpacing: "-0.025em", textTransform: "none" },
    palette: ["#3b8cff", "#d9702a", "#169a84", "#b38a12", "#d0609f", "#8b7cf0"],
  },
};

export interface ResolvedTheme {
  preset?: PresetName;
  colors: { background: string; foreground: string; accent: string; muted: string; surface?: string; onAccent?: string };
  palette: readonly string[];
}

/** Preset colours first, then the deck's own overrides. Decks without a preset use their colours as declared. */
export function resolveTheme(theme: Theme | undefined): ResolvedTheme {
  const preset = theme?.preset;
  const base = preset ? THEME_PRESETS[preset].colors : undefined;
  const fallback = base ?? DEFAULT_THEME;
  const surface = theme?.surface ?? base?.surface;
  const colors = {
    background: theme?.background ?? fallback.background,
    foreground: theme?.foreground ?? fallback.foreground,
    accent: theme?.accent ?? fallback.accent,
    muted: theme?.muted ?? fallback.muted,
    ...(surface ? { surface } : {}),
    ...(base ? { onAccent: base.onAccent } : {}),
  };
  return { ...(preset ? { preset } : {}), colors, palette: THEME_PRESETS[preset ?? "estudio"].palette };
}

export function fontStack(font: PresetFont): string {
  return `"${font.family}", ${font.fallback}`;
}

/** One Google Fonts css2 URL for every family a preset uses (families shared by roles are merged). */
export function presetFontsHref(name: PresetName): string {
  const { display, body, mono, accent } = THEME_PRESETS[name].fonts;
  const families = new Map<string, Set<number>>();
  for (const f of [display, body, mono, accent]) {
    if (!f) continue;
    const weights = families.get(f.family) ?? new Set<number>();
    for (const w of f.weights) weights.add(w);
    families.set(f.family, weights);
  }
  const query = [...families]
    .map(([family, weights]) => `family=${family.replace(/ /g, "+")}:wght@${[...weights].sort((a, b) => a - b).join(";")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
