import { describe, expect, it } from "vitest";
import { changeSlide, clearSelection, emptySelection, isSelected, pruneSelection, selectAll, selectOnly, toggleId } from "../../web/src/editor/model/selection.ts";

describe("selection", () => {
  it("selectOnly and isSelected", () => {
    const s = selectOnly(emptySelection(0), "a");
    expect(s).toEqual({ slide: 0, ids: ["a"] });
    expect(isSelected(s, "a")).toBe(true);
    expect(isSelected(s, "b")).toBe(false);
  });

  it("toggleId adds when missing and removes when present (shift-click)", () => {
    const s = toggleId(toggleId(emptySelection(0), "a"), "b");
    expect(s.ids).toEqual(["a", "b"]);
    expect(toggleId(s, "a").ids).toEqual(["b"]);
  });

  it("selectAll takes every id of the slide; clearSelection keeps the slide", () => {
    const s = selectAll(emptySelection(2), ["x", "y"]);
    expect(s).toEqual({ slide: 2, ids: ["x", "y"] });
    expect(clearSelection(s)).toEqual({ slide: 2, ids: [] });
  });

  it("changeSlide clears the ids only when the slide changes", () => {
    const s = selectOnly(emptySelection(0), "a");
    expect(changeSlide(s, 0)).toBe(s);
    expect(changeSlide(s, 1)).toEqual({ slide: 1, ids: [] });
  });

  it("pruneSelection drops ids that no longer exist", () => {
    const s = selectAll(emptySelection(0), ["a", "b", "c"]);
    expect(pruneSelection(s, ["a", "c"]).ids).toEqual(["a", "c"]);
    expect(pruneSelection(s, ["a", "b", "c"])).toBe(s);
  });
});
