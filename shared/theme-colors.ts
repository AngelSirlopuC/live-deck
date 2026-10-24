// Theme colour tokens: an element or slide colour may name a role of the
// current theme instead of a hex, so switching preset or mode recolours it.
// Tokens are a closed enum (never free CSS); the renderer maps them to the
// stage's CSS variables and resolves them to hex where it needs to compute.
// No schema dependency, so the browser bundle can import it.
import type { ThemeColors, ThemeSpec } from "./themes.ts";

export const THEME_COLOR_TOKENS = ["text", "muted", "accent", "surface", "background", "on-accent"] as const;
export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number];

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export function isThemeColorToken(value: unknown): value is ThemeColorToken {
  return typeof value === "string" && (THEME_COLOR_TOKENS as readonly string[]).includes(value);
}

/** True for a hex colour or a theme token: the only colour values decks may carry. */
export function isThemeColor(value: unknown): value is string {
  return typeof value === "string" && (HEX_COLOR_RE.test(value) || isThemeColorToken(value));
}

/** Stage CSS variable behind each token. */
export const THEME_COLOR_VARS: Record<ThemeColorToken, string> = {
  text: "--theme-fg",
  muted: "--theme-muted",
  accent: "--theme-accent",
  surface: "--theme-surface",
  background: "--theme-bg",
  "on-accent": "--theme-on-accent",
};

/** Resolved colour key behind each token. */
export const THEME_COLOR_KEYS: Record<ThemeColorToken, keyof ThemeColors> = {
  text: "foreground",
  muted: "muted",
  accent: "accent",
  surface: "surface",
  background: "background",
  "on-accent": "onAccent",
};

/** What resolving needs: the resolved colours, whether the deck is plain, and whether the slide painted its own ground. */
export type ColorSpec = Pick<ThemeSpec, "colors" | "plain"> & {
  /** The slide set its own ground, so `--theme-bg` on that stage is not the theme background. */
  groundOverridden?: boolean;
};

/** Token → its hex in the resolved theme; a hex passes through. For anything that computes with the colour (contrast, the stage ground). */
export function resolveColorHex(value: string, spec: ColorSpec): string {
  return isThemeColorToken(value) ? spec.colors[THEME_COLOR_KEYS[value]] : value;
}

/**
 * CSS value for a deck colour: a hex stays as written, so existing output is
 * unchanged; a token becomes `var(--theme-…)`. A plain-colour deck defines
 * only the four base variables on its stage, so `surface` and `on-accent`
 * carry their resolved hex as the var() fallback there. `background` always
 * means the theme background: on a slide with its own ground, where the stage
 * redefines `--theme-bg`, it resolves to the theme hex instead.
 */
export function resolveColor(value: string, spec: ColorSpec): string {
  if (!isThemeColorToken(value)) return value;
  if (value === "background" && spec.groundOverridden) return spec.colors.background;
  const needsFallback = spec.plain && (value === "surface" || value === "on-accent");
  return needsFallback ? `var(${THEME_COLOR_VARS[value]}, ${spec.colors[THEME_COLOR_KEYS[value]]})` : `var(${THEME_COLOR_VARS[value]})`;
}

/** The token whose resolved colour equals `hex` exactly (case-insensitive), if any. */
export function tokenForHex(hex: string, colors: ThemeColors): ThemeColorToken | undefined {
  const h = hex.toLowerCase();
  return THEME_COLOR_TOKENS.find((t) => colors[THEME_COLOR_KEYS[t]].toLowerCase() === h);
}
