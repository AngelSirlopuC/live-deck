import { describe, expect, it } from "vitest";
import { rankOptions } from "../shared/ranking.ts";
import { pressTool } from "../web/src/ui/effect-tools.ts";

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
    expect(pressTool("zoom", "zoom", "focus")).toEqual({ tool: "ripple", clear: false });
  });

  it("switching tools keeps the current effect", () => {
    expect(pressTool("focus", "zoom", "focus")).toEqual({ tool: "zoom", clear: false });
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
