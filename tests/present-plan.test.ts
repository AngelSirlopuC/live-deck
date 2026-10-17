import { describe, expect, it } from "vitest";
import { planPresentation, type ScreenChoice } from "../web/src/ui/present-plan.ts";

const laptop: ScreenChoice = { id: "0", label: "Built-in", left: 0, top: 0, width: 1512, height: 982, availLeft: 0, availTop: 25, availWidth: 1512, availHeight: 957, isPrimary: true, isInternal: true };
const projector: ScreenChoice = { id: "1", label: "Proyector", left: 1512, top: 0, width: 1920, height: 1080, availLeft: 1512, availTop: 0, availWidth: 1920, availHeight: 1080, isPrimary: false, isInternal: false };

describe("presentation plan", () => {
  it("projects on another screen in a window covering it, keeping the console in this tab", () => {
    const plan = planPresentation({ presenterView: true, fullscreen: true, target: "1", mode: "tab" }, [laptop, projector], "0");
    expect(plan.projectorWindow).toEqual({ left: 1512, top: 0, width: 1920, height: 1080 });
    expect(plan.projectInTab).toBe(false);
    expect(plan.presenterWindow).toBeNull();
    expect(plan.screenLabel).toBe("Proyector");
  });

  it("projects in this tab on the current screen with floating controls", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: true, target: "0", mode: "tab" }, [laptop, projector], "0");
    expect(plan.projectInTab).toBe(true);
    expect(plan.fullscreen).toBe(true);
    expect(plan.projectorWindow).toBeNull();
    expect(plan.floatingControls).toBe(true);
  });

  it("opens the presenter view as a window when projecting on the only screen", () => {
    const plan = planPresentation({ presenterView: true, fullscreen: true, target: "0", mode: "tab" }, [laptop], "0");
    expect(plan.presenterWindow).toEqual({ left: 80, top: 105, width: 1280, height: 800 });
    expect(plan.floatingControls).toBe(false);
  });

  it("projects in this tab when screens are unknown", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: true, target: null, mode: "tab" }, [], null);
    expect(plan.projectInTab).toBe(true);
    expect(plan.fullscreen).toBe(true);
  });

  it("can skip fullscreen in this tab", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: false, target: "0", mode: "tab" }, [laptop], "0");
    expect(plan.fullscreen).toBe(false);
  });

  it("opens a projector window to drag when screens cannot be listed", () => {
    const plan = planPresentation({ presenterView: false, fullscreen: true, target: null, mode: "window" }, [], null);
    expect(plan.projectorWindow).toEqual({ left: 80, top: 80, width: 1280, height: 720 });
    expect(plan.projectInTab).toBe(false);
    expect(plan.screenLabel).toBe("una ventana aparte");
  });
});
