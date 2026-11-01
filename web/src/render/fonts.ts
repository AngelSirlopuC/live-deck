import { fontFamilies, fontsHref, type FontSet } from "../../../shared/fonts.ts";

/** Families index.html already loads (the "estudio" set); a theme using exactly those needs no extra link. */
const PRELOADED = ["Bricolage Grotesque", "Instrument Sans", "JetBrains Mono"].sort().join("|");

/**
 * Injects one Google Fonts stylesheet per distinct family set, once per
 * document. Links are keyed by their family set so two themes sharing the
 * same families share one link.
 */
export function ensureFonts(fonts: FontSet): void {
  if (typeof document === "undefined") return;
  const key = fontFamilies(fonts).join("|");
  if (key === PRELOADED) return;
  const links = document.head.querySelectorAll<HTMLLinkElement>("link[data-theme-fonts]");
  if ([...links].some((l) => l.dataset.themeFonts === key)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontsHref(fonts);
  link.dataset.themeFonts = key;
  document.head.append(link);
}
