import type { Deck, PublicDeck } from "./deck.ts";
import type { PersistentEffect } from "./effects.ts";
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
  /** Focus or zoom the presenter is holding on the current slide. */
  effect: PersistentEffect | null;
  /** Every quiz opened so far, keyed by slide id, as this viewer may see it. */
  quizzes: Record<string, QuizView>;
  /** Presenter choice: show scores and the leaderboard to the audience during the session. */
  showScore: boolean;
  /** Top of the leaderboard; null for the audience while showScore is off. */
  leaderboard: LeaderboardRow[] | null;
  /** Server clock (epoch ms) when this snapshot was built, to align quiz timers. */
  serverNow: number;
  chat: ChatState;
  presenterView: PresenterView;
}

export interface Features {
  /** GIPHY stickers are configured on this server. */
  stickers: boolean;
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
  | { t: "welcome-audience"; you: Identity; deck: PublicDeck; deckId: string; joinUrl: string; state: SessionSnapshot; features: Features }
  | { t: "welcome-presenter"; deck: Deck; deckId: string; code: string; joinUrl: string; state: SessionSnapshot; features: Features }
  | { t: "state"; state: SessionSnapshot }
  | { t: "ripple"; slide: number; x: number; y: number }
  | { t: "me"; me: PersonalState }
  | { t: "reactions"; counts: number[]; totals?: number[] }
  | { t: "chat"; message: ChatMessage }
  | { t: "chat-delete"; id: string }
  | { t: "chat-history"; messages: ChatMessage[] }
  | { t: "closed"; reason: CloseReason }
  | { t: "error"; code: ErrorCode; message: string };

export type ErrorCode =
  | "bad-request"
  | "unauthorized"
  | "locked"
  | "not-found"
  | "restricted"
  | "ended"
  | "rate-limited"
  | "chat-closed"
  | "chat-paused"
  | "chat-mode"
  | "chat-muted"
  | "chat-rate"
  | "chat-empty"
  | "chat-sticker";

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

export type QuizStatus = "open" | "closed" | "revealed";

/** Quiz state as one role sees it. Audience views hide secret counts and the answer until reveal. */
export interface QuizView {
  slideId: string;
  status: QuizStatus;
  /** Votes per option; null when hidden from this viewer. */
  counts: number[] | null;
  total: number;
  /** Correct option; null until revealed (presenters always see it). */
  correctIndex: number | null;
  /** Epoch ms (server clock) when a timed quiz closes. */
  endsAt: number | null;
}

export interface LeaderboardRow {
  name: string;
  correct: number;
  answered: number;
  rank: number;
}

/** Personal state sent only to one audience member. */
export interface PersonalState {
  votes: Record<string, number>;
  score: { correct: number; answered: number };
  rank: { rank: number; of: number } | null;
}

/** Reactions available to the audience: a short set meant for talks. */
export const REACTIONS = ["👏", "🔥", "💡", "😂", "🤯", "❤️"] as const;
export const REACTION_LABELS = ["Aplausos", "Fuego", "Buena idea", "Risa", "Me voló la cabeza", "Me encanta"] as const;

export type ChatMode = "off" | "text" | "sticker" | "mixed";
export const CHAT_TEXT_MAX = 280;

export interface Sticker {
  id: string;
  url: string;
  width: number;
  height: number;
  title: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text?: string;
  sticker?: Sticker;
  at: number;
}

export interface ChatState {
  mode: ChatMode;
  paused: boolean;
}

/** Presenter display preferences for audience activity. */
export interface PresenterView {
  /** Float audience reactions over the presenter console and projector. */
  showReactions: boolean;
  /** Show per-emoji totals so the presenter sees the trend. */
  showReactionCounter: boolean;
  /** Show the audience chat on the presenter console. */
  showChat: boolean;
}
