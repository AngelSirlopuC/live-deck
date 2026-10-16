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

export type {
  AudienceCommand,
  AudienceHello,
  Hello,
  PresenterCommand,
  PresenterHello,
} from "./protocol-schemas.ts";

export type SessionStatus = "waiting" | "live" | "ended";

/** Live state every client receives on join and on each change. */
export interface SessionSnapshot {
  status: SessionStatus;
  /** Epoch ms when the presenter started; null while waiting. */
  startedAt: number | null;
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
