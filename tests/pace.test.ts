import { describe, expect, it } from "vitest";
import { formatClock, paceOf, warnWindowMs } from "../shared/pace.ts";

const min = 60_000;

describe("time limit pace", () => {
  it("is green on time, yellow in the last stretch, red once the limit is passed", () => {
    expect(paceOf(0, 30 * min)).toBe("ok");
    expect(paceOf(23 * min, 30 * min)).toBe("ok");
    expect(paceOf(25 * min, 30 * min)).toBe("near");
    expect(paceOf(30 * min - 1, 30 * min)).toBe("near");
    expect(paceOf(30 * min, 30 * min)).toBe("over");
    expect(paceOf(45 * min, 30 * min)).toBe("over");
  });

  it("has no pace without a limit", () => {
    expect(paceOf(10 * min, null)).toBeNull();
  });

  it("warns in the last 20% of the limit, between 1 and 5 minutes", () => {
    expect(warnWindowMs(10 * min)).toBe(2 * min);
    expect(warnWindowMs(3 * min)).toBe(1 * min);
    expect(warnWindowMs(60 * min)).toBe(5 * min);
  });

  it("formats clocks with hours only when needed", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(133_000)).toBe("02:13");
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });
});
