// zod validation for client -> server messages. Server-side only, so the
// browser bundle stays free of the schema library.
import { z } from "zod";
import { TIME_LIMIT_MAX, TIME_LIMIT_MIN } from "./pace.ts";
import { NAME_MAX, PIN, PRESENTER_TOKEN, SESSION_CODE } from "./protocol.ts";

const position = z.object({ slide: z.number().int().min(0).max(999), step: z.number().int().min(0).max(20) });

export const AudienceHelloSchema = z
  .object({
    t: z.literal("hello"),
    role: z.literal("audience"),
    code: z.string().regex(SESSION_CODE),
    // Present on reconnect: reclaims the same identity and score.
    resume: z.object({ id: z.string().max(40), key: z.string().max(64) }).optional(),
    // First join: a first name, or null for an anonymous alias.
    name: z.string().trim().max(NAME_MAX).nullable().optional(),
  })
  .strict();

export const PresenterHelloSchema = z
  .object({
    t: z.literal("hello"),
    role: z.literal("presenter"),
    token: z.string().regex(PRESENTER_TOKEN),
    pin: z.string().regex(PIN),
    surface: z.enum(["console", "screen", "remote"]),
  })
  .strict();

export const HelloSchema = z.discriminatedUnion("role", [AudienceHelloSchema, PresenterHelloSchema]);

const unit = z.number().min(0).max(1);
export const timeLimit = z.number().int().min(TIME_LIMIT_MIN).max(TIME_LIMIT_MAX);
const rect = z.object({ x: unit, y: unit, w: unit, h: unit }).strict();
const target = z.union([z.object({ elementId: z.string().max(40) }).strict(), z.object({ rect }).strict()]);
const effect = z.object({ kind: z.enum(["focus", "zoom"]), target }).strict();

export const PresenterCommandSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("start") }).strict(),
  z.object({ t: z.literal("next") }).strict(),
  z.object({ t: z.literal("prev") }).strict(),
  z.object({ t: z.literal("goto"), pos: position }).strict(),
  z.object({ t: z.literal("restrict"), restricted: z.boolean() }).strict(),
  z.object({ t: z.literal("end") }).strict(),
  // effect places or replaces that kind; null clears every effect, or only `kind`.
  z.object({ t: z.literal("effect"), effect: effect.nullable(), kind: z.enum(["focus", "zoom"]).optional() }).strict(),
  z.object({ t: z.literal("ripple"), x: unit, y: unit }).strict(),
  z.object({ t: z.literal("time-limit"), minutes: timeLimit.nullable() }).strict(),
  z.object({ t: z.literal("laser"), at: z.object({ x: unit, y: unit }).strict().nullable() }).strict(),
  z.object({ t: z.literal("quiz"), action: z.enum(["close", "reveal"]) }).strict(),
  // Free-text question: the server cleans the question and clamps the limit.
  z.object({ t: z.literal("ask-open"), question: z.string().max(1000), maxChars: z.number().int().min(1).max(1000) }).strict(),
  z.object({ t: z.literal("ask-close") }).strict(),
  z.object({ t: z.literal("ask-clear") }).strict(),
  z.object({ t: z.literal("settings"), showScore: z.boolean() }).strict(),
  z.object({ t: z.literal("view"), view: z.object({ showReactions: z.boolean(), showReactionCounter: z.boolean(), showChat: z.boolean() }).partial().strict() }).strict(),
  z.object({ t: z.literal("chat-mode"), mode: z.enum(["off", "text", "sticker", "mixed"]) }).strict(),
  z.object({ t: z.literal("chat-pause"), paused: z.boolean() }).strict(),
  z.object({ t: z.literal("chat-delete"), id: z.string().max(20) }).strict(),
  z.object({ t: z.literal("chat-mute"), participantId: z.string().max(40) }).strict(),
  z.object({ t: z.literal("summary") }).strict(),
  z.object({ t: z.literal("purge") }).strict(),
]);

// z.union (not discriminatedUnion): "chat" has two shapes, text or sticker.
export const AudienceCommandSchema = z.union([
  z.object({ t: z.literal("ping") }).strict(),
  z.object({ t: z.literal("vote"), slideId: z.string().max(40), option: z.number().int().min(0).max(5) }).strict(),
  z.object({ t: z.literal("react"), i: z.number().int().min(0).max(5) }).strict(),
  z.object({ t: z.literal("answer"), text: z.string().max(1000) }).strict(),
  z.object({ t: z.literal("chat"), text: z.string().max(1000) }).strict(),
  z.object({ t: z.literal("chat"), stickerId: z.string().max(64) }).strict(),
]);

export type AudienceHello = z.infer<typeof AudienceHelloSchema>;
export type PresenterHello = z.infer<typeof PresenterHelloSchema>;
export type Hello = z.infer<typeof HelloSchema>;
export type PresenterCommand = z.infer<typeof PresenterCommandSchema>;
export type AudienceCommand = z.infer<typeof AudienceCommandSchema>;

