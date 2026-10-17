// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createPaceTimer } from "../web/src/ui/pace-timer.ts";

const min = 60_000;

describe("presenter pace timer", () => {
  it("shows elapsed over the limit in green, yellow, then red with the overrun", () => {
    const t = createPaceTimer();
    t.update(0, 30, 10 * min);
    expect(t.el.dataset.pace).toBe("ok");
    expect(t.el.textContent).toBe("10:00 / 30:00");
    t.update(0, 30, 26 * min);
    expect(t.el.dataset.pace).toBe("near");
    t.update(0, 30, 32 * min + 13_000);
    expect(t.el.dataset.pace).toBe("over");
    expect(t.el.textContent).toBe("+02:13 / 30:00");
    expect(t.el.getAttribute("aria-label")).toMatch(/pasaste por 02:13/);
  });

  it("is a plain stopwatch without a limit, and shows the limit before the start", () => {
    const t = createPaceTimer();
    t.update(0, null, 5 * min);
    expect(t.el.dataset.pace).toBe("");
    expect(t.el.textContent).toBe("05:00");
    t.update(null, 20, 5 * min);
    expect(t.el.textContent).toBe("00:00 / 20:00");
    expect(t.el.dataset.pace).toBe("ok");
  });
});
