// Design panel: deck title, preset cards painted in the current mode, the
// mode switch, font pickers with a live specimen, colour overrides, card,
// heading, art, pattern and palette controls, and contrast hints. Every
// control writes deck data (shared/deck.ts ThemeSchema); the theme engine
// turns it into tokens, so this panel never emits CSS.
import type { Theme } from "../../../../../shared/deck.ts";
import { FONT_FAMILIES, FONT_NAMES, fontStack, themeFont, type FontName, type FontSpec } from "../../../../../shared/fonts.ts";
import { presetVariant, PRESET_NAMES, resolveThemeSpec, THEME_PRESETS, type PresetName, type ThemeMode } from "../../../../../shared/themes.ts";
import { ensureFonts } from "../../../render/fonts.ts";
import { h, trusted } from "../../../ui/dom.ts";
import type { ThemePatch } from "../../model/document.ts";
import {
  ART_KINDS,
  CARD_BORDERS,
  CARD_RADIUS_MAX,
  CARD_SHADOWS,
  CONTRAST_FLOORS,
  contrastWarnings,
  HEADING_WEIGHTS,
  PALETTE_MAX,
  PALETTE_MIN,
  THEME_PATTERNS,
  TRACKING_MAX,
  TRACKING_MIN,
} from "../../model/validate.ts";
import type { EditorController, EditorState } from "../controller.ts";
import { colorField, numberField, row, section, segmentedField, selectField, textField, textKey, type Field, type SelectOption } from "../fields.ts";
import { edIcon } from "../icons.ts";

const PRESET_LABEL: Record<PresetName, string> = { estudio: "Estudio", editorial: "Editorial", neon: "Neón", papel: "Papel", brutalista: "Brutalista", corporativo: "Corporativo" };
const COLOR_KEYS = ["background", "foreground", "accent", "muted", "surface"] as const;
const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = { background: "Fondo", foreground: "Texto", accent: "Acento", muted: "Apagado", surface: "Superficie" };
const CONTRAST_LABEL: Record<keyof typeof CONTRAST_FLOORS, string> = { foreground: "Texto", muted: "Apagado", accent: "Acento" };
const FONT_KIND_LABEL: Record<FontSpec["kind"], string> = {
  grotesk: "Grotescas",
  humanist: "Humanistas",
  geometric: "Geométricas",
  rounded: "Redondeadas",
  condensed: "Condensadas",
  serif: "Serif",
  slab: "Slab",
  display: "Display",
  mono: "Monoespaciadas",
  hand: "Manuscritas",
};
const BORDER_LABEL: Record<(typeof CARD_BORDERS)[number], string> = { none: "Sin", hairline: "Fino", thick: "Grueso" };
const SHADOW_LABEL: Record<(typeof CARD_SHADOWS)[number], string> = { none: "Sin", soft: "Suave", hard: "Dura" };
const ART_LABEL: Record<(typeof ART_KINDS)[number], string> = { none: "Ninguno", glow: "Resplandor", gradient: "Degradado" };
const PATTERN_LABEL: Record<(typeof THEME_PATTERNS)[number], string> = { none: "Ninguna", dots: "Puntos", grid: "Rejilla", lines: "Líneas", noise: "Grano" };
const FROM_PRESET = "Del preset";

/** Font families grouped by voice, in allowlist order. */
export function fontGroups(): { label: string; options: SelectOption[] }[] {
  const groups = new Map<FontSpec["kind"], SelectOption[]>();
  for (const name of FONT_NAMES) {
    const kind = FONT_FAMILIES[name].kind;
    const list = groups.get(kind) ?? [];
    list.push({ value: name, label: name });
    groups.set(kind, list);
  }
  return [...groups].map(([kind, options]) => ({ label: FONT_KIND_LABEL[kind], options }));
}

/** Spanish contrast hints (S4 floors); empty when everything reads fine. */
export function contrastHints(theme: Theme | undefined): string[] {
  return contrastWarnings(theme).map((w) => `${CONTRAST_LABEL[w.key]} sobre fondo: ${w.ratio.toFixed(1)}:1, por debajo de ${w.min}:1.`);
}

