// @vitest-environment jsdom
// S8 migration proof: the shipped decks moved their theme-equal hex colours to
// tokens. Under its own theme each deck must render exactly what it rendered
// before the migration (pre-migration JSON read from the commit before T6).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck, type Deck } from "../shared/deck.ts";
import { THEME_COLOR_VARS, isThemeColorToken } from "../shared/theme-colors.ts";
import { renderSlide } from "../web/src/render/slide.ts";

const BASELINE = "c1601a0";
const DECKS = ["demo", "como-crear-una-presentacion", "importadas-demo", "tema-propio"] as const;

const load = (text: string): Deck => {
  const r = parseDeck(JSON.parse(text));
  if (!r.ok) throw new Error(r.error);
  return r.deck;
};
const before = (id: string) => load(execFileSync("git", ["show", `${BASELINE}:decks/${id}/deck.json`], { cwd: process.cwd(), encoding: "utf8" }));
const after = (id: string) => load(readFileSync(`${process.cwd()}/decks/${id}/deck.json`, "utf8"));

const hex2 = (n: string) => Number(n).toString(16).padStart(2, "0");
/**
 * Same colour, whatever its spelling: rgb() becomes hex, and a theme variable
 * becomes what the browser would resolve on that stage: the stage's own value
 * (a slide with its own ground redefines --theme-bg) or the var() fallback.
 */
function normalize(html: string, stage: HTMLElement): string {
  let out = html.replace(/rgb\((\d+), (\d+), (\d+)\)/g, (_m, r: string, g: string, b: string) => `#${hex2(r)}${hex2(g)}${hex2(b)}`);
  for (const v of Object.values(THEME_COLOR_VARS)) {
    out = out.replaceAll(new RegExp(`var\\(${v}(?:, (#[0-9a-fA-F]+))?\\)`, "g"), (_m, fallback: string | undefined) => stage.style.getPropertyValue(v) || fallback || `unset(${v})`);
  }
  return out.toLowerCase();
}

const vars = (stage: HTMLElement) => Object.fromEntries(["--theme-bg", "--theme-fg", "--theme-accent", "--theme-muted"].map((v) => [v, stage.style.getPropertyValue(v)]));

/** Colour values that are tokens, across elements and slide backgrounds. */
function tokenCount(deck: Deck): number {
  let n = 0;
  const count = (v: unknown) => (isThemeColorToken(v) ? n++ : undefined);
  for (const s of deck.slides) {
    if (typeof s.background === "string") count(s.background);
    else if (s.background) {
      count(s.background.color);
      count(s.background.gradient?.from);
      count(s.background.gradient?.to);
    }
    for (const el of s.elements) {
      const style = (el as { style?: Record<string, unknown> }).style ?? {};
      for (const k of ["color", "background", "fill", "stroke"]) count(style[k]);
    }
  }
  return n;
}

describe("migrated decks render as before under their own theme", () => {
  for (const id of DECKS) {
    it(`decks/${id}`, () => {
      const pre = before(id);
      const post = after(id);
      expect(post.slides.length).toBe(pre.slides.length);
      pre.slides.forEach((_s, i) => {
        const a = renderSlide(pre, i, { step: 99 });
        const b = renderSlide(post, i, { step: 99 });
        expect(vars(b), `slide ${i} stage vars`).toEqual(vars(a));
        const layer = (stage: HTMLElement) => normalize([...stage.children].filter((c) => !c.classList.contains("stage-fx")).map((c) => c.outerHTML).join("\n"), stage);
        expect(layer(b), `slide ${i}`).toBe(layer(a));
      });
    });
  }

  it("moved the theme-equal colours to tokens (counts per deck)", () => {
    expect(Object.fromEntries(DECKS.map((id) => [id, tokenCount(after(id))]))).toEqual({ demo: 17, "como-crear-una-presentacion": 17, "importadas-demo": 0, "tema-propio": 3 });
    for (const id of DECKS) expect(tokenCount(before(id))).toBe(0);
  });
});
