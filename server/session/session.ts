import { randomBytes } from "node:crypto";
import { slideSteps, type Deck } from "../../shared/deck.ts";
import { effectRect, type PersistentEffect } from "../../shared/effects.ts";
import { isAfter, nextPosition, prevPosition, type Position } from "../../shared/nav.ts";
import { ABANDON_AFTER_MS, NAME_MAX, type Identity, type PersonalState, type SessionSnapshot, type SessionStatus } from "../../shared/protocol.ts";
import { REACTIONS, type PresenterView, type SessionSummary } from "../../shared/protocol.ts";
import { QuizBook, type ViewerRole } from "./quiz.ts";
import { Chat, ReactionMeter } from "./social.ts";
import { pickAlias } from "./aliases.ts";

export interface SessionInit {
  code: string;
  deckId: string;
  deck: Deck;
  now: number;
}

export interface JoinRequest {
  name?: string | null;
  resume?: { id: string; key: string };
}



/** Removes control characters, collapses whitespace and caps the length of a first name. */
export function cleanName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

/**
 * Authoritative state of one live presentation. Pure domain: no sockets, no
 * timers. Callers pass the clock in and broadcast snapshots after mutations.
 */
export class Session {
  readonly code: string;
  readonly deckId: string;
  readonly deck: Deck;
  readonly createdAt: number;

  private status: SessionStatus = "waiting";
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private peakAudience = 0;
  private restricted = false;
  private position: Position = { slide: 0, step: 0 };
  private highWater: Position = { slide: 0, step: 0 };
  private presenterSockets = 0;
  private presenterLastSeen: number;
  private abandoned = false;
  private effect: PersistentEffect | null = null;
  private showScore = false;
  private readonly quizzes: QuizBook;
  readonly chat = new Chat();
  readonly reactions = new ReactionMeter();
  private view: PresenterView = { showReactions: false, showReactionCounter: false, showChat: false };
  private readonly identities = new Map<string, Identity>();
  private readonly takenNames = new Set<string>();
  private readonly audienceSockets = new Map<string, number>();

  constructor(init: SessionInit) {
    this.code = init.code;
    this.deckId = init.deckId;
    this.deck = init.deck;
    this.createdAt = init.now;
    this.presenterLastSeen = init.now;
    this.quizzes = new QuizBook((slideId) => this.deck.slides.find((s) => s.id === slideId)?.quiz ?? null);
  }

  get isEnded(): boolean {
    return this.status === "ended";
  }

  get isLive(): boolean {
    return this.status === "live";
  }

  get isRestricted(): boolean {
    return this.restricted;
  }

  get connectionCount(): number {
    let n = this.presenterSockets;
    for (const c of this.audienceSockets.values()) n += c;
    return n;
  }

  get lastPresenterActivity(): number {
    return this.presenterLastSeen;
  }

  snapshot(role: ViewerRole = "audience", now: number = Date.now()): SessionSnapshot {
    const name = (id: string) => this.identities.get(id)?.name ?? "?";
    return {
      status: this.status,
      startedAt: this.startedAt,
      restricted: this.restricted,
      position: { ...this.position },
      highWater: { ...this.highWater },
      presenterOnline: this.presenterSockets > 0,
      abandoned: this.abandoned,
      audienceCount: this.audienceSockets.size,
      effect: this.effect,
      quizzes: this.quizzes.views(role),
      showScore: this.showScore,
      leaderboard: role === "presenter" || this.showScore ? this.quizzes.leaderboard(name, 10) : null,
      serverNow: now,
      chat: this.chat.state,
      presenterView: { ...this.view },
    };
  }

  // Presenter commands -------------------------------------------------------

  start(now: number = Date.now()) {
    if (this.status !== "waiting") return;
    this.status = "live";
    this.startedAt = now;
    this.highWater = { ...this.position };
    this.quizzes.arrive(this.deck.slides[this.position.slide]!.id, now);
  }

  next(now: number = Date.now()) {
    this.moveTo(nextPosition(this.deck.slides, this.position), now);
  }

  prev(now: number = Date.now()) {
    this.moveTo(prevPosition(this.deck.slides, this.position), now);
  }

  goto(pos: Position, now: number = Date.now()) {
    const slide = this.deck.slides[pos.slide];
    if (!slide) return;
    this.moveTo({ slide: pos.slide, step: Math.min(pos.step, slideSteps(slide)) }, now);
  }

  /** Close voting or reveal the answer of the quiz on the current slide. */
  quizAction(action: "close" | "reveal") {
    if (this.status !== "live") return;
    const id = this.deck.slides[this.position.slide]!.id;
    if (action === "close") this.quizzes.close(id);
    else this.quizzes.reveal(id);
  }

  setShowScore(show: boolean) {
    this.showScore = show;
  }

