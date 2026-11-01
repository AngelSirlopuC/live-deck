import { describe, expect, it } from "vitest";
import { History } from "../../web/src/editor/model/history.ts";
import { applyCommand } from "../../web/src/editor/model/document.ts";
import { deck } from "./fixtures.ts";

const titled = (title: string) => applyCommand(deck(), { type: "setTitle", title });

describe("history", () => {
  it("undo and redo walk the snapshots; canUndo/canRedo follow", () => {
    const h = new History(deck());
    expect(h.canUndo).toBe(false);
    h.push(titled("a"));
    h.push(titled("b"));
    expect(h.present.title).toBe("b");
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.title).toBe("a");
    expect(h.canRedo).toBe(true);
    expect(h.undo()?.title).toBe("Test");
    expect(h.undo()).toBeUndefined();
    expect(h.redo()?.title).toBe("a");
    h.push(titled("c"));
    expect(h.canRedo).toBe(false);
    expect(h.present.title).toBe("c");
  });

  it("ignores a push of the same deck reference", () => {
    const h = new History(deck());
    h.push(h.present);
    expect(h.canUndo).toBe(false);
  });

  it("coalesces consecutive pushes with the same key into one undo step until the key changes or seal()", () => {
    const h = new History(deck());
    h.push(titled("d1"), "drag:a");
    h.push(titled("d2"), "drag:a");
    h.push(titled("d3"), "drag:a");
    expect(h.present.title).toBe("d3");
    expect(h.undo()?.title).toBe("Test");
    h.redo();
    h.push(titled("e1"), "drag:b");
    h.seal();
    h.push(titled("e2"), "drag:b");
    expect(h.undo()?.title).toBe("e1");
    expect(h.undo()?.title).toBe("d3");
  });

  it("caps the number of undo steps", () => {
    const h = new History(deck(), 3);
    for (let i = 0; i < 10; i++) h.push(titled(`t${i}`));
    let steps = 0;
    while (h.undo()) steps++;
    expect(steps).toBe(3);
    expect(h.present.title).toBe("t6");
  });

  it("tracks dirty state against the saved baseline, including undo back to it", () => {
    const h = new History(deck());
    expect(h.isDirty).toBe(false);
    h.push(titled("a"));
    expect(h.isDirty).toBe(true);
    h.markSaved();
    expect(h.isDirty).toBe(false);
    h.push(titled("b"));
    expect(h.isDirty).toBe(true);
    h.undo();
    expect(h.isDirty).toBe(false);
    h.undo();
    expect(h.isDirty).toBe(true);
    h.push(titled("c"));
    h.redo();
    expect(h.isDirty).toBe(true);
  });

  it("reset replaces everything (e.g. after a reload) and marks it saved", () => {
    const h = new History(deck());
    h.push(titled("a"));
    h.reset(titled("remote"));
    expect(h.present.title).toBe("remote");
    expect(h.canUndo).toBe(false);
    expect(h.isDirty).toBe(false);
  });
});
