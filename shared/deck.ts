import { z } from "zod";
import { ICON_NAMES } from "./icons.ts";
import { FONT_NAMES } from "./fonts.ts";
import { PRESET_NAMES } from "./themes.ts";
import { ASK_QUESTION_MAX, ASK_TEXT_MAX, ASK_TEXT_MIN } from "./ask.ts";

// Deck format v1. Every geometric value is normalized (0..1) against a 16:9
// canvas so the same deck renders identically on a projector and a phone, and
// so a future visual editor can round-trip it without loss.

const unit = z.number().min(0).max(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "expected a hex color like #1a2b3c");

const insideCanvas = (b: { x: number; y: number; w: number; h: number }) => b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001;
export const BoxSchema = z.object({ x: unit, y: unit, w: unit, h: unit }).refine(insideCanvas, "box must stay inside the canvas");
// Quiz zones are geometry only, so unknown keys are rejected rather than stripped.
const ZoneSchema = z.object({ x: unit, y: unit, w: unit, h: unit }).strict().refine(insideCanvas, "box must stay inside the canvas");

export const TextStyleSchema = z
  .object({
    // Logical pixels on the 1920x1080 stage.
    fontSize: z.number().min(8).max(400).optional(),
    fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).optional(),
    font: z.enum(["display", "body", "mono"]).optional(),
    italic: z.boolean().optional(),
    color: hex.optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    valign: z.enum(["top", "middle", "bottom"]).optional(),
    lineHeight: z.number().min(0.8).max(3).optional(),
    background: hex.optional(),
    radius: z.number().min(0).max(540).optional(),
    padding: z.number().min(0).max(200).optional(),
    // Uses the theme surface, radius, border and shadow instead of a hand-set background.
    card: z.boolean().optional(),
    uppercase: z.boolean().optional(),
    // Letter spacing in em.
    tracking: z.number().min(-0.05).max(0.3).optional(),
    // Accent highlight behind the text.
    mark: z.boolean().optional(),
  })
  .strict();

const base = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "element id must be 1-40 chars of [A-Za-z0-9_-]"),
  box: BoxSchema,
  // Step at which the element appears (PowerPoint "appear" animation). Absent = always visible.
  fragment: z.number().int().min(1).max(20).optional(),
};

