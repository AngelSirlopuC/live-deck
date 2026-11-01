// Light client-side checks that mirror the deck limits an editor is most likely
// to break, so the UI can block a save with a clear Spanish message before the
// server's zod validation. The server (parseDeck) remains the authority.
import type { Deck, Quiz, Slide, Theme } from "../../../../shared/deck.ts";
import { THEME_COLOR_TOKENS, isThemeColor } from "../../../../shared/theme-colors.ts";
import { ASK_QUESTION_MAX, ASK_TEXT_MAX, ASK_TEXT_MIN } from "../../../../shared/ask.ts";
import { FONT_NAMES } from "../../../../shared/fonts.ts";
import { MOTION_STYLES } from "../../../../shared/motion.ts";
import { PRESET_NAMES, THEME_MODES } from "../../../../shared/themes.ts";

// Contrast helpers live in shared/themes.ts so the CLI can use them too.
export { CONTRAST_FLOORS, contrastWarnings, THEME_MODES, type ContrastKey, type ContrastWarning } from "../../../../shared/themes.ts";
import { isValidId } from "./ids.ts";
import { MAX_ELEMENTS, MAX_SLIDES } from "./document.ts";

export interface ValidationIssue {
  /** Dotted path into the deck, e.g. `slides.2.elements.0.box`. */
  path: string;
  message: string;
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const COLOR_MSG = `Usa un color hex como #1a2b3c o un color del tema (${THEME_COLOR_TOKENS.join(", ")}).`;
// Colour fields of each element type: a hex or a theme token (theme-level colours stay hex).
const ELEMENT_COLOR_KEYS: Partial<Record<Slide["elements"][number]["type"], readonly string[]>> = {
  text: ["color", "background"],
  shape: ["fill", "stroke"],
  qr: ["color", "background"],
  icon: ["color", "background"],
  chart: ["color"],
  decor: ["color"],
};
const EPS = 0.0001;
const THEME_KEYS = ["background", "foreground", "accent", "muted", "surface"] as const;
const REQUIRED_THEME_KEYS = ["background", "foreground", "accent"];

const inUnit = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 + EPS;
const inRange = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const oneOf = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);

// Same limits as ThemeSchema in shared/deck.ts (zod stays on the server).
export const CARD_BORDERS = ["none", "hairline", "thick"] as const;
export const CARD_SHADOWS = ["none", "soft", "hard"] as const;
export const HEADING_WEIGHTS = [400, 500, 600, 700, 800, 900] as const;
export const ART_KINDS = ["none", "glow", "gradient"] as const;
export const THEME_PATTERNS = ["none", "dots", "grid", "lines", "noise"] as const;
export const CARD_RADIUS_MAX = 64;
export const TRACKING_MIN = -0.05;
export const TRACKING_MAX = 0.2;
export const PALETTE_MIN = 3;
export const PALETTE_MAX = 8;

export function validateDeck(deck: Deck): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (typeof deck.title !== "string" || deck.title.trim() === "") add("title", "El título no puede estar vacío.");
  else if (deck.title.length > 200) add("title", "El título no puede superar 200 caracteres.");

  if (deck.theme) validateTheme(deck.theme, add);
  if (deck.motion !== undefined && !oneOf(MOTION_STYLES, deck.motion)) add("motion", "El movimiento es calm, lively, snappy o none.");

  if (deck.slides.length < 1) add("slides", "El deck necesita al menos una diapositiva.");
  else if (deck.slides.length > MAX_SLIDES) add("slides", `Máximo ${MAX_SLIDES} diapositivas.`);

  const slideIds = new Set<string>();
  deck.slides.forEach((slide, i) => {
    const p = `slides.${i}`;
    if (!isValidId(slide.id)) add(`${p}.id`, "El id solo admite letras, números, guion y guion bajo (1-40).");
    else if (slideIds.has(slide.id)) add(`${p}.id`, `Id de diapositiva repetido: "${slide.id}".`);
    slideIds.add(slide.id);
    validateSlide(slide, p, add);
  });

  return issues;
}

