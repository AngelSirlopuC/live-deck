// Curated Google Fonts allowlist. Decks name a family from this list (never a
// free CSS string); the renderer builds the stylesheet URL and the font stack
// from here. No schema dependency, so the browser bundle can import it.

export interface FontSpec {
  /** Weights to load from Google Fonts. */
  weights: readonly number[];
  /** CSS fallback stack appended after the family. */
  fallback: string;
  /** Rough voice, for pickers and the skill's recipe. */
  kind: "grotesk" | "humanist" | "geometric" | "serif" | "slab" | "condensed" | "rounded" | "display" | "mono" | "hand";
}

const sans = "ui-sans-serif, system-ui, sans-serif";
const serif = "ui-serif, Georgia, serif";
const mono = "ui-monospace, monospace";

export const FONT_NAMES = [
  "Bricolage Grotesque",
  "Instrument Sans",
  "Inter Tight",
  "Space Grotesk",
  "Archivo",
  "Plus Jakarta Sans",
  "Manrope",
  "Nunito",
  "Fredoka",
  "Outfit",
  "Oswald",
  "Barlow Condensed",
  "Fraunces",
  "Playfair Display",
  "Newsreader",
  "Lora",
  "Roboto Slab",
  "Unbounded",
  "Syne",
  "JetBrains Mono",
  "IBM Plex Mono",
  "Space Mono",
  "Courier Prime",
  "Caveat",
] as const;
export type FontName = (typeof FONT_NAMES)[number];

export const FONT_FAMILIES: Record<FontName, FontSpec> = {
  "Bricolage Grotesque": { weights: [500, 600, 700, 800], fallback: sans, kind: "grotesk" },
  "Instrument Sans": { weights: [400, 500, 600, 700], fallback: sans, kind: "grotesk" },
  "Inter Tight": { weights: [400, 500, 600, 700, 800], fallback: sans, kind: "grotesk" },
  "Space Grotesk": { weights: [400, 500, 700], fallback: sans, kind: "grotesk" },
  Archivo: { weights: [400, 500, 600, 700, 800, 900], fallback: sans, kind: "grotesk" },
  "Plus Jakarta Sans": { weights: [400, 500, 600, 700, 800], fallback: sans, kind: "humanist" },
  Manrope: { weights: [400, 500, 600, 700, 800], fallback: sans, kind: "humanist" },
  Nunito: { weights: [400, 600, 700], fallback: sans, kind: "rounded" },
  Fredoka: { weights: [500, 600, 700], fallback: sans, kind: "rounded" },
  Outfit: { weights: [400, 500, 600, 700, 800], fallback: sans, kind: "geometric" },
  Oswald: { weights: [400, 500, 600, 700], fallback: sans, kind: "condensed" },
  "Barlow Condensed": { weights: [400, 500, 600, 700, 800], fallback: sans, kind: "condensed" },
  Fraunces: { weights: [400, 600, 800], fallback: serif, kind: "serif" },
  "Playfair Display": { weights: [400, 500, 600, 700, 800, 900], fallback: serif, kind: "serif" },
  Newsreader: { weights: [400, 500, 600], fallback: serif, kind: "serif" },
  Lora: { weights: [400, 500, 600, 700], fallback: serif, kind: "serif" },
  "Roboto Slab": { weights: [400, 500, 600, 700, 800], fallback: serif, kind: "slab" },
  Unbounded: { weights: [500, 700, 800], fallback: sans, kind: "display" },
  Syne: { weights: [400, 500, 600, 700, 800], fallback: sans, kind: "display" },
  "JetBrains Mono": { weights: [500, 700], fallback: mono, kind: "mono" },
  "IBM Plex Mono": { weights: [500, 600], fallback: mono, kind: "mono" },
  "Space Mono": { weights: [400, 700], fallback: mono, kind: "mono" },
  "Courier Prime": { weights: [400, 700], fallback: mono, kind: "mono" },
  Caveat: { weights: [600, 700], fallback: "cursive", kind: "hand" },
};

/** A font role resolved to a family from the allowlist. */
export interface ThemeFont {
  family: FontName;
  weights: readonly number[];
  fallback: string;
}

export function themeFont(family: FontName): ThemeFont {
  const spec = FONT_FAMILIES[family];
  return { family, weights: spec.weights, fallback: spec.fallback };
}

export function fontStack(font: ThemeFont): string {
  return `"${font.family}", ${font.fallback}`;
}

/** A list of fonts or the role map of a resolved theme (`spec.fonts`). */
export type FontSet = Iterable<ThemeFont | undefined> | { [role: string]: ThemeFont | undefined } | { display: ThemeFont; body: ThemeFont; mono: ThemeFont; accent?: ThemeFont };

function fontList(fonts: FontSet): ThemeFont[] {
  const list = Symbol.iterator in fonts ? [...(fonts as Iterable<ThemeFont | undefined>)] : Object.values(fonts as Record<string, ThemeFont | undefined>);
  return list.filter((f): f is ThemeFont => f !== undefined);
}

/** Sorted, de-duplicated family names of a set of fonts; the identity of a stylesheet link. */
export function fontFamilies(fonts: FontSet): string[] {
  return [...new Set(fontList(fonts).map((f) => f.family))].sort();
}

/** One Google Fonts css2 URL for every family in use (families shared by roles are merged). */
export function fontsHref(fonts: FontSet): string {
  const families = new Map<string, Set<number>>();
  for (const f of fontList(fonts)) {
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