const assetSrc = z
  .string()
  .max(500)
  .regex(/^(https:\/\/[^\s"'()<>]+|assets\/[A-Za-z0-9_\-./]+)$/, "src must be https:// or assets/…")
  .refine((s) => !s.includes(".."), "src must not contain ..");

export const TextElementSchema = z.object({ ...base, type: z.literal("text"), text: z.string().max(2000), style: TextStyleSchema.optional() }).strict();
export const ImageElementSchema = z
  .object({ ...base, type: z.literal("image"), src: assetSrc, alt: z.string().max(300), fit: z.enum(["contain", "cover"]).optional(), style: TextStyleSchema.pick({ radius: true }).optional() })
  .strict();
export const ShapeElementSchema = z
  .object({
    ...base,
    type: z.literal("shape"),
    shape: z.enum(["rect", "ellipse", "line"]),
    style: z.object({ fill: hex.optional(), stroke: hex.optional(), strokeWidth: z.number().min(0).max(40).optional(), radius: z.number().min(0).max(540).optional() }).strict().optional(),
  })
  .strict();
// Renders the session join QR + URL at runtime; it carries no payload in the deck.
export const QrElementSchema = z.object({ ...base, type: z.literal("qr"), style: TextStyleSchema.pick({ color: true, background: true }).optional() }).strict();

// Curated Lucide icon, drawn from built-in icon nodes (never markup from the deck).
export const IconElementSchema = z
  .object({
    ...base,
    type: z.literal("icon"),
    name: z.enum(ICON_NAMES),
    style: z
      .object({ color: hex.optional(), background: hex.optional(), strokeWidth: z.number().min(1).max(3).optional(), radius: z.number().min(0).max(540).optional() })
      .strict()
      .optional(),
  })
  .strict();

const CHART_LIMITS = { bar: [1, 8], donut: [2, 6] } as const;
export const ChartElementSchema = z
  .object({
    ...base,
    type: z.literal("chart"),
    kind: z.enum(["bar", "donut"]),
    data: z.array(z.object({ label: z.string().max(40), value: z.number().min(0).finite() }).strict()).min(1).max(8),
    unit: z.string().max(8).optional(),
    style: z.object({ color: hex.optional() }).strict().optional(),
  })
  .strict()
  .superRefine((chart, ctx) => {
    const [min, max] = CHART_LIMITS[chart.kind];
    if (chart.data.length < min || chart.data.length > max) {
      ctx.addIssue({ code: "custom", message: `a ${chart.kind} chart takes ${min}-${max} data points`, path: ["data"] });
    }
  });

// Built-in decorative SVG shapes; decks cannot supply their own SVG.
export const DecorElementSchema = z
  .object({
    ...base,
    type: z.literal("decor"),
    shape: z.enum(["blob", "wave", "dots", "rings", "arc", "squiggle", "star", "grid"]),
    style: z.object({ color: hex.optional(), opacity: z.number().min(0.05).max(1).optional() }).strict().optional(),
  })
  .strict();

export const ElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  QrElementSchema,
  IconElementSchema,
  ChartElementSchema,
  DecorElementSchema,
]);

export const QuizSchema = z
  .object({
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(120)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    // live: votes visible while voting; secret: hidden until the presenter reveals.
    display: z.enum(["live", "secret"]),
    timerSec: z.number().int().min(5).max(600).optional(),
    // How visible results are shown: options re-ordered by votes (default) or the fixed A-F grid.
    results: z.enum(["ranking", "grid"]).optional(),
    // Zone quiz: one box per option over a designed background image. The
    // renderer then paints votes on these zones instead of drawing the question.
    zones: z.array(ZoneSchema).max(6).optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.correctIndex >= q.options.length) ctx.addIssue({ code: "custom", message: "correctIndex must point to an option", path: ["correctIndex"] });
    if (q.zones && q.zones.length !== q.options.length) {
      ctx.addIssue({ code: "custom", message: `zones must have one box per option (${q.options.length})`, path: ["zones"] });
    }
  });

// Open question: the audience answers in a few words; equal answers group as ×N.
export const AskSchema = z
  .object({
    question: z.string().trim().min(1).max(ASK_QUESTION_MAX),
    // Characters per answer; defaults to ASK_TEXT_DEFAULT.
    maxChars: z.number().int().min(ASK_TEXT_MIN).max(ASK_TEXT_MAX).optional(),
  })
  .strict();

// Layers paint bottom to top: color, gradient, image, pattern, then the dim overlay.
export const SlideBackgroundSchema = z
  .object({
    color: hex.optional(),
    gradient: z.object({ from: hex, to: hex, angle: z.number().min(0).max(360).optional() }).strict().optional(),
    image: assetSrc.optional(),
    // Darkens the layers below so text on top stays readable.
    dim: z.number().min(0).max(0.9).optional(),
    pattern: z.enum(["dots", "grid", "lines", "noise"]).optional(),
  })
  .strict()
  .refine((b) => b.color !== undefined || b.gradient !== undefined || b.image !== undefined || b.pattern !== undefined, "background needs a color, gradient, image or pattern");

export const SlideSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    layout: z.enum(["free", "quiz", "ask"]).optional(),
    background: z.union([hex, SlideBackgroundSchema]).optional(),
    notes: z.string().max(5000).optional(),
    elements: z.array(ElementSchema).max(60),
    quiz: QuizSchema.optional(),
    ask: AskSchema.optional(),
  })
  .strict()
  .superRefine((slide, ctx) => {
    const seen = new Set<string>();
    for (const el of slide.elements) {
      if (seen.has(el.id)) ctx.addIssue({ code: "custom", message: `duplicate element id "${el.id}"`, path: ["elements"] });
      seen.add(el.id);
    }
    if (slide.layout === "quiz" && !slide.quiz) ctx.addIssue({ code: "custom", message: "quiz layout requires a quiz", path: ["quiz"] });
    if (slide.quiz && slide.layout !== "quiz") ctx.addIssue({ code: "custom", message: "a quiz requires layout \"quiz\"", path: ["layout"] });
    if (slide.layout === "ask" && !slide.ask) ctx.addIssue({ code: "custom", message: "ask layout requires an ask", path: ["ask"] });
    if (slide.ask && slide.layout !== "ask") ctx.addIssue({ code: "custom", message: "an ask requires layout \"ask\"", path: ["layout"] });
  });

