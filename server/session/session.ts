import { randomBytes } from "node:crypto";
import { slideSteps, type Deck } from "../../shared/deck.ts";
import { isAfter, nextPosition, prevPosition, type Position } from "../../shared/nav.ts";
import { ABANDON_AFTER_MS, NAME_MAX, type Identity, type SessionSnapshot, type SessionStatus } from "../../shared/protocol.ts";
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
  private restricted = false;
  private position: Position = { slide: 0, step: 0 };
  private highWater: Position = { slide: 0, step: 0 };
  private presenterSockets = 0;
  private presenterLastSeen: number;
  private abandoned = false;
  private readonly identities = new Map<string, Identity>();
  private readonly takenNames = new Set<string>();
  private readonly audienceSockets = new Map<string, number>();

  constructor(init: SessionInit) {
    this.code = init.code;
    this.deckId = init.deckId;
    this.deck = init.deck;
    this.createdAt = init.now;
    this.presenterLastSeen = init.now;
  }

  get isEnded(): boolean {
    return this.status === "ended";
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

  snapshot(): SessionSnapshot {
    return {
      status: this.status,
      startedAt: this.startedAt,
      restricted: this.restricted,
      position: { ...this.position },
      highWater: { ...this.highWater },
      presenterOnline: this.presenterSockets > 0,
      abandoned: this.abandoned,
      audienceCount: this.audienceSockets.size,
    };
  }

  // Presenter commands -------------------------------------------------------

  start(now: number = Date.now()) {
    if (this.status !== "waiting") return;
    this.status = "live";
    this.startedAt = now;
    this.highWater = { ...this.position };
  }

  next() {
    this.moveTo(nextPosition(this.deck.slides, this.position));
  }

  prev() {
    this.moveTo(prevPosition(this.deck.slides, this.position));
  }

  goto(pos: Position) {
    const slide = this.deck.slides[pos.slide];
    if (!slide) return;
    this.moveTo({ slide: pos.slide, step: Math.min(pos.step, slideSteps(slide)) });
  }

  restrict(restricted: boolean) {
    if (this.status === "ended") return;
    this.restricted = restricted;
  }

  end() {
    this.status = "ended";
    this.abandoned = false;
  }

  private moveTo(pos: Position) {
    if (this.status !== "live") return;
    this.position = pos;
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
    if (this.status === "ended" || this.abandoned || this.presenterSockets > 0) return false;
    if (now - this.presenterLastSeen < ABANDON_AFTER_MS) return false;
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
  }

  audienceDisconnected(id: string) {
    const n = (this.audienceSockets.get(id) ?? 0) - 1;
    if (n > 0) this.audienceSockets.set(id, n);
    else this.audienceSockets.delete(id);
  }
}
