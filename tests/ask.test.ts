import { describe, expect, it } from "vitest";
import { AskBook } from "../server/session/ask.ts";
import { ASK_TEXT_DEFAULT, ASK_TEXT_MAX, ASK_TEXT_MIN, groupAnswers } from "../shared/ask.ts";

describe("free-text grouping", () => {
  it("groups repeats ignoring case, accents and spaces, most repeated first, ties A to Z", () => {
    const entries = groupAnswers(["Rojo", "verde", "rojo ", "azul", "  ROJO", "Verde", "árbol"]);
    expect(entries).toEqual([
      { text: "Rojo", count: 3 },
      { text: "verde", count: 2 },
      { text: "árbol", count: 1 },
      { text: "azul", count: 1 },
    ]);
  });

  it("shows the most common spelling of a group", () => {
    expect(groupAnswers(["cafe", "café", "café"])).toEqual([{ text: "café", count: 3 }]);
  });

  it("keeps the limits the presenter can choose from", () => {
    expect(ASK_TEXT_MIN).toBe(10);
    expect(ASK_TEXT_DEFAULT).toBe(40);
    expect(ASK_TEXT_MAX).toBe(100);
  });
});

describe("free-text question lifecycle", () => {
  it("accepts one editable answer per participant while open", () => {
    const b = new AskBook();
    b.open("¿Qué color?", 20);
    expect(b.answer("u1", "rojo")).toBe("ok");
    expect(b.answer("u1", "azul")).toBe("ok");
    expect(b.answer("u2", "Azul")).toBe("ok");
    const v = b.view()!;
    expect(v.question).toBe("¿Qué color?");
    expect(v.status).toBe("open");
    expect(v.total).toBe(2);
    expect(v.entries).toEqual([{ text: "azul", count: 2 }]);
    expect(b.mine("u1")).toBe("azul");
  });

  it("cleans answers and cuts them at the chosen limit", () => {
    const b = new AskBook();
    b.open("Q", 10);
    expect(b.answer("u1", "  muy\u0000  largo de verdad  ")).toBe("ok");
    expect(b.mine("u1")).toBe("muy largo");
    expect(b.answer("u2", "   ")).toBe("empty");
  });

  it("clamps the limit and cleans the question", () => {
    const b = new AskBook();
    b.open("  Hola\n  mundo ", 500);
    expect(b.view()!.maxChars).toBe(ASK_TEXT_MAX);
    expect(b.view()!.question).toBe("Hola mundo");
    b.open("Q", 1);
    expect(b.view()!.maxChars).toBe(ASK_TEXT_MIN);
    expect(b.open("   ", 20)).toBe(false);
  });

  it("stops answers when closed but keeps showing them; clear removes it from screen", () => {
    const b = new AskBook();
    expect(b.answer("u1", "x")).toBe("closed");
    b.open("Q", 20);
    b.answer("u1", "uno");
    b.close();
    expect(b.answer("u2", "dos")).toBe("closed");
    expect(b.view()!.status).toBe("closed");
    expect(b.view()!.entries).toEqual([{ text: "uno", count: 1 }]);
    b.clear();
    expect(b.view()).toBeNull();
    expect(b.mine("u1")).toBeNull();
  });

  it("replaces the active question and keeps every question for the summary", () => {
    const b = new AskBook();
    b.open("Primera", 20);
    b.answer("u1", "a");
    b.open("Segunda", 30);
    expect(b.view()!.question).toBe("Segunda");
    expect(b.view()!.total).toBe(0);
    expect(b.mine("u1")).toBeNull();
    b.answer("u1", "b");
    expect(b.results()).toEqual([
      { question: "Primera", maxChars: 20, entries: [{ text: "a", count: 1 }], total: 1 },
      { question: "Segunda", maxChars: 30, entries: [{ text: "b", count: 1 }], total: 1 },
    ]);
  });
});
