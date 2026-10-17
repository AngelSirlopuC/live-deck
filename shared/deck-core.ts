// Runtime helpers for decks with no schema dependency, so the browser bundle
// does not ship zod. Validation lives in deck.ts (server and tooling).
import type { Deck, Quiz, Slide, Theme } from "./deck.ts";

export interface ThemeColorsBase {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
}

/** Colours of decks without a theme; also the "estudio" preset colours. */
export const DEFAULT_THEME: ThemeColorsBase = { background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" };

/** Number of fragment steps on a slide (0 when everything is visible at once). */
export function slideSteps(slide: Pick<Slide, "elements">): number {
  return slide.elements.reduce((max, el) => Math.max(max, el.fragment ?? 0), 0);
}

/** Quiz as the audience sees it before reveal: no answer. */
export type PublicQuiz = Omit<Quiz, "correctIndex">;
export type PublicSlide = Omit<Slide, "quiz" | "notes"> & { quiz?: PublicQuiz };
export interface PublicDeck {
  version: 1;
  title: string;
  theme?: Theme;
  slides: PublicSlide[];
}
/** Anything the renderer can draw: a full deck or its public projection. */
export type RenderableDeck = Deck | PublicDeck;

/** Strips speaker notes and quiz answers so the deck is safe to send to the audience. */
export function publicDeck(deck: Deck): PublicDeck {
  return {
    version: deck.version,
    title: deck.title,
    ...(deck.theme ? { theme: deck.theme } : {}),
    slides: deck.slides.map(({ notes: _notes, quiz, ...slide }) => {
      if (!quiz) return slide;
      const { correctIndex: _answer, ...rest } = quiz;
      return { ...slide, quiz: rest };
    }),
  };
}