export function createDesignPanel(ctrl: EditorController) {
  const el = h("div", { class: "ed-panel ed-panel-design" });
  const fields: Field[] = [];
  const theme = () => ctrl.state.deck?.theme;
  const spec = () => resolveThemeSpec(theme());
  const setTheme = (patch: ThemePatch, key?: string) => ctrl.dispatch({ type: "setTheme", patch }, key);
  const seal = () => ctrl.seal();
  /** Segmented/select value of an optional key: "" means "from the preset". */
  const opt = (v: string | number | boolean | undefined) => (v === undefined ? "" : String(v));

  const title = textField({ label: "Título del deck", maxlength: 200, get: () => ctrl.state.deck?.title ?? "", set: (v) => ctrl.dispatch({ type: "setTitle", title: v }, "title"), commit: seal });
  fields.push(title);

  // Preset cards, painted in the deck's mode (or each preset's native one) -------
  const presetCards = PRESET_NAMES.map((name) => {
    const card = h(
      "button",
      { type: "button", class: "ed-preset", role: "radio", "aria-checked": "false", "data-preset": name },
      h("span", { class: "ed-preset-swatch", "aria-hidden": "true" }, h("span", { class: "ed-preset-ground" }, h("span", { class: "ed-preset-type" }, "Aa"), h("span", { class: "ed-preset-dot" }))),
      h("span", { class: "ed-preset-name" }, PRESET_LABEL[name]),
    );
    card.addEventListener("click", () => setTheme({ preset: name }));
    return card;
  });
  const presets = h("div", { class: "ed-presets", role: "radiogroup", "aria-label": "Preset" }, ...presetCards);
  const paintPresets = () => {
    const t = theme();
    for (const c of presetCards) {
      const name = c.dataset.preset as PresetName;
      const v = t?.mode ? presetVariant(name, t.mode) : THEME_PRESETS[name];
      c.style.setProperty("--p-bg", v.colors.background);
      c.style.setProperty("--p-fg", v.colors.foreground);
      c.style.setProperty("--p-accent", v.colors.accent);
      c.style.setProperty("--p-surface", v.colors.surface);
      c.setAttribute("aria-checked", String(name === t?.preset));
    }
  };
  fields.push({ el: presets, update: paintPresets });

  const mode = segmentedField({
    label: "Modo",
    options: [
      { value: "original", label: "Original" },
      { value: "light", label: "Claro" },
      { value: "dark", label: "Oscuro" },
    ],
    get: () => theme()?.mode ?? "original",
    set: (v) => setTheme({ mode: v === "original" ? undefined : (v as ThemeMode) }),
  });
  const modeKeys = [...mode.el.querySelectorAll<HTMLButtonElement>(".ed-seg")];
  const modeHint = h("p", { class: "field-hint" });
  fields.push(mode, {
    el: modeHint,
    update() {
      const hasPreset = Boolean(theme()?.preset);
      for (const b of modeKeys) b.disabled = !hasPreset;
      modeHint.textContent = hasPreset ? `Original es el modo propio del preset (${PRESET_LABEL[theme()!.preset!]}: ${THEME_PRESETS[theme()!.preset!].native === "light" ? "claro" : "oscuro"}).` : "Elige un preset para cambiar entre claro y oscuro.";
    },
  });

  // Fonts ------------------------------------------------------------------------
  const groups = fontGroups();
  const fontField = (role: "display" | "body", label: string) => {
    const select = selectField({
      label,
      options: [{ value: "", label: FROM_PRESET }],
      groups,
      get: () => theme()?.fonts?.[role] ?? "",
      set: (v) => setTheme({ fonts: { [role]: v === "" ? undefined : (v as FontName) } }),
    });
    const specimen = h("p", { class: "ed-specimen", "data-role": role, "aria-hidden": "true" });
    select.el.append(specimen);
    return {
      el: select.el,
      update() {
        select.update();
        const font = spec().fonts[role];
        specimen.style.fontFamily = fontStack(font);
        specimen.style.fontWeight = String(role === "display" ? Math.max(...font.weights) : Math.min(...font.weights));
        specimen.textContent = `${font.family} · Aa Bb 0123`;
      },
    };
  };
  const displayFont = fontField("display", "Fuente de títulos");
  const bodyFont = fontField("body", "Fuente de texto");
  // One stylesheet per theme (the whole role map), so the preloaded estudio set stays a no-op.
  fields.push({ el: displayFont.el, update: () => ensureFonts(spec().fonts) }, displayFont, bodyFont);

  // Colour overrides -------------------------------------------------------------
  const colorFields = COLOR_KEYS.map((key) =>
    colorField({
      label: COLOR_LABEL[key],
      optional: true,
      placeholder: () => spec().colors[key],
      get: () => theme()?.[key],
      set: (v) => setTheme({ [key]: v }, `theme.${key}`),
      commit: seal,
    }),
  );
  fields.push(...colorFields);
  const reset = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("undo")}<span>Restablecer</span>`);
  reset.addEventListener("click", () => setTheme({ background: undefined, foreground: undefined, accent: undefined, muted: undefined, surface: undefined }));
  const resolved = h("div", { class: "ed-resolved", "aria-hidden": "true" });
  const contrast = h("div", { class: "ed-contrast", role: "status", "aria-live": "polite" });
  const paintContrast = () => {
    const s = spec();
    resolved.replaceChildren(
      ...(["background", "foreground", "accent", "muted"] as const).map((k) => {
        const chip = h("span", { class: "ed-resolved-chip", title: `${COLOR_LABEL[k]} ${s.colors[k]}` });
        chip.style.setProperty("--swatch", s.colors[k]);
        return chip;
      }),
    );
    const hints = contrastHints(theme());
    reset.disabled = !theme() || COLOR_KEYS.every((k) => theme()?.[k] === undefined);
    contrast.classList.toggle("is-warning", hints.length > 0);
    contrast.replaceChildren(
      ...(hints.length
        ? [trusted("span", { class: "ed-contrast-icon" }, edIcon("warning")), h("div", {}, ...hints.map((t2) => h("p", {}, t2)))]
        : [h("p", {}, `Texto, apagado y acento leen bien sobre el fondo (≥ ${CONTRAST_FLOORS.foreground}:1, ${CONTRAST_FLOORS.muted}:1 y ${CONTRAST_FLOORS.accent}:1).`)]),
    );
  };
  fields.push({ el: contrast, update: paintContrast });

  // Cards ------------------------------------------------------------------------
  const radius = numberField({
    label: "Radio",
    unit: "px",
    min: 0,
    max: CARD_RADIUS_MAX,
    optional: true,
    placeholder: () => spec().card.radius.replace("px", ""),
    get: () => theme()?.card?.radius,
    set: (v) => setTheme({ card: { radius: v } }, "theme.card.radius"),
    commit: seal,
  });
  const border = segmentedField({
    label: "Borde",
    options: [{ value: "", label: "Preset" }, ...CARD_BORDERS.map((v) => ({ value: v, label: BORDER_LABEL[v] }))],
    get: () => opt(theme()?.card?.border),
    set: (v) => setTheme({ card: { border: v === "" ? undefined : (v as (typeof CARD_BORDERS)[number]) } }),
  });
  const shadow = segmentedField({
    label: "Sombra",
    options: [{ value: "", label: "Preset" }, ...CARD_SHADOWS.map((v) => ({ value: v, label: SHADOW_LABEL[v] }))],
    get: () => opt(theme()?.card?.shadow),
    set: (v) => setTheme({ card: { shadow: v === "" ? undefined : (v as (typeof CARD_SHADOWS)[number]) } }),
  });
  fields.push(radius, border, shadow);

  // Headings ---------------------------------------------------------------------
  const weight = selectField({
    label: "Peso de títulos",
    options: [{ value: "", label: FROM_PRESET }, ...HEADING_WEIGHTS.map((w) => ({ value: String(w), label: String(w) }))],
    get: () => opt(theme()?.heading?.weight),
    set: (v) => setTheme({ heading: { weight: v === "" ? undefined : (Number(v) as (typeof HEADING_WEIGHTS)[number]) } }),
  });
  const uppercase = segmentedField({
    label: "Mayúsculas",
    options: [
      { value: "", label: "Preset" },
      { value: "true", label: "Sí" },
      { value: "false", label: "No" },
    ],
    get: () => opt(theme()?.heading?.uppercase),
    set: (v) => setTheme({ heading: { uppercase: v === "" ? undefined : v === "true" } }),
  });
  const tracking = numberField({
    label: "Espaciado",
    unit: "em",
    min: TRACKING_MIN,
    max: TRACKING_MAX,
    step: 0.01,
    optional: true,
    placeholder: () => spec().heading.letterSpacing.replace("em", ""),
    get: () => theme()?.heading?.tracking,
    set: (v) => setTheme({ heading: { tracking: v } }, "theme.heading.tracking"),
    commit: seal,
  });
  fields.push(weight, uppercase, tracking);

  // Art and pattern --------------------------------------------------------------
  const art = segmentedField({
    label: "Arte",
    options: [{ value: "", label: "Preset" }, ...ART_KINDS.map((v) => ({ value: v, label: ART_LABEL[v] }))],
    get: () => opt(theme()?.art?.kind),
    // Glow and gradient share their colours; "none" and "preset" drop them.
    set: (v) => setTheme({ art: v === "" ? undefined : v === "none" ? { kind: "none", from: undefined, to: undefined, angle: undefined } : { kind: v as (typeof ART_KINDS)[number] } }),
  });
  const artFrom = colorField({ label: "Desde", optional: true, placeholder: () => spec().colors.accent, get: () => theme()?.art?.from, set: (v) => setTheme({ art: { from: v } }, "theme.art.from"), commit: seal });
  const artTo = colorField({ label: "Hasta", optional: true, placeholder: () => spec().colors.background, get: () => theme()?.art?.to, set: (v) => setTheme({ art: { to: v } }, "theme.art.to"), commit: seal });
  const artAngle = numberField({ label: "Ángulo", unit: "°", min: 0, max: 360, optional: true, placeholder: "160", get: () => theme()?.art?.angle, set: (v) => setTheme({ art: { angle: v } }, "theme.art.angle"), commit: seal });
  const artFields = h("div", { class: "ed-art-fields" }, row(artFrom, artTo), artAngle.el);
  fields.push(art, artFrom, artTo, artAngle, {
    el: artFields,
    update() {
      const kind = theme()?.art?.kind;
      artFields.hidden = !kind || kind === "none";
      artAngle.el.hidden = kind !== "gradient";
    },
  });
  const pattern = selectField({
    label: "Trama",
    options: [{ value: "", label: FROM_PRESET }, ...THEME_PATTERNS.map((v) => ({ value: v, label: PATTERN_LABEL[v] }))],
    get: () => opt(theme()?.pattern),
    set: (v) => setTheme({ pattern: v === "" ? undefined : (v as (typeof THEME_PATTERNS)[number]) }),
  });
  fields.push(pattern);

  // Palette ----------------------------------------------------------------------
  const paletteList = h("div", { class: "ed-palette", role: "list", "aria-label": "Paleta de gráficos" });
  const customize = textKey("Personalizar", () => setTheme({ palette: [...spec().palette] }), "key ed-key", "palette");
  const addColor = textKey("Añadir color", () => {
    const p = theme()?.palette ?? [];
    setTheme({ palette: [...p, p[p.length - 1] ?? spec().colors.accent] });
  }, "key ed-key", "plus");
  const paletteReset = textKey(FROM_PRESET, () => setTheme({ palette: undefined }), "key ed-key", "undo");
  const paletteKeys = h("div", { class: "ed-keys" }, customize, addColor, paletteReset);
  const paletteHint = h("p", { class: "field-hint" }, `De ${PALETTE_MIN} a ${PALETTE_MAX} colores para barras y donas, en orden.`);
  const paintPalette = () => {
    const own = theme()?.palette;
    const colors = own ?? spec().palette;
    customize.hidden = Boolean(own);
    addColor.hidden = !own;
    paletteReset.hidden = !own;
    addColor.disabled = colors.length >= PALETTE_MAX;
    paletteList.replaceChildren(
      ...colors.map((c, i) => {
        if (!own) {
          const chip = h("span", { class: "ed-palette-chip", role: "listitem", title: c });
          chip.style.setProperty("--swatch", c);
          return chip;
        }
        const picker = h("input", { type: "color", class: "ed-color-picker ed-palette-color", value: c, "aria-label": `Color ${i + 1}` });
        picker.addEventListener("input", () => setTheme({ palette: own.map((x, j) => (j === i ? picker.value : x)) }, `theme.palette.${i}`));
        picker.addEventListener("change", seal);
        const remove = trusted("button", { type: "button", class: "ed-color-clear", "aria-label": `Quitar color ${i + 1}`, title: "Quitar" }, edIcon("close"));
        remove.disabled = own.length <= PALETTE_MIN;
        remove.addEventListener("click", () => setTheme({ palette: own.filter((_, j) => j !== i) }));
        return h("span", { class: "ed-palette-item", role: "listitem" }, picker, remove);
      }),
    );
  };
  fields.push({ el: paletteList, update: paintPalette });

  el.append(
    h("header", { class: "ed-panel-head" }, h("h2", { class: "ed-panel-title" }, "Diseño"), title.el),
    section("Preset", presets, mode.el, modeHint),
    section("Tipografía", displayFont.el, bodyFont.el),
    section("Colores", h("p", { class: "field-hint" }, "Vacío usa el color del preset en el modo actual."), ...colorFields.map((f) => f.el), resolved, h("div", { class: "ed-keys" }, reset)),
    section("Tarjetas", radius.el, border.el, shadow.el),
    section("Títulos", row(weight, tracking), uppercase.el),
    section("Fondo", art.el, artFields, pattern.el),
    section("Paleta", paletteList, paletteKeys, paletteHint),
    section("Contraste", contrast),
  );
  for (const f of fields) f.update();

  return {
    el,
    render(_state: EditorState) {
      for (const f of fields) f.update();
    },
  };
}
