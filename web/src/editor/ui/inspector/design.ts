// Design panel: deck title, theme preset cards, colour overrides with a reset
// and a contrast hint for text and accent on the background.
import { contrastRatio, resolveTheme, PRESET_NAMES, THEME_PRESETS, type PresetName } from "../../../../../shared/themes.ts";
import type { Theme } from "../../../../../shared/deck.ts";
import { h, trusted } from "../../../ui/dom.ts";
import type { Patch } from "../../model/index.ts";
import type { EditorController, EditorState } from "../controller.ts";
import { colorField, section, textField, type Field } from "../fields.ts";
import { edIcon } from "../icons.ts";

const PRESET_LABEL: Record<PresetName, string> = { estudio: "Estudio", editorial: "Editorial", neon: "Neón", papel: "Papel", brutalista: "Brutalista", corporativo: "Corporativo" };
const COLOR_KEYS = ["background", "foreground", "accent", "muted", "surface"] as const;
const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = { background: "Fondo", foreground: "Texto", accent: "Acento", muted: "Apagado", surface: "Superficie" };

export const CONTRAST_MIN = 4.5;

/** Contrast hints for the resolved theme; empty when everything reads fine. */
export function contrastHints(theme: ReturnType<typeof resolveTheme>): string[] {
  const { background, foreground, accent } = theme.colors;
  const hints: string[] = [];
  const fg = contrastRatio(foreground, background);
  const ac = contrastRatio(accent, background);
  if (fg < CONTRAST_MIN) hints.push(`Texto sobre fondo: ${fg.toFixed(1)}:1, por debajo de ${CONTRAST_MIN}:1.`);
  if (ac < CONTRAST_MIN) hints.push(`Acento sobre fondo: ${ac.toFixed(1)}:1, por debajo de ${CONTRAST_MIN}:1.`);
  return hints;
}

export function createDesignPanel(ctrl: EditorController) {
  const el = h("div", { class: "ed-panel ed-panel-design" });
  const fields: Field[] = [];
  const theme = () => ctrl.state.deck?.theme;
  const setTheme = (patch: Patch<Theme>, key?: string) => ctrl.dispatch({ type: "setTheme", patch }, key);

  const title = textField({ label: "Título del deck", maxlength: 200, get: () => ctrl.state.deck?.title ?? "", set: (v) => ctrl.dispatch({ type: "setTitle", title: v }, "title"), commit: () => ctrl.seal() });
  fields.push(title);

  const presetCards = PRESET_NAMES.map((name) => {
    const p = THEME_PRESETS[name];
    const card = h(
      "button",
      { type: "button", class: "ed-preset", role: "radio", "aria-checked": "false", "data-preset": name },
      h("span", { class: "ed-preset-swatch", "aria-hidden": "true" }, h("span", { class: "ed-preset-ground" }, h("span", { class: "ed-preset-type" }, "Aa"), h("span", { class: "ed-preset-dot" }))),
      h("span", { class: "ed-preset-name" }, PRESET_LABEL[name]),
    );
    card.style.setProperty("--p-bg", p.colors.background);
    card.style.setProperty("--p-fg", p.colors.foreground);
    card.style.setProperty("--p-accent", p.colors.accent);
    card.style.setProperty("--p-surface", p.colors.surface);
    card.addEventListener("click", () => setTheme({ preset: name }));
    return card;
  });
  const presets = h("div", { class: "ed-presets", role: "radiogroup", "aria-label": "Preset" }, ...presetCards);
  const paintPresets = () => {
    const cur = theme()?.preset;
    for (const c of presetCards) c.setAttribute("aria-checked", String(c.dataset.preset === cur));
  };
  fields.push({ el: presets, update: paintPresets });

  const colorFields = COLOR_KEYS.map((key) =>
    colorField({
      label: COLOR_LABEL[key],
      optional: true,
      placeholder: "del preset",
      get: () => theme()?.[key],
      set: (v) => setTheme({ [key]: v }, `theme.${key}`),
      commit: () => ctrl.seal(),
    }),
  );
  fields.push(...colorFields);
  const reset = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("undo")}<span>Restablecer</span>`);
  reset.addEventListener("click", () => setTheme({ background: undefined, foreground: undefined, accent: undefined, muted: undefined, surface: undefined }));
  const resolved = h("div", { class: "ed-resolved", "aria-hidden": "true" });
  const contrast = h("div", { class: "ed-contrast", role: "status", "aria-live": "polite" });
  const paintContrast = () => {
    const t = resolveTheme(theme());
    resolved.replaceChildren(
      ...(["background", "foreground", "accent", "muted"] as const).map((k) => {
        const chip = h("span", { class: "ed-resolved-chip", title: `${COLOR_LABEL[k]} ${t.colors[k]}` });
        chip.style.setProperty("--swatch", t.colors[k]);
        return chip;
      }),
    );
    const hints = contrastHints(t);
    reset.disabled = !theme() || COLOR_KEYS.every((k) => theme()?.[k] === undefined);
    contrast.classList.toggle("is-warning", hints.length > 0);
    contrast.replaceChildren(
      ...(hints.length
        ? [trusted("span", { class: "ed-contrast-icon" }, edIcon("warning")), h("div", {}, ...hints.map((t2) => h("p", {}, t2)))]
        : [h("p", {}, `Texto y acento leen bien sobre el fondo (≥ ${CONTRAST_MIN}:1).`)]),
    );
  };
  fields.push({ el: contrast, update: paintContrast });

  el.append(
    h("header", { class: "ed-panel-head" }, h("h2", { class: "ed-panel-title" }, "Diseño"), title.el),
    section("Preset", presets),
    section("Colores", h("p", { class: "field-hint" }, "Vacío usa el color del preset."), ...colorFields.map((f) => f.el), resolved, h("div", { class: "ed-keys" }, reset)),
    section("Contraste", contrast),
  );
  paintPresets();
  paintContrast();

  return {
    el,
    render(_state: EditorState) {
      for (const f of fields) f.update();
    },
  };
}
