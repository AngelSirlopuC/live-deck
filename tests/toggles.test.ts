import { describe, expect, it } from "vitest";
import { rankOptions } from "../shared/ranking.ts";
import { canClearEffects, pressTool, toolStates } from "../web/src/ui/effect-tools.ts";

describe("effect tool keys", () => {
  it("arms a tool on first press", () => {
    expect(pressTool("ripple", "focus", [])).toEqual({ tool: "focus", clear: null });
  });

  it("disarms the armed tool on a second press and removes its effect", () => {
    expect(pressTool("focus", "focus", ["focus"])).toEqual({ tool: "ripple", clear: "focus" });
    expect(pressTool("zoom", "zoom", ["zoom", "focus"])).toEqual({ tool: "ripple", clear: "zoom" });
  });

  it("disarms without clearing when that tool has nothing on screen", () => {
    expect(pressTool("focus", "focus", [])).toEqual({ tool: "ripple", clear: null });
  });

  // Focus and zoom combine (2026-10-16): arming one never touches the other.
  it("arms zoom while a focus is on screen, keeping the focus", () => {
    expect(pressTool("focus", "zoom", ["focus"])).toEqual({ tool: "zoom", clear: null });
  });

  it("re-arms a tool whose effect is on screen so another region can be drawn", () => {
    expect(pressTool("ripple", "zoom", ["zoom"])).toEqual({ tool: "zoom", clear: null });
  });

  it("arms the laser and puts it down on a second press, leaving effects alone", () => {
    expect(pressTool("ripple", "laser", ["zoom"])).toEqual({ tool: "laser", clear: null });
    expect(pressTool("laser", "laser", ["zoom"])).toEqual({ tool: "ripple", clear: null });
  });

  it("goes back to the pointer without clearing anything", () => {
    expect(pressTool("zoom", "ripple", ["zoom"])).toEqual({ tool: "ripple", clear: null });
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
  it("keeps every tool available while live, marking what is armed and what is on screen", () => {
    const st = toolStates("zoom", ["focus"], true);
    expect(st.zoom).toEqual({ pressed: true, active: false, disabled: false });
    expect(st.focus).toEqual({ pressed: false, active: true, disabled: false });
    expect(st.ripple).toEqual({ pressed: false, active: false, disabled: false });
  });

  it("disables every tool before the session is live", () => {
    const st = toolStates("ripple", [], false);
    expect(Object.values(st).every((t) => t.disabled)).toBe(true);
  });
});

describe("clear effects key", () => {
  it("is available while an effect is on screen or a tool is armed, only when live", () => {
    expect(canClearEffects("ripple", [], true)).toBe(false);
    expect(canClearEffects("zoom", [], true)).toBe(true);
    expect(canClearEffects("ripple", ["focus"], true)).toBe(true);
    expect(canClearEffects("zoom", ["zoom"], false)).toBe(false);
  });
});
