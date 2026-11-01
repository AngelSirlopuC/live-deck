import { describe, expect, it } from "vitest";
import { parseDeck } from "../../shared/deck.ts";
import { applyCommand, apply, createDoc, type Command } from "../../web/src/editor/model/document.ts";
import { deck, demoDeck, el, slide, slideAt, text } from "./fixtures.ts";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("slides", () => {
  it("addSlide inserts a blank slide at the index with a unique id", () => {
    const d = deck([slide("s1"), slide("s2")]);
    const next = applyCommand(d, { type: "addSlide", at: 1, kind: "blank" });
    expect(next.slides.map((s) => s.id)).toEqual(["s1", "slide-3", "s2"]);
    expect(slideAt(next, 1)).toEqual({ id: "slide-3", elements: [] });
    expect(d.slides).toHaveLength(2);
  });

  it("addSlide quiz and ask create valid defaults", () => {
    const quiz = slideAt(applyCommand(deck(), { type: "addSlide", at: 1, kind: "quiz" }), 1);
    expect(quiz.layout).toBe("quiz");
    expect(quiz.quiz?.options).toHaveLength(2);
    expect(quiz.quiz?.correctIndex).toBe(0);
    const ask = slideAt(applyCommand(deck(), { type: "addSlide", at: 1, kind: "ask" }), 1);
    expect(ask.layout).toBe("ask");
    expect(ask.ask?.question.trim().length).toBeGreaterThan(0);
  });

  it("addSlide clamps the index and refuses past 200 slides", () => {
    const d = deck();
    expect(slideAt(applyCommand(d, { type: "addSlide", at: 99, kind: "blank" }), 1).id).toBe("slide-2");
    const full = deck(Array.from({ length: 200 }, (_, i) => slide(`s${i}`)));
    expect(applyCommand(full, { type: "addSlide", at: 0, kind: "blank" })).toBe(full);
  });

  it("duplicateSlide copies after the source with a fresh slide id and the same element ids", () => {
    const d = deck([slide("intro", [text("a", box(0, 0, 0.5, 0.5))], { notes: "n" }), slide("s2")]);
    const next = applyCommand(d, { type: "duplicateSlide", index: 0 });
    expect(next.slides.map((s) => s.id)).toEqual(["intro", "intro-2", "s2"]);
    expect(slideAt(next, 1).elements[0]?.id).toBe("a");
    expect(slideAt(next, 1).notes).toBe("n");
    expect(slideAt(next, 1).elements).not.toBe(slideAt(next, 0).elements);
  });

  it("deleteSlide removes a slide but never the last one", () => {
    const d = deck([slide("s1"), slide("s2")]);
    expect(applyCommand(d, { type: "deleteSlide", index: 0 }).slides.map((s) => s.id)).toEqual(["s2"]);
    const one = deck();
    expect(applyCommand(one, { type: "deleteSlide", index: 0 })).toBe(one);
  });

  it("moveSlide reorders", () => {
    const d = deck([slide("a"), slide("b"), slide("c")]);
    expect(applyCommand(d, { type: "moveSlide", from: 0, to: 2 }).slides.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(applyCommand(d, { type: "moveSlide", from: 2, to: 0 }).slides.map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(applyCommand(d, { type: "moveSlide", from: 1, to: 1 })).toBe(d);
  });

  it("setSlide renames only to a valid unused id", () => {
    const d = deck([slide("a"), slide("b")]);
    expect(slideAt(applyCommand(d, { type: "setSlide", index: 0, patch: { id: "c" } }), 0).id).toBe("c");
    expect(applyCommand(d, { type: "setSlide", index: 0, patch: { id: "b" } })).toBe(d);
    expect(applyCommand(d, { type: "setSlide", index: 0, patch: { id: "bad id!" } })).toBe(d);
  });

  it("setSlide layout switch free -> quiz -> ask -> free creates and removes the right fields", () => {
    const d = deck();
    const quiz = applyCommand(d, { type: "setSlide", index: 0, patch: { layout: "quiz" } });
    expect(slideAt(quiz, 0).layout).toBe("quiz");
    expect(slideAt(quiz, 0).quiz).toBeDefined();
    expect(slideAt(quiz, 0).ask).toBeUndefined();
    const ask = applyCommand(quiz, { type: "setSlide", index: 0, patch: { layout: "ask" } });
    expect(slideAt(ask, 0).layout).toBe("ask");
    expect(slideAt(ask, 0).quiz).toBeUndefined();
    expect(slideAt(ask, 0).ask).toBeDefined();
    const free = applyCommand(ask, { type: "setSlide", index: 0, patch: { layout: "free" } });
    expect("quiz" in slideAt(free, 0)).toBe(false);
    expect("ask" in slideAt(free, 0)).toBe(false);
    expect(slideAt(free, 0).layout === undefined || slideAt(free, 0).layout === "free").toBe(true);
    expect(parseDeck(free).ok).toBe(true);
  });

  it("setSlide keeps an existing quiz when re-applying the quiz layout", () => {
    const d = applyCommand(deck(), { type: "setSlide", index: 0, patch: { layout: "quiz", quiz: { question: "Q?" } } });
    const again = applyCommand(d, { type: "setSlide", index: 0, patch: { layout: "quiz" } });
    expect(slideAt(again, 0).quiz?.question).toBe("Q?");
  });

  it("setSlide patches background, notes, quiz and ask; undefined removes", () => {
    const d = applyCommand(deck(), { type: "setSlide", index: 0, patch: { notes: "hola", background: "#123456" } });
    expect(slideAt(d, 0).notes).toBe("hola");
    expect(slideAt(d, 0).background).toBe("#123456");
    const cleared = applyCommand(d, { type: "setSlide", index: 0, patch: { notes: undefined, background: undefined } });
    expect("notes" in slideAt(cleared, 0)).toBe(false);
    expect("background" in slideAt(cleared, 0)).toBe(false);

    const quiz = applyCommand(deck(), { type: "setSlide", index: 0, patch: { layout: "quiz", quiz: { options: ["a", "b", "c"], correctIndex: 2, timerSec: 30 } } });
    expect(slideAt(quiz, 0).quiz?.options).toEqual(["a", "b", "c"]);
    expect(slideAt(quiz, 0).quiz?.correctIndex).toBe(2);
    const noTimer = applyCommand(quiz, { type: "setSlide", index: 0, patch: { quiz: { timerSec: undefined } } });
    expect("timerSec" in (slideAt(noTimer, 0).quiz ?? {})).toBe(false);
    expect(slideAt(noTimer, 0).quiz?.display).toBe("live");

    const ask = applyCommand(deck(), { type: "setSlide", index: 0, patch: { layout: "ask", ask: { question: "¿Qué?", maxChars: 20 } } });
    expect(slideAt(ask, 0).ask).toEqual({ question: "¿Qué?", maxChars: 20 });
    expect(parseDeck(ask).ok).toBe(true);
  });

  it("setSlide ignores a quiz patch on a free slide", () => {
    const d = deck();
    expect(applyCommand(d, { type: "setSlide", index: 0, patch: { quiz: { question: "x" } } })).toBe(d);
  });
});

describe("elements", () => {
  it("addElement gives sensible, centered defaults per kind with unique ids", () => {
    let d = deck();
    const kinds: Command[] = [
      { type: "addElement", slide: 0, element: { kind: "text" } },
      { type: "addElement", slide: 0, element: { kind: "text" } },
      { type: "addElement", slide: 0, element: { kind: "shape", shape: "ellipse" } },
      { type: "addElement", slide: 0, element: { kind: "shape", shape: "line" } },
      { type: "addElement", slide: 0, element: { kind: "image", src: "assets/a.png", alt: "A" } },
      { type: "addElement", slide: 0, element: { kind: "qr" } },
      { type: "addElement", slide: 0, element: { kind: "icon" } },
      { type: "addElement", slide: 0, element: { kind: "chart", chart: "donut" } },
      { type: "addElement", slide: 0, element: { kind: "decor" } },
    ];
    for (const c of kinds) d = applyCommand(d, c);
    const ids = slideAt(d, 0).elements.map((e) => e.id);
    expect(ids).toEqual(["text-1", "text-2", "shape-1", "shape-2", "image-1", "qr-1", "icon-1", "chart-1", "decor-1"]);
    for (const e of slideAt(d, 0).elements) {
      expect(e.box.x + e.box.w).toBeLessThanOrEqual(1);
      expect(e.box.y + e.box.h).toBeLessThanOrEqual(1);
      // Centered on the canvas.
      expect(e.box.x + e.box.w / 2).toBeCloseTo(0.5, 3);
    }
    expect(el(d, 0, "shape-2")).toMatchObject({ type: "shape", shape: "line" });
    expect(el(d, 0, "shape-2").box.h).toBe(0);
    expect(el(d, 0, "chart-1")).toMatchObject({ type: "chart", kind: "donut" });
    expect(parseDeck(d).ok).toBe(true);
  });

  it("addElement honours a given box, clamps it and refuses past 60 elements", () => {
    const d = applyCommand(deck(), { type: "addElement", slide: 0, element: { kind: "text", text: "Hi" }, box: box(0.9, 0.9, 0.5, 0.5) });
    expect(el(d, 0, "text-1").box).toEqual(box(0.5, 0.5, 0.5, 0.5));
    expect(el(d, 0, "text-1")).toMatchObject({ text: "Hi" });
    const full = deck([slide("s", Array.from({ length: 60 }, (_, i) => text(`t${i}`, box(0, 0, 0.1, 0.1))))]);
    expect(applyCommand(full, { type: "addElement", slide: 0, element: { kind: "text" } })).toBe(full);
  });

  it("duplicateElements offsets by 0.02, clamps and mints fresh ids", () => {
    const d = deck([slide("s", [text("a", box(0.1, 0.1, 0.2, 0.2)), text("b", box(0.79, 0.79, 0.21, 0.21))])]);
    const next = applyCommand(d, { type: "duplicateElements", slide: 0, ids: ["a", "b"] });
    expect(slideAt(next, 0).elements.map((e) => e.id)).toEqual(["a", "b", "a-2", "b-2"]);
    expect(el(next, 0, "a-2").box).toEqual(box(0.12, 0.12, 0.2, 0.2));
    expect(el(next, 0, "b-2").box).toEqual(box(0.79, 0.79, 0.21, 0.21));
  });

  it("deleteElements removes the given ids", () => {
    const d = deck([slide("s", [text("a", box(0, 0, 0.1, 0.1)), text("b", box(0, 0, 0.1, 0.1))])]);
    expect(slideAt(applyCommand(d, { type: "deleteElements", slide: 0, ids: ["a"] }), 0).elements.map((e) => e.id)).toEqual(["b"]);
    expect(applyCommand(d, { type: "deleteElements", slide: 0, ids: ["zzz"] })).toBe(d);
  });

  it("setBoxes updates many boxes with clamping, min size and 4-decimal rounding", () => {
    const d = deck([slide("s", [text("a", box(0, 0, 0.1, 0.1)), text("b", box(0, 0, 0.1, 0.1)), { id: "l", type: "shape", shape: "line", box: box(0, 0, 0.2, 0) }])]);
    const next = applyCommand(d, { type: "setBoxes", slide: 0, boxes: { a: box(-0.1, 0.5, 0.3, 0.6), b: box(0.1 + 0.2, 0.2, 0.001, 0.001), l: box(0.5, 0.5, 0.2, 0) } });
    expect(el(next, 0, "a").box).toEqual(box(0, 0.4, 0.3, 0.6));
    expect(el(next, 0, "b").box).toEqual(box(0.3, 0.2, 0.01, 0.01));
    expect(el(next, 0, "l").box).toEqual(box(0.5, 0.5, 0.2, 0));
  });

  it("patchElement shallow-merges, merges style, removes undefined keys and renames with uniqueness", () => {
    const d = deck([slide("s", [text("a", box(0, 0, 0.1, 0.1), { style: { fontSize: 40, color: "#ffffff" } }), text("b", box(0, 0, 0.1, 0.1))])]);
    const next = applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { text: "New", fragment: 2, style: { color: undefined, fontWeight: 700 } } });
    expect(el(next, 0, "a")).toEqual({ id: "a", type: "text", box: box(0, 0, 0.1, 0.1), text: "New", fragment: 2, style: { fontSize: 40, fontWeight: 700 } });
    const noFrag = applyCommand(next, { type: "patchElement", slide: 0, id: "a", patch: { fragment: undefined, style: { fontSize: undefined, fontWeight: undefined } } });
    expect("fragment" in el(noFrag, 0, "a")).toBe(false);
    expect("style" in el(noFrag, 0, "a")).toBe(false);
    expect(el(applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { id: "c" } }), 0, "c").type).toBe("text");
    expect(applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { id: "b" } })).toBe(d);
  });

  it("reorderZ: front, back, forward, backward keep relative order of the selection", () => {
    const d = deck([slide("s", ["a", "b", "c", "d"].map((id) => text(id, box(0, 0, 0.1, 0.1))))]);
    const order = (c: Command) => slideAt(applyCommand(d, c), 0).elements.map((e) => e.id);
    expect(order({ type: "reorderZ", slide: 0, ids: ["a", "b"], to: "front" })).toEqual(["c", "d", "a", "b"]);
    expect(order({ type: "reorderZ", slide: 0, ids: ["d", "c"], to: "back" })).toEqual(["c", "d", "a", "b"]);
    expect(order({ type: "reorderZ", slide: 0, ids: ["a"], to: "forward" })).toEqual(["b", "a", "c", "d"]);
    expect(order({ type: "reorderZ", slide: 0, ids: ["d"], to: "backward" })).toEqual(["a", "b", "d", "c"]);
    expect(order({ type: "reorderZ", slide: 0, ids: ["d"], to: "forward" })).toEqual(["a", "b", "c", "d"]);
    expect(order({ type: "reorderZ", slide: 0, ids: ["a"], to: "backward" })).toEqual(["a", "b", "c", "d"]);
  });

  it("align: a single element aligns to the slide, many align to the selection bounds", () => {
    const d = deck([slide("s", [text("a", box(0.1, 0.1, 0.2, 0.2)), text("b", box(0.5, 0.5, 0.4, 0.3))])]);
    expect(el(applyCommand(d, { type: "align", slide: 0, ids: ["a"], edge: "hcenter" }), 0, "a").box.x).toBe(0.4);
    expect(el(applyCommand(d, { type: "align", slide: 0, ids: ["a"], edge: "right" }), 0, "a").box.x).toBe(0.8);
    expect(el(applyCommand(d, { type: "align", slide: 0, ids: ["a"], edge: "bottom" }), 0, "a").box.y).toBe(0.8);
    expect(el(applyCommand(d, { type: "align", slide: 0, ids: ["a"], edge: "vcenter" }), 0, "a").box.y).toBe(0.4);
    const both = applyCommand(d, { type: "align", slide: 0, ids: ["a", "b"], edge: "left" });
    expect(el(both, 0, "a").box.x).toBe(0.1);
    expect(el(both, 0, "b").box.x).toBe(0.1);
    const top = applyCommand(d, { type: "align", slide: 0, ids: ["a", "b"], edge: "top" });
    expect(el(top, 0, "b").box.y).toBe(0.1);
    const hc = applyCommand(d, { type: "align", slide: 0, ids: ["a", "b"], edge: "hcenter" });
    // Selection spans x 0.1..0.9 → center 0.5.
    expect(el(hc, 0, "a").box.x).toBe(0.4);
    expect(el(hc, 0, "b").box.x).toBe(0.3);
  });

  it("distribute spaces three or more elements evenly between the outer ones", () => {
    const d = deck([slide("s", [text("a", box(0, 0, 0.1, 0.1)), text("b", box(0.2, 0, 0.1, 0.1)), text("c", box(0.8, 0, 0.1, 0.1))])]);
    const next = applyCommand(d, { type: "distribute", slide: 0, ids: ["a", "b", "c"], axis: "horizontal" });
    expect(el(next, 0, "b").box.x).toBe(0.4);
    expect(el(next, 0, "a").box.x).toBe(0);
    expect(el(next, 0, "c").box.x).toBe(0.8);
    expect(applyCommand(d, { type: "distribute", slide: 0, ids: ["a", "b"], axis: "vertical" })).toBe(d);
  });

  it("pasteElements appends with fresh ids and offset, up to the 60 limit", () => {
    const d = deck([slide("s", [text("a", box(0.1, 0.1, 0.2, 0.2))])]);
    const next = applyCommand(d, { type: "pasteElements", slide: 0, elements: [text("a", box(0.1, 0.1, 0.2, 0.2))], offset: 0.05 });
    expect(slideAt(next, 0).elements.map((e) => e.id)).toEqual(["a", "a-2"]);
    expect(el(next, 0, "a-2").box).toEqual(box(0.15, 0.15, 0.2, 0.2));
  });
});

