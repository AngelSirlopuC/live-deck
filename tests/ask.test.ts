import { describe, expect, it } from "vitest";
import { AskBook, type AskDef } from "../server/session/ask.ts";
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

  it("keeps the limits a deck can choose from", () => {
    expect(ASK_TEXT_MIN).toBe(10);
    expect(ASK_TEXT_DEFAULT).toBe(40);
    expect(ASK_TEXT_MAX).toBe(100);
  });
});

const DEFS: Record<string, AskDef> = {
  color: { question: "¿Qué color?", maxChars: 20 },
  corta: { question: "Q", maxChars: 10 },
  libre: { question: "¿Y ahora?" },
};
const book = () => new AskBook((id) => DEFS[id] ?? null);

describe("open-question slides", () => {
  it("opens the first time the presenter reaches the slide, and only for ask slides", () => {
    const b = book();
    expect(b.answer("u1", "color", "rojo")).toBe("closed");
    expect(b.view("color")).toBeNull();
    b.arrive("portada");
    b.arrive("color");
    expect(b.views()).toEqual({ color: { slideId: "color", question: "¿Qué color?", maxChars: 20, status: "open", entries: [], total: 0 } });
  });

  it("accepts one editable answer per participant and slide while open", () => {
    const b = book();
    b.arrive("color");
    expect(b.answer("u1", "color", "rojo")).toBe("ok");
    expect(b.answer("u1", "color", "azul")).toBe("ok");
    expect(b.answer("u2", "color", "Azul")).toBe("ok");
    const v = b.view("color")!;
    expect(v.total).toBe(2);
    expect(v.entries).toEqual([{ text: "azul", count: 2 }]);
    expect(b.myAnswers("u1")).toEqual({ color: "azul" });
  });

  it("cleans answers and cuts them at the slide's limit, default 40", () => {
    const b = book();
    b.arrive("corta");
    b.arrive("libre");
    expect(b.view("libre")!.maxChars).toBe(ASK_TEXT_DEFAULT);
    expect(b.answer("u1", "corta", "  muy\u0000  largo de verdad  ")).toBe("ok");
    expect(b.myAnswers("u1")).toEqual({ corta: "muy largo" });
    expect(b.answer("u2", "corta", "   ")).toBe("empty");
    expect(b.answer("u2", "libre", "x".repeat(60))).toBe("ok");
    expect(b.myAnswers("u2").libre).toHaveLength(ASK_TEXT_DEFAULT);
  });

  it("stops answers when closed, keeps them, and does not reopen on return", () => {
    const b = book();
    b.arrive("color");
    b.answer("u1", "color", "uno");
    b.close("color");
    expect(b.answer("u2", "color", "dos")).toBe("closed");
    b.arrive("color");
    expect(b.view("color")).toMatchObject({ status: "closed", entries: [{ text: "uno", count: 1 }] });
  });

  it("keeps each slide's answers apart and lists them for the summary in the order they opened", () => {
    const b = book();
    b.arrive("libre");
    b.arrive("color");
    b.answer("u1", "color", "a");
    b.answer("u1", "libre", "b");
    expect(b.myAnswers("u1")).toEqual({ color: "a", libre: "b" });
    expect(b.results()).toEqual([
      { question: "¿Y ahora?", maxChars: 40, entries: [{ text: "b", count: 1 }], total: 1 },
      { question: "¿Qué color?", maxChars: 20, entries: [{ text: "a", count: 1 }], total: 1 },
    ]);
  });
});