function validateTheme(theme: Theme, add: (path: string, message: string) => void): void {
  const hexMsg = "Usa un color hex como #1a2b3c.";
  if (theme.preset !== undefined && !oneOf(PRESET_NAMES, theme.preset)) add("theme.preset", `El preset debe ser uno de: ${PRESET_NAMES.join(", ")}.`);
  if (theme.mode !== undefined && !oneOf(THEME_MODES, theme.mode)) add("theme.mode", 'El modo es "light" o "dark".');
  for (const key of THEME_KEYS) {
    const value = theme[key];
    if (value !== undefined && !HEX_RE.test(value)) add(`theme.${key}`, hexMsg);
    else if (value === undefined && !theme.preset && REQUIRED_THEME_KEYS.includes(key)) add(`theme.${key}`, "Sin preset, el tema necesita fondo, texto y acento.");
  }
  if (theme.fonts) {
    for (const role of ["display", "body"] as const) {
      const v = theme.fonts[role];
      if (v !== undefined && !oneOf(FONT_NAMES, v)) add(`theme.fonts.${role}`, "Elige una fuente de la lista.");
    }
  }
  if (theme.card) {
    const { radius, border, shadow } = theme.card;
    if (radius !== undefined && !inRange(radius, 0, CARD_RADIUS_MAX)) add("theme.card.radius", `El radio de las tarjetas va de 0 a ${CARD_RADIUS_MAX}.`);
    if (border !== undefined && !oneOf(CARD_BORDERS, border)) add("theme.card.border", "El borde es none, hairline o thick.");
    if (shadow !== undefined && !oneOf(CARD_SHADOWS, shadow)) add("theme.card.shadow", "La sombra es none, soft o hard.");
  }
  if (theme.heading) {
    const { weight, uppercase, tracking } = theme.heading;
    if (weight !== undefined && !(HEADING_WEIGHTS as readonly number[]).includes(weight)) add("theme.heading.weight", `El peso de los títulos es ${HEADING_WEIGHTS.join(", ")}.`);
    if (uppercase !== undefined && typeof uppercase !== "boolean") add("theme.heading.uppercase", "Mayúsculas es sí o no.");
    if (tracking !== undefined && !inRange(tracking, TRACKING_MIN, TRACKING_MAX)) add("theme.heading.tracking", `El espaciado de los títulos va de ${TRACKING_MIN} a ${TRACKING_MAX} em.`);
  }
  if (theme.art) {
    const { kind, from, to, angle } = theme.art;
    if (!oneOf(ART_KINDS, kind)) add("theme.art.kind", "El fondo artístico es none, glow o gradient.");
    if (from !== undefined && !HEX_RE.test(from)) add("theme.art.from", hexMsg);
    if (to !== undefined && !HEX_RE.test(to)) add("theme.art.to", hexMsg);
    if (angle !== undefined && !inRange(angle, 0, 360)) add("theme.art.angle", "El ángulo va de 0 a 360 grados.");
  }
  if (theme.pattern !== undefined && !oneOf(THEME_PATTERNS, theme.pattern)) add("theme.pattern", "La trama es none, dots, grid, lines o noise.");
  if (theme.palette !== undefined) {
    if (!Array.isArray(theme.palette) || theme.palette.length < PALETTE_MIN || theme.palette.length > PALETTE_MAX) add("theme.palette", `La paleta lleva de ${PALETTE_MIN} a ${PALETTE_MAX} colores.`);
    else theme.palette.forEach((c, i) => (!HEX_RE.test(c) ? add(`theme.palette.${i}`, hexMsg) : undefined));
  }
}