// With a preset every colour is an optional override; without one, background,
// foreground and accent stay required as in the original format.
// Everything beyond colours is data mapped to tokens by the theme engine
// (shared/themes.ts): font families from the allowlist, card and heading
// choices, art and pattern kinds, a chart palette. Decks never carry CSS.
const ThemeFontsSchema = z.object({ display: z.enum(FONT_NAMES).optional(), body: z.enum(FONT_NAMES).optional() }).strict();
const ThemeCardSchema = z
  .object({
    // Logical pixels on the 1920x1080 stage.
    radius: z.number().min(0).max(64).optional(),
    border: z.enum(["none", "hairline", "thick"]).optional(),
    shadow: z.enum(["none", "soft", "hard"]).optional(),
  })
  .strict();
const ThemeHeadingSchema = z
  .object({
    weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800), z.literal(900)]).optional(),
    uppercase: z.boolean().optional(),
    // em units.
    tracking: z.number().min(-0.05).max(0.2).optional(),
  })
  .strict();
// glow defaults to the accent; gradient defaults to accent → background.
const ThemeArtSchema = z
  .object({ kind: z.enum(["none", "glow", "gradient"]), from: hex.optional(), to: hex.optional(), angle: z.number().min(0).max(360).optional() })
  .strict();

export const ThemeSchema = z
  .object({
    preset: z.enum(PRESET_NAMES).optional(),
    // Flips a preset to its other variant; a preset without mode keeps its native look.
    mode: z.enum(["light", "dark"]).optional(),
    background: hex.optional(),
    foreground: hex.optional(),
    accent: hex.optional(),
    muted: hex.optional(),
    surface: hex.optional(),
    fonts: ThemeFontsSchema.optional(),
    card: ThemeCardSchema.optional(),
    heading: ThemeHeadingSchema.optional(),
    art: ThemeArtSchema.optional(),
    pattern: z.enum(["none", "dots", "grid", "lines", "noise"]).optional(),
    palette: z.array(hex).min(3).max(8).optional(),
  })
  .strict()
  .superRefine((theme, ctx) => {
    if (theme.preset) return;
    for (const key of ["background", "foreground", "accent"] as const) {
      if (theme[key] === undefined) ctx.addIssue({ code: "custom", message: "required unless theme.preset is set", path: [key] });
    }
  });

export const DeckSchema = z
  .object({
    version: z.literal(1),
    title: z.string().min(1).max(200),
    theme: ThemeSchema.optional(),
    slides: z.array(SlideSchema).min(1).max(200),
  })
  .strict()
  .superRefine((deck, ctx) => {
    const seen = new Set<string>();
    deck.slides.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", message: `duplicate slide id "${s.id}"`, path: ["slides", i, "id"] });
      seen.add(s.id);
    });
  });

export type Box = z.infer<typeof BoxSchema>;
export type TextStyle = z.infer<typeof TextStyleSchema>;
export type DeckElement = z.infer<typeof ElementSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type Ask = z.infer<typeof AskSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type SlideBackground = z.infer<typeof SlideBackgroundSchema>;
export type IconElement = z.infer<typeof IconElementSchema>;
export type ChartElement = z.infer<typeof ChartElementSchema>;
export type DecorElement = z.infer<typeof DecorElementSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Deck = z.infer<typeof DeckSchema>;

export type ParseResult = { ok: true; deck: Deck } | { ok: false; error: string };

export function parseDeck(input: unknown): ParseResult {
  const result = DeckSchema.safeParse(input);
  if (result.success) return { ok: true, deck: result.data };
  const error = result.error.issues.map((i) => `${i.path.join(".") || "deck"}: ${i.message}`).join("; ");
  return { ok: false, error };
}

export { DEFAULT_THEME, publicDeck, slideSteps } from "./deck-core.ts";
export type { PublicDeck, PublicQuiz, PublicSlide, RenderableDeck } from "./deck-core.ts";
