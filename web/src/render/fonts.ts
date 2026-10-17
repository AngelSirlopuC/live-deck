import { presetFontsHref, type PresetName } from "../../../shared/themes.ts";

/**
 * Injects the preset's Google Fonts stylesheet once per document. "estudio"
 * is skipped because index.html already loads its families.
 */
export function ensurePresetFonts(name: PresetName): void {
  if (name === "estudio" || typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-preset-fonts="${name}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = presetFontsHref(name);
  link.dataset.presetFonts = name;
  document.head.append(link);
}
