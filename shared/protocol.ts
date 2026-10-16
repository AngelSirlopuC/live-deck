import { z } from "zod";
import type { Deck, PublicDeck } from "./deck.ts";
import type { Position } from "./nav.ts";

// Wire protocol between the browser and the session server. Client messages
// are validated with zod on the server; server messages are trusted types.

export const SESSION_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
export const PRESENTER_TOKEN = /^[A-Za-z0-9_-]{22,64}$/;
export const PIN = /^\d{4,8}$/;
export const NAME_MAX = 24;
export const ABANDON_AFTER_MS = 15 * 60 * 1000;

export type PresenterSurface = "console" | "screen" | "remote";

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

export type SessionStatus = "waiting" | "live" | "ended";

/** Live state every client receives on join and on each change. */
export interface SessionSnapshot {
  status: SessionStatus;
  restricted: boolean;
  position: Position;
  /** Furthest position the presenter has shown; Explorar cannot go past it. */
  highWater: Position;
  presenterOnline: boolean;
  /** Presenter has been gone for ABANDON_AFTER_MS; audience may unlock the whole deck. */
  abandoned: boolean;
  audienceCount: number;
}

export interface Identity {
  id: string;
  name: string;
  anonymous: boolean;
  /** Secret used to resume this identity after a reconnect. */
  resumeKey: string;
}

export type CloseReason = "ended" | "restricted" | "not-found" | "replaced";

export type ServerMessage =
  | { t: "welcome-audience"; you: Identity; deck: PublicDeck; deckId: string; joinUrl: string; state: SessionSnapshot }
  | { t: "welcome-presenter"; deck: Deck; deckId: string; code: string; joinUrl: string; state: SessionSnapshot }
  | { t: "state"; state: SessionSnapshot }
  | { t: "closed"; reason: CloseReason }
  | { t: "error"; code: ErrorCode; message: string };

export type ErrorCode = "bad-request" | "unauthorized" | "locked" | "not-found" | "restricted" | "ended" | "rate-limited";

export interface CreateSessionRequest {
  deckId: string;
  pin: string;
}

export interface CreateSessionResponse {
  code: string;
  presenterToken: string;
  presenterUrl: string;
  joinUrl: string;
}

export interface SessionInfo {
  code: string;
  title: string;
  status: SessionStatus;
  restricted: boolean;
}
