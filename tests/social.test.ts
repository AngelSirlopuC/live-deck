import { describe, expect, it } from "vitest";
import { REACTIONS } from "../shared/protocol.ts";
import { Chat, ReactionMeter } from "../server/session/social.ts";

describe("reactions", () => {
  it("offers a short, talk-oriented set", () => {
    expect(REACTIONS.length).toBeGreaterThanOrEqual(4);
    expect(REACTIONS.length).toBeLessThanOrEqual(8);
  });

  it("batches reactions per window and keeps session totals", () => {
    const m = new ReactionMeter();
    m.add(0);
    m.add(0);
    m.add(2);
    expect(m.flush()).toEqual([2, 0, 1, 0, 0, 0]);
    expect(m.flush()).toBeNull();
    m.add(5);
    m.flush();
    expect(m.totals()).toEqual([2, 0, 1, 0, 0, 1]);
  });

  it("ignores unknown reactions", () => {
    const m = new ReactionMeter();
    m.add(99);
    expect(m.flush()).toBeNull();
  });
});

describe("chat", () => {
  const sticker = { id: "abc", url: "https://media1.giphy.com/media/abc/200.webp", width: 200, height: 200, title: "wave" };

  it("is closed until the presenter opens it", () => {
    const c = new Chat();
    expect(c.post({ from: "u1", name: "Ana", text: "hola" }, 0)).toEqual({ ok: false, reason: "closed" });
    c.setMode("text");
    expect(c.post({ from: "u1", name: "Ana", text: "hola" }, 0)).toMatchObject({ ok: true, message: { name: "Ana", text: "hola" } });
  });

  it("enforces the mode: text only, stickers only, or mixed", () => {
    const c = new Chat();
    c.setMode("text");
    expect(c.post({ from: "u1", name: "Ana", sticker }, 0)).toEqual({ ok: false, reason: "mode" });
    c.setMode("sticker");
    expect(c.post({ from: "u1", name: "Ana", text: "hola" }, 0)).toEqual({ ok: false, reason: "mode" });
    expect(c.post({ from: "u1", name: "Ana", sticker }, 0).ok).toBe(true);
    c.setMode("mixed");
    expect(c.post({ from: "u1", name: "Ana", text: "y texto" }, 0).ok).toBe(true);
  });

  it("cleans text and rejects empty messages", () => {
    const c = new Chat();
    c.setMode("text");
    const r = c.post({ from: "u1", name: "Ana", text: "  hola\u0000  mundo  " }, 0);
    expect(r).toMatchObject({ ok: true, message: { text: "hola mundo" } });
    expect(c.post({ from: "u1", name: "Ana", text: "   " }, 0)).toEqual({ ok: false, reason: "empty" });
    expect(c.post({ from: "u1", name: "Ana", text: "x".repeat(500) }, 0)).toMatchObject({ ok: true, message: { text: "x".repeat(280) } });
  });

  it("rate limits each person", () => {
    const c = new Chat();
    c.setMode("text");
    expect(c.post({ from: "u1", name: "A", text: "1" }, 0).ok).toBe(true);
    expect(c.post({ from: "u1", name: "A", text: "2" }, 100).ok).toBe(true);
    expect(c.post({ from: "u1", name: "A", text: "3" }, 200).ok).toBe(true);
    expect(c.post({ from: "u1", name: "A", text: "4" }, 300)).toEqual({ ok: false, reason: "rate" });
    expect(c.post({ from: "u2", name: "B", text: "ok" }, 300).ok).toBe(true);
    expect(c.post({ from: "u1", name: "A", text: "5" }, 6_000).ok).toBe(true);
  });

  it("lets the presenter pause, mute and delete", () => {
    const c = new Chat();
    c.setMode("mixed");
    const first = c.post({ from: "u1", name: "A", text: "spam" }, 0);
    if (!first.ok) throw new Error("expected ok");
    c.mute("u1");
    expect(c.post({ from: "u1", name: "A", text: "more" }, 10_000)).toEqual({ ok: false, reason: "muted" });
    expect(c.delete(first.message.id)).toBe(true);
    expect(c.history()).toHaveLength(0);
    c.setPaused(true);
    expect(c.post({ from: "u2", name: "B", text: "hi" }, 0)).toEqual({ ok: false, reason: "paused" });
  });

  it("keeps a bounded history", () => {
    const c = new Chat(5);
    c.setMode("text");
    for (let i = 0; i < 8; i++) c.post({ from: `u${i}`, name: "N", text: String(i) }, 0);
    expect(c.history().map((m) => m.text)).toEqual(["3", "4", "5", "6", "7"]);
  });
});