function validateSlide(slide: Slide, p: string, add: (path: string, message: string) => void): void {
  const bg = slide.background;
  if (typeof bg === "string") {
    if (!isThemeColor(bg)) add(`${p}.background`, COLOR_MSG);
  } else if (bg) {
    if (bg.color !== undefined && !isThemeColor(bg.color)) add(`${p}.background.color`, COLOR_MSG);
    if (bg.gradient) {
      if (!isThemeColor(bg.gradient.from)) add(`${p}.background.gradient.from`, COLOR_MSG);
      if (!isThemeColor(bg.gradient.to)) add(`${p}.background.gradient.to`, COLOR_MSG);
    }
  }
  if (slide.elements.length > MAX_ELEMENTS) add(`${p}.elements`, `Máximo ${MAX_ELEMENTS} elementos por diapositiva.`);
  const ids = new Set<string>();
  slide.elements.forEach((el, j) => {
    const q = `${p}.elements.${j}`;
    if (!isValidId(el.id)) add(`${q}.id`, "El id solo admite letras, números, guion y guion bajo (1-40).");
    else if (ids.has(el.id)) add(`${q}.id`, `Id de elemento repetido: "${el.id}".`);
    ids.add(el.id);
    const b = el.box;
    if (!b || !inUnit(b.x) || !inUnit(b.y) || !inUnit(b.w) || !inUnit(b.h) || b.x + b.w > 1 + EPS || b.y + b.h > 1 + EPS) {
      add(`${q}.box`, "El elemento se sale de la diapositiva.");
    }
    if (el.fragment !== undefined && (!Number.isInteger(el.fragment) || el.fragment < 1 || el.fragment > 20)) add(`${q}.fragment`, "El fragmento va de 1 a 20.");
    const style = (el as { style?: Record<string, unknown> }).style;
    for (const key of ELEMENT_COLOR_KEYS[el.type] ?? []) {
      const value = style?.[key];
      if (value !== undefined && !isThemeColor(value)) add(`${q}.style.${key}`, COLOR_MSG);
    }
    if (el.type === "text" && el.text.length > 2000) add(`${q}.text`, "El texto no puede superar 2000 caracteres.");
    if (el.type === "chart") {
      const [min, max] = el.kind === "donut" ? [2, 6] : [1, 8];
      if (el.data.length < min || el.data.length > max) add(`${q}.data`, `Un gráfico ${el.kind === "donut" ? "de dona" : "de barras"} lleva de ${min} a ${max} datos.`);
    }
  });

  const layout = slide.layout ?? "free";
  if (layout === "quiz" && !slide.quiz) add(`${p}.quiz`, "La diapositiva de quiz necesita una pregunta con opciones.");
  if (slide.quiz && layout !== "quiz") add(`${p}.layout`, "Hay un quiz pero el layout no es \"quiz\".");
  if (layout === "ask" && !slide.ask) add(`${p}.ask`, "La diapositiva de pregunta abierta necesita una pregunta.");
  if (slide.ask && layout !== "ask") add(`${p}.layout`, "Hay una pregunta abierta pero el layout no es \"ask\".");

  if (slide.quiz) validateQuiz(slide.quiz, `${p}.quiz`, add);
  if (slide.ask) {
    const question = slide.ask.question ?? "";
    if (question.trim() === "") add(`${p}.ask.question`, "Escribe la pregunta abierta.");
    else if (question.length > ASK_QUESTION_MAX) add(`${p}.ask.question`, `La pregunta no puede superar ${ASK_QUESTION_MAX} caracteres.`);
    const max = slide.ask.maxChars;
    if (max !== undefined && (!Number.isInteger(max) || max < ASK_TEXT_MIN || max > ASK_TEXT_MAX)) add(`${p}.ask.maxChars`, `El largo de respuesta va de ${ASK_TEXT_MIN} a ${ASK_TEXT_MAX}.`);
  }
}

function validateQuiz(quiz: Quiz, p: string, add: (path: string, message: string) => void): void {
  const question = quiz.question ?? "";
  if (question.trim() === "") add(`${p}.question`, "Escribe la pregunta del quiz.");
  else if (question.length > 300) add(`${p}.question`, "La pregunta no puede superar 300 caracteres.");
  const options = quiz.options ?? [];
  if (options.length < 2 || options.length > 6) add(`${p}.options`, "El quiz necesita entre 2 y 6 opciones.");
  options.forEach((o, i) => {
    if (typeof o !== "string" || o.trim() === "") add(`${p}.options.${i}`, `La opción ${i + 1} está vacía.`);
    else if (o.length > 120) add(`${p}.options.${i}`, `La opción ${i + 1} no puede superar 120 caracteres.`);
  });
  if (!Number.isInteger(quiz.correctIndex) || quiz.correctIndex < 0 || quiz.correctIndex >= options.length) add(`${p}.correctIndex`, "Marca cuál opción es la correcta.");
  if (quiz.timerSec !== undefined && (!Number.isInteger(quiz.timerSec) || quiz.timerSec < 5 || quiz.timerSec > 600)) add(`${p}.timerSec`, "El temporizador va de 5 a 600 segundos.");
  if (quiz.zones && quiz.zones.length !== options.length) add(`${p}.zones`, "Las zonas deben ser una por opción.");
}
