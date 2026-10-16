import { z } from "zod";

// Deck format v1. Every geometric value is normalized (0..1) against a 16:9
// canvas so the same deck renders identically on a projector and a phone, and
// so a future visual editor can round-trip it without loss.

const unit = z.number().min(0).max(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "expected a hex color like #1a2b3c");

export const BoxSchema = z
  .object({ x: unit, y: unit, w: unit, h: unit })
  .refine((b) => b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001, "box must stay inside the canvas");

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

export const ElementSchema = z.discriminatedUnion("type", [TextElementSchema, ImageElementSchema, ShapeElementSchema, QrElementSchema]);

export const QuizSchema = z
  .object({
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(120)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    // live: votes visible while voting; secret: hidden until the presenter reveals.
    display: z.enum(["live", "secret"]),
    timerSec: z.number().int().min(5).max(600).optional(),
  })
  .strict()
  .refine((q) => q.correctIndex < q.options.length, { message: "correctIndex must point to an option", path: ["correctIndex"] });

export const SlideSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    layout: z.enum(["free", "quiz"]).optional(),
    background: hex.optional(),
    notes: z.string().max(5000).optional(),
    elements: z.array(ElementSchema).max(60),
    quiz: QuizSchema.optional(),
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
  });

export const ThemeSchema = z
  .object({ background: hex, foreground: hex, accent: hex, muted: hex.optional() })
  .strict();

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
export type Slide = z.infer<typeof SlideSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Deck = z.infer<typeof DeckSchema>;

export const DEFAULT_THEME: Theme = { background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" };

export type ParseResult = { ok: true; deck: Deck } | { ok: false; error: string };

export function parseDeck(input: unknown): ParseResult {
  const result = DeckSchema.safeParse(input);
  if (result.success) return { ok: true, deck: result.data };
  const error = result.error.issues.map((i) => `${i.path.join(".") || "deck"}: ${i.message}`).join("; ");
  return { ok: false, error };
}

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
