// zod validation for client -> server messages. Server-side only, so the
// browser bundle stays free of the schema library.
import { z } from "zod";
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

export const PresenterCommandSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("start") }).strict(),
  z.object({ t: z.literal("next") }).strict(),
  z.object({ t: z.literal("prev") }).strict(),
  z.object({ t: z.literal("goto"), pos: position }).strict(),
  z.object({ t: z.literal("restrict"), restricted: z.boolean() }).strict(),
  z.object({ t: z.literal("end") }).strict(),
]);

export const AudienceCommandSchema = z.discriminatedUnion("t", [z.object({ t: z.literal("ping") }).strict()]);

export type AudienceHello = z.infer<typeof AudienceHelloSchema>;
export type PresenterHello = z.infer<typeof PresenterHelloSchema>;
export type Hello = z.infer<typeof HelloSchema>;
export type PresenterCommand = z.infer<typeof PresenterCommandSchema>;
export type AudienceCommand = z.infer<typeof AudienceCommandSchema>;

