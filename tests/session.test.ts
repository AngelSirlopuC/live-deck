import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "../shared/deck.ts";
import { ABANDON_AFTER_MS } from "../shared/protocol.ts";
import { Session } from "../server/session/session.ts";

const parsed = parseDeck(JSON.parse(readFileSync(new URL("../decks/demo/deck.json", import.meta.url), "utf8")));
if (!parsed.ok) throw new Error(parsed.error);
const deck = parsed.deck;

function make(now = 0) {
  return new Session({ code: "ABC234", deckId: "demo", deck, now });
}

describe("session lifecycle", () => {
  it("starts waiting and ignores navigation until started", () => {
    const s = make();
    expect(s.snapshot().status).toBe("waiting");
    s.next();
    expect(s.snapshot().position).toEqual({ slide: 0, step: 0 });
    s.start();
    s.next();
    expect(s.snapshot().status).toBe("live");
    expect(s.snapshot().position).toEqual({ slide: 1, step: 0 });
  });

  it("tracks the furthest shown position as high water, also after going back", () => {
    const s = make();
    s.start();
    s.next(); // slide 1 step 0
    s.next(); // slide 1 step 1
    s.next(); // slide 1 step 2
    s.prev();
    s.prev();
    expect(s.snapshot().position).toEqual({ slide: 1, step: 0 });
    expect(s.snapshot().highWater).toEqual({ slide: 1, step: 2 });
  });

  it("clamps goto to the deck and the slide's fragment steps", () => {
    const s = make();
    s.start();
    s.goto({ slide: 1, step: 20 });
    expect(s.snapshot().position).toEqual({ slide: 1, step: 4 });
    expect(() => s.goto({ slide: 99, step: 0 })).not.toThrow();
    expect(s.snapshot().position).toEqual({ slide: 1, step: 4 });
  });

  it("freezes after end", () => {
    const s = make();
    s.start();
    s.end();
    s.next();
    s.start();
    expect(s.snapshot().status).toBe("ended");
    expect(s.snapshot().position).toEqual({ slide: 0, step: 0 });
  });

  it("restricts and reopens access", () => {
    const s = make();
    s.restrict(true);
    expect(s.snapshot().restricted).toBe(true);
    s.restrict(false);
    expect(s.snapshot().restricted).toBe(false);
  });
});

describe("presenter presence", () => {
  it("marks the session abandoned after 15 minutes without a presenter, and recovers on reconnect", () => {
    const s = make(0);
    s.presenterJoined(0);
    s.start();
    s.presenterLeft(1_000);
    s.tick(1_000 + ABANDON_AFTER_MS - 1);
    expect(s.snapshot().abandoned).toBe(false);
    expect(s.snapshot().presenterOnline).toBe(false);
    s.tick(1_000 + ABANDON_AFTER_MS);
    expect(s.snapshot().abandoned).toBe(true);
    expect(s.snapshot().status).toBe("live");
    s.presenterJoined(1_000 + ABANDON_AFTER_MS + 5);
    expect(s.snapshot().abandoned).toBe(false);
    expect(s.snapshot().presenterOnline).toBe(true);
  });

  it("stays online while any presenter surface is connected", () => {
    const s = make(0);
    s.presenterJoined(0);
    s.presenterJoined(0);
    s.presenterLeft(10);
    s.tick(10 + ABANDON_AFTER_MS * 2);
    expect(s.snapshot().presenterOnline).toBe(true);
    expect(s.snapshot().abandoned).toBe(false);
  });

  it("counts a session that never had a presenter from its creation time", () => {
    const s = make(0);
    s.tick(ABANDON_AFTER_MS);
    expect(s.snapshot().abandoned).toBe(true);
  });

  it("reports whether a tick changed the snapshot", () => {
    const s = make(0);
    expect(s.tick(10)).toBe(false);
    expect(s.tick(ABANDON_AFTER_MS)).toBe(true);
    expect(s.tick(ABANDON_AFTER_MS + 10)).toBe(false);
  });
});

