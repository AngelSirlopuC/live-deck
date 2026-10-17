import { describe, expect, it } from "vitest";
import { rankOptions } from "../shared/ranking.ts";
import { pressTool, toolStates } from "../web/src/ui/effect-tools.ts";

describe("effect tool keys", () => {
  it("selects a tool on first press", () => {
    expect(pressTool("ripple", "focus", null)).toEqual({ tool: "focus", clear: false });
  });

  it("removes the active effect when its tool is pressed again", () => {
    expect(pressTool("focus", "focus", "focus")).toEqual({ tool: "ripple", clear: true });
    expect(pressTool("zoom", "zoom", "zoom")).toEqual({ tool: "ripple", clear: true });
  });

  it("deselects a tool pressed again when no effect of that kind is active", () => {
    expect(pressTool("focus", "focus", null)).toEqual({ tool: "ripple", clear: false });
  });

  // Focus and zoom exclude each other (2026-10-17): the other one is disabled.
  it("does not switch to the excluded tool while an effect is on screen", () => {
    expect(pressTool("focus", "zoom", "focus")).toEqual({ tool: "focus", clear: false });
  });
});

describe("quiz ranking", () => {
  it("orders options by votes and shares ranks on ties", () => {
    expect(rankOptions([1, 5, 3, 5])).toEqual([
      { index: 1, count: 5, rank: 1 },
      { index: 3, count: 5, rank: 1 },
      { index: 2, count: 3, rank: 3 },
      { index: 0, count: 1, rank: 4 },
    ]);
  });

  it("has no leader while nobody voted", () => {
    expect(rankOptions([0, 0]).every((r) => r.rank === 1)).toBe(true);
  });
});

describe("effect tools working together", () => {
  it("removes an on-screen effect when its tool is pressed, even after the pointer took over", () => {
    expect(pressTool("ripple", "focus", "focus")).toEqual({ tool: "ripple", clear: true });
  });

  it("ignores the other persistent tool while an effect is on screen", () => {
    expect(pressTool("ripple", "zoom", "focus")).toEqual({ tool: "ripple", clear: false });
  });

  it("dims the other persistent tool and keeps the pointer available", () => {
    const st = toolStates("ripple", "focus");
    expect(st.ripple).toEqual({ pressed: true, active: false, disabled: false });
    expect(st.focus).toEqual({ pressed: false, active: true, disabled: false });
    expect(st.zoom).toEqual({ pressed: false, active: false, disabled: true });
  });

  it("dims the other persistent tool while one is selected but not yet applied", () => {
    const st = toolStates("zoom", null);
    expect(st.zoom.pressed).toBe(true);
    expect(st.focus.disabled).toBe(true);
    expect(st.ripple.disabled).toBe(false);
  });
});
