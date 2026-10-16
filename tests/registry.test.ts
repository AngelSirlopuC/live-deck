import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "../shared/deck.ts";
import { SESSION_CODE } from "../shared/protocol.ts";
import { ENDED_TTL_MS, IDLE_TTL_MS, SessionRegistry } from "../server/session/registry.ts";

const parsed = parseDeck(JSON.parse(readFileSync(new URL("../decks/demo/deck.json", import.meta.url), "utf8")));
if (!parsed.ok) throw new Error(parsed.error);
const deck = parsed.deck;

describe("session registry", () => {
  it("creates sessions with unambiguous codes and long presenter tokens", () => {
    const r = new SessionRegistry();
    const e = r.create("demo", deck, "1234", 0);
    expect(e.session.code).toMatch(SESSION_CODE);
    expect(e.token.length).toBeGreaterThanOrEqual(32);
    expect(e.pinHash).not.toContain("1234");
    expect(r.get(e.session.code)).toBe(e);
  });

  it("authenticates the presenter only with token and PIN, and locks after 5 failures", () => {
    const r = new SessionRegistry();
    const e = r.create("demo", deck, "4321", 0);
    expect(r.authenticatePresenter("nope".padEnd(32, "x"), "4321", 0)).toEqual({ ok: false, reason: "not-found" });
    for (let i = 0; i < 4; i++) expect(r.authenticatePresenter(e.token, "0000", 0)).toEqual({ ok: false, reason: "unauthorized" });
    expect(r.authenticatePresenter(e.token, "0000", 0)).toEqual({ ok: false, reason: "locked" });
    expect(r.authenticatePresenter(e.token, "4321", 1000)).toEqual({ ok: false, reason: "locked" });
    expect(r.authenticatePresenter(e.token, "4321", 5 * 60 * 1000 + 1).ok).toBe(true);
  });

  it("collects ended sessions after their grace period and idle sessions after 12 hours", () => {
    const r = new SessionRegistry();
    const ended = r.create("demo", deck, "1111", 0);
    ended.session.end();
    r.markEnded(ended, 0);
    const idle = r.create("demo", deck, "2222", 0);
    const busy = r.create("demo", deck, "3333", 0);
    busy.session.audienceConnected(busy.session.join({ name: "A" }).id);

    expect(r.tick(ENDED_TTL_MS - 1).removed).toHaveLength(0);
    expect(r.tick(ENDED_TTL_MS).removed).toEqual([ended]);
    expect(r.tick(IDLE_TTL_MS).removed).toEqual([idle]);
    expect(r.get(busy.session.code)).toBe(busy);
  });

  it("reports sessions that became abandoned on tick", () => {
    const r = new SessionRegistry();
    const e = r.create("demo", deck, "1111", 0);
    expect(r.tick(15 * 60 * 1000).changed).toEqual([e]);
  });
});