describe("deck", () => {
  it("setTheme merges, removes undefined keys and drops an empty theme", () => {
    const d = applyCommand(deck(), { type: "setTheme", patch: { preset: "neon", muted: "#aaaaaa" } });
    expect(d.theme).toEqual({ background: "#000000", foreground: "#ffffff", accent: "#ff0000", preset: "neon", muted: "#aaaaaa" });
    const cleared = applyCommand(d, { type: "setTheme", patch: { background: undefined, foreground: undefined, accent: undefined, muted: undefined, preset: undefined } });
    expect("theme" in cleared).toBe(false);
  });

  it("setTitle", () => {
    expect(applyCommand(deck(), { type: "setTitle", title: "Nuevo" }).title).toBe("Nuevo");
  });

  it("EditorDoc.apply returns the same doc when nothing changed", () => {
    const doc = createDoc(deck());
    expect(apply(doc, { type: "deleteSlide", index: 0 })).toBe(doc);
    expect(apply(doc, { type: "setTitle", title: "X" }).deck.title).toBe("X");
  });

  it("a series of commands on the demo deck still passes the server-side parseDeck", () => {
    let d = demoDeck();
    const cmds: Command[] = [
      { type: "addSlide", at: 1, kind: "quiz" },
      { type: "addSlide", at: 2, kind: "ask" },
      { type: "duplicateSlide", index: 0 },
      { type: "moveSlide", from: 0, to: 3 },
      { type: "setSlide", index: 0, patch: { layout: "free", notes: "x", background: { gradient: { from: "#000000", to: "#ffffff" } } } },
      { type: "addElement", slide: 0, element: { kind: "text", text: "Hola" } },
      { type: "addElement", slide: 0, element: { kind: "icon" } },
      { type: "addElement", slide: 0, element: { kind: "chart", chart: "bar" } },
      { type: "addElement", slide: 0, element: { kind: "decor" } },
      { type: "addElement", slide: 0, element: { kind: "image", src: "assets/x.png", alt: "x" } },
      { type: "addElement", slide: 0, element: { kind: "qr" } },
      { type: "addElement", slide: 0, element: { kind: "shape", shape: "line" } },
      { type: "duplicateElements", slide: 0, ids: ["text-1", "icon-1"] },
      { type: "setBoxes", slide: 0, boxes: { "text-1": box(0.95, 0.95, 0.3, 0.3) } },
      { type: "patchElement", slide: 0, id: "text-1", patch: { style: { fontSize: 60, mark: true } } },
      { type: "reorderZ", slide: 0, ids: ["text-1"], to: "back" },
      { type: "align", slide: 0, ids: ["text-1", "icon-1"], edge: "hcenter" },
      { type: "distribute", slide: 0, ids: ["text-1", "icon-1", "chart-1"], axis: "vertical" },
      { type: "setTheme", patch: { preset: "papel" } },
      { type: "setTitle", title: "Demo editada" },
      { type: "deleteSlide", index: 5 },
    ];
    for (const c of cmds) d = applyCommand(d, c);
    const result = parseDeck(JSON.parse(JSON.stringify(d)));
    expect(result).toEqual({ ok: true, deck: expect.anything() });
  });
});