describe("audience identity", () => {
  it("keeps the given first name, cleaned", () => {
    const s = make();
    const me = s.join({ name: "  Ana \u0007  María  " });
    expect(me.name).toBe("Ana María");
    expect(me.anonymous).toBe(false);
  });

  it("gives anonymous users unique creative aliases instead of numbers", () => {
    const s = make();
    const names = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const me = s.join({ name: null });
      expect(me.anonymous).toBe(true);
      expect(me.name).not.toMatch(/\d/);
      expect(me.name.split(" ").length).toBeGreaterThanOrEqual(2);
      names.add(me.name);
    }
    expect(names.size).toBe(150);
  });

  it("treats a blank name as anonymous", () => {
    expect(make().join({ name: "   " }).anonymous).toBe(true);
  });

  it("resumes the same identity with the right key only", () => {
    const s = make();
    const me = s.join({ name: "Luis" });
    expect(s.join({ resume: { id: me.id, key: me.resumeKey } })).toEqual(me);
    const other = s.join({ resume: { id: me.id, key: "wrong" }, name: "Luis" });
    expect(other.id).not.toBe(me.id);
  });

  it("counts connected audience members", () => {
    const s = make();
    const a = s.join({ name: "A" });
    s.audienceConnected(a.id);
    s.audienceConnected(a.id);
    expect(s.snapshot("presenter").audienceCount).toBe(1);
    s.audienceDisconnected(a.id);
    expect(s.snapshot("presenter").audienceCount).toBe(1);
    s.audienceDisconnected(a.id);
    expect(s.snapshot("presenter").audienceCount).toBe(0);
  });

  it("keeps the audience size for the presenter only", () => {
    const s = make();
    s.audienceConnected(s.join({ name: "A" }).id);
    expect(s.snapshot("audience").audienceCount).toBeNull();
  });
});

describe("presenter effects", () => {
  it("keeps focus or zoom on the current slide and clears it when the slide changes", () => {
    const s = make();
    s.start();
    s.next(); // agenda slide
    s.setEffect({ kind: "focus", target: { elementId: "p2" } });
    expect(s.snapshot().effects).toEqual([{ kind: "focus", target: { elementId: "p2" } }]);
    s.next(); // fragment step on the same slide keeps it
    expect(s.snapshot().effects).toHaveLength(1);
    s.goto({ slide: 2, step: 0 });
    expect(s.snapshot().effects).toEqual([]);
  });

  it("rejects targets that are not on the current slide", () => {
    const s = make();
    s.start();
    s.setEffect({ kind: "zoom", target: { elementId: "servidor" } });
    expect(s.snapshot().effects).toEqual([]);
    s.setEffect({ kind: "zoom", target: { rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } } });
    expect(s.snapshot().effects.map((e) => e.kind)).toEqual(["zoom"]);
    s.clearEffects();
    expect(s.snapshot().effects).toEqual([]);
  });

  it("holds a focus and a zoom together, one of each, and clears either one alone", () => {
    const s = make();
    s.start();
    const zoom = { kind: "zoom", target: { rect: { x: 0, y: 0, w: 0.5, h: 0.5 } } } as const;
    s.setEffect(zoom);
    s.setEffect({ kind: "focus", target: { rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } } });
    s.setEffect({ kind: "focus", target: { rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } } });
    expect(s.snapshot().effects).toEqual([zoom, { kind: "focus", target: { rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } } }]);
    s.clearEffects("focus");
    expect(s.snapshot().effects).toEqual([zoom]);
  });

  it("ignores effects before the session is live", () => {
    const s = make();
    s.setEffect({ kind: "zoom", target: { rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } } });
    expect(s.snapshot().effects).toEqual([]);
  });

  it("emits ripples only while live, tagged with the current slide", () => {
    const s = make();
    expect(s.ripple(0.5, 0.5)).toBeNull();
    s.start();
    s.next();
    expect(s.ripple(0.25, 0.75)).toEqual({ slide: 1, x: 0.25, y: 0.75 });
  });
});

describe("session summary", () => {
  it("summarizes quizzes, leaderboard, reactions and attendance without chat", () => {
    const s = make(1_000);
    s.start(2_000);
    const ana = s.join({ name: "Ana" });
    const bea = s.join({ name: "Bea" });
    s.audienceConnected(ana.id);
    s.audienceConnected(bea.id);
    s.goto({ slide: 3, step: 0 }, 3_000);
    s.vote(ana.id, "quiz-vivo", 1, 3_100);
    s.vote(bea.id, "quiz-vivo", 0, 3_100);
    s.quizAction("reveal");
    s.reactions.add(0);
    s.reactions.add(0);
    s.chat.setMode("text");
    s.chat.post({ from: ana.id, name: "Ana", text: "secreto" }, 3_200);
    s.end(60_000);

    const sum = s.summary();
    expect(sum).toMatchObject({ title: "Live Deck — demo", startedAt: 2_000, endedAt: 60_000, participants: 2, peakAudience: 2 });
    expect(sum.quizzes).toEqual([
      { slideId: "quiz-vivo", question: "¿Cuál es el principal enemigo de una buena presentación?", options: ["Demasiado texto", "Ninguna interacción", "Mal audio", "Diapositivas feas"], counts: [1, 1, 0, 0], total: 2, correctIndex: 1, revealed: true },
    ]);
    expect(sum.leaderboard.map((r) => r.name)).toEqual(["Ana", "Bea"]);
    expect(sum.reactions[0]).toEqual({ emoji: "👏", count: 2 });
    expect(JSON.stringify(sum)).not.toContain("secreto");
  });
});
