import { describe, expect, it } from "vitest";
import { planPresentation, type ScreenChoice } from "../web/src/ui/present-plan.ts";

const laptop: ScreenChoice = { id: "0", label: "Built-in", left: 0, top: 0, width: 1512, height: 982, availLeft: 0, availTop: 25, availWidth: 1512, availHeight: 957, isPrimary: true, isInternal: true };
const projector: ScreenChoice = { id: "1", label: "Proyector", left: 1512, top: 0, width: 1920, height: 1080, availLeft: 1512, availTop: 0, availWidth: 1920, availHeight: 1080, isPrimary: false, isInternal: false };

describe("presentation plan", () => {
  it("projects on the chosen screen and puts the presenter view on another one", () => {
    const plan = planPresentation({ presenterView: true, fullscreen: true, target: "1", mode: "tab" }, [laptop, projector], "0");
    expect(plan.fullscreenScreen).toBe("1");
    expect(plan.presenterWindow).toEqual({ left: 0, top: 25, width: 1512, height: 957 });
    expect(plan.floatingControls).toBe(false);
  });

  it("keeps floating controls when there is no presenter view", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: true, target: "0", mode: "tab" }, [laptop], "0");
    expect(plan.fullscreenScreen).toBe("0");
    expect(plan.presenterWindow).toBeNull();
    expect(plan.floatingControls).toBe(true);
  });

  it("does not ask for a specific screen when only the current one is known", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: true, target: null, mode: "tab" }, [], null);
    expect(plan.fullscreenScreen).toBeNull();
    expect(plan.fullscreen).toBe(true);
  });

  it("opens the presenter view as a normal window on a single screen", () => {
    const plan = planPresentation({ presenterView: true, fullscreen: true, target: "0", mode: "tab" }, [laptop], "0");
    expect(plan.presenterWindow).toEqual({ left: 80, top: 105, width: 1280, height: 800 });
  });

  it("can skip fullscreen and still project in the tab", () => {
    const plan = planPresentation({ presenterView: true, fullscreen: false, target: "1", mode: "tab" }, [laptop, projector], "0");
    expect(plan.fullscreen).toBe(false);
    expect(plan.fullscreenScreen).toBeNull();
  });

  it("opens a separate projector window instead of projecting in the tab", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: true, target: "1", mode: "window" }, [laptop, projector], "0");
    expect(plan.projectorWindow).toEqual({ left: 1512, top: 0, width: 1920, height: 1080 });
    expect(plan.fullscreen).toBe(false);
    expect(plan.presenterWindow).toBeNull();
  });
});