describe("equality guards", () => {
  it("patchElement with an unchanged value returns the same deck", () => {
    const d = deck([slide("s1", [text("a", box(0.1, 0.1, 0.2, 0.2), { style: { fontSize: 48 } })])]);
    expect(applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { text: "a" } })).toBe(d);
    expect(applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { style: { fontSize: 48 } } })).toBe(d);
    expect(applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { style: { color: undefined } } })).toBe(d);
    expect(applyCommand(d, { type: "patchElement", slide: 0, id: "a", patch: { text: "b" } })).not.toBe(d);
  });

  it("setSlide with unchanged notes, background, quiz or ask returns the same deck", () => {
    const d = deck([slide("s1", [], { notes: "hola", background: { color: "#000000", dim: 0.3 } })]);
    expect(applyCommand(d, { type: "setSlide", index: 0, patch: { notes: "hola" } })).toBe(d);
    expect(applyCommand(d, { type: "setSlide", index: 0, patch: { background: { color: "#000000", dim: 0.3 } } })).toBe(d);
    expect(applyCommand(d, { type: "setSlide", index: 0, patch: { notes: "" } })).not.toBe(d);
    const q = applyCommand(deck(), { type: "addSlide", at: 1, kind: "quiz" });
    const quiz = slideAt(q, 1).quiz!;
    expect(applyCommand(q, { type: "setSlide", index: 1, patch: { quiz: { question: quiz.question } } })).toBe(q);
    expect(applyCommand(q, { type: "setSlide", index: 1, patch: { quiz: { question: "Otra" } } })).not.toBe(q);
    const a = applyCommand(deck(), { type: "addSlide", at: 1, kind: "ask" });
    expect(applyCommand(a, { type: "setSlide", index: 1, patch: { ask: { question: slideAt(a, 1).ask!.question } } })).toBe(a);
  });

  it("setTheme with the same colours returns the same deck", () => {
    const d = deck();
    expect(applyCommand(d, { type: "setTheme", patch: { accent: "#ff0000" } })).toBe(d);
    expect(applyCommand(d, { type: "setTheme", patch: { muted: undefined } })).toBe(d);
    expect(applyCommand(d, { type: "setTheme", patch: { accent: "#00ff00" } })).not.toBe(d);
  });
});