  setPresenterView(view: Partial<PresenterView>) {
    this.view = { ...this.view, ...view };
  }

  get presenterView(): PresenterView {
    return this.view;
  }

  /** Records an audience vote; false when voting is not possible right now. */
  vote(participantId: string, slideId: string, option: number, now: number): boolean {
    if (this.status !== "live" || this.abandoned || !this.identities.has(participantId)) return false;
    return this.quizzes.vote(participantId, slideId, option, now);
  }

  personal(participantId: string): PersonalState {
    const name = (id: string) => this.identities.get(id)?.name ?? "?";
    return {
      votes: this.quizzes.myVotes(participantId),
      score: this.quizzes.score(participantId),
      rank: this.showScore ? this.quizzes.rankOf(participantId, name) : null,
    };
  }

  summary(): SessionSummary {
    const name = (id: string) => this.identities.get(id)?.name ?? "?";
    return {
      title: this.deck.title,
      code: this.code,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      participants: this.identities.size,
      peakAudience: this.peakAudience,
      quizzes: this.quizzes.results().map((r) => {
        const quiz = this.deck.slides.find((s) => s.id === r.slideId)!.quiz!;
        return { slideId: r.slideId, question: quiz.question, options: [...quiz.options], counts: r.counts, total: r.total, correctIndex: r.correctIndex, revealed: r.status === "revealed" };
      }),
      leaderboard: this.quizzes.leaderboard(name, Number.MAX_SAFE_INTEGER),
      reactions: REACTIONS.map((emoji, i) => ({ emoji, count: this.reactions.totals()[i] ?? 0 })),
    };
  }

  restrict(restricted: boolean) {
    if (this.status === "ended") return;
    this.restricted = restricted;
  }

  end(now: number = Date.now()) {
    if (this.status !== "ended") this.endedAt = now;
    this.status = "ended";
    this.abandoned = false;
  }

  /** Focus or zoom on the current slide; null clears it. Invalid targets are ignored. */
  setEffect(effect: PersistentEffect | null) {
    if (this.status !== "live") return;
    if (effect && !effectRect(this.deck.slides[this.position.slide]!, effect.target)) return;
    this.effect = effect;
  }

  /** One-shot "here" pulse; returns the event to broadcast, or null when not live. */
  ripple(x: number, y: number): { slide: number; x: number; y: number } | null {
    if (this.status !== "live") return null;
    return { slide: this.position.slide, x, y };
  }

  private moveTo(pos: Position, now: number) {
    if (this.status !== "live") return;
    if (pos.slide !== this.position.slide) this.effect = null;
    this.position = pos;
    this.quizzes.arrive(this.deck.slides[pos.slide]!.id, now);
    if (isAfter(pos, this.highWater)) this.highWater = { ...pos };
  }

  // Presence -------------------------------------------------------------------

  presenterJoined(now: number) {
    this.presenterSockets++;
    this.presenterLastSeen = now;
    this.abandoned = false;
  }

  presenterLeft(now: number) {
    this.presenterSockets = Math.max(0, this.presenterSockets - 1);
    this.presenterLastSeen = now;
  }

  /** Advances time-based state. Returns true when the snapshot changed. */
  tick(now: number): boolean {
    if (this.status === "ended") return false;
    const quizChanged = this.quizzes.tick(now);
    if (this.abandoned || this.presenterSockets > 0) return quizChanged;
    if (now - this.presenterLastSeen < ABANDON_AFTER_MS) return quizChanged;
    this.abandoned = true;
    return true;
  }

  // Audience -------------------------------------------------------------------

  join(req: JoinRequest): Identity {
    if (req.resume) {
      const known = this.identities.get(req.resume.id);
      if (known && known.resumeKey === req.resume.key) return known;
    }
    const cleaned = req.name ? cleanName(req.name) : "";
    const anonymous = cleaned.length === 0;
    const name = anonymous ? pickAlias(this.takenNames) : cleaned;
    const identity: Identity = {
      id: randomBytes(9).toString("base64url"),
      name,
      anonymous,
      resumeKey: randomBytes(18).toString("base64url"),
    };
    this.identities.set(identity.id, identity);
    this.takenNames.add(name);
    return identity;
  }

  identity(id: string): Identity | undefined {
    return this.identities.get(id);
  }

  audienceConnected(id: string) {
    this.audienceSockets.set(id, (this.audienceSockets.get(id) ?? 0) + 1);
    this.peakAudience = Math.max(this.peakAudience, this.audienceSockets.size);
  }

  audienceDisconnected(id: string) {
    const n = (this.audienceSockets.get(id) ?? 0) - 1;
    if (n > 0) this.audienceSockets.set(id, n);
    else this.audienceSockets.delete(id);
  }
}
