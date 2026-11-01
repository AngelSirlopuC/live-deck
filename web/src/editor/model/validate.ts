// Light client-side checks that mirror the deck limits an editor is most likely
// to break, so the UI can block a save with a clear Spanish message before the
// server's zod validation. The server (parseDeck) remains the authority.
import type { Deck, Quiz, Slide } from "../../../../shared/deck.ts";
import { ASK_QUESTION_MAX, ASK_TEXT_MAX, ASK_TEXT_MIN } from "../../../../shared/ask.ts";
import { isValidId } from "./ids.ts";
import { MAX_ELEMENTS, MAX_SLIDES } from "./document.ts";

export interface ValidationIssue {
  /** Dotted path into the deck, e.g. `slides.2.elements.0.box`. */
  path: string;
  message: string;
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const EPS = 0.0001;
const THEME_KEYS = ["background", "foreground", "accent", "muted", "surface"] as const;
const REQUIRED_THEME_KEYS = ["background", "foreground", "accent"];

const inUnit = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 + EPS;

export function validateDeck(deck: Deck): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (typeof deck.title !== "string" || deck.title.trim() === "") add("title", "El título no puede estar vacío.");
  else if (deck.title.length > 200) add("title", "El título no puede superar 200 caracteres.");

  if (deck.theme) {
    for (const key of THEME_KEYS) {
      const value = deck.theme[key];
      if (value !== undefined && !HEX_RE.test(value)) add(`theme.${key}`, "Usa un color hex como #1a2b3c.");
      else if (value === undefined && !deck.theme.preset && REQUIRED_THEME_KEYS.includes(key)) add(`theme.${key}`, "Sin preset, el tema necesita fondo, texto y acento.");
    }
  }

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

function validateSlide(slide: Slide, p: string, add: (path: string, message: string) => void): void {
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
