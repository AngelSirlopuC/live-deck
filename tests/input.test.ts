// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { bindDeckKeys } from "../web/src/ui/input.ts";

function press(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("deck keys", () => {
  it("navigates with arrows even when a button has focus", () => {
    const nav = { next: vi.fn(), prev: vi.fn() };
    const dispose = bindDeckKeys(window, nav);
    const button = document.body.appendChild(document.createElement("button"));
    press(button, "ArrowRight");
    press(button, "ArrowLeft");
    expect(nav.next).toHaveBeenCalledTimes(1);
    expect(nav.prev).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("leaves Enter and Space to the focused button", () => {
    const nav = { next: vi.fn(), prev: vi.fn() };
    const dispose = bindDeckKeys(window, nav);
    const button = document.body.appendChild(document.createElement("button"));
    press(button, "Enter");
    press(button, " ");
    expect(nav.next).not.toHaveBeenCalled();
    dispose();
  });

  it("ignores typing in text fields", () => {
    const nav = { next: vi.fn(), prev: vi.fn() };
    const dispose = bindDeckKeys(window, nav);
    const input = document.body.appendChild(document.createElement("input"));
    press(input, "ArrowRight");
    press(input, "Backspace");
    expect(nav.next).not.toHaveBeenCalled();
    expect(nav.prev).not.toHaveBeenCalled();
    dispose();
  });
});

describe("swipe", () => {
  function swipe(el: HTMLElement, from: [number, number], to: [number, number]) {
    // jsdom has no PointerEvent: a MouseEvent with pointerType is enough for the handler.
    const ev = (type: string, [x, y]: [number, number]) => Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerType: "touch" });
    el.dispatchEvent(ev("pointerdown", from));
    el.dispatchEvent(ev("pointerup", to));
  }

  it("maps a vertical swipe to slide navigation when the slide is rotated", async () => {
    const { bindSwipe } = await import("../web/src/ui/input.ts");
    const el = document.body.appendChild(document.createElement("div"));
    const nav = { next: vi.fn(), prev: vi.fn() };
    let rotated = false;
    bindSwipe(el, nav, 40, () => rotated);
    swipe(el, [200, 100], [100, 100]); // left: next
    expect(nav.next).toHaveBeenCalledTimes(1);
    rotated = true;
    swipe(el, [100, 300], [100, 150]); // up on screen = left on the rotated slide
    expect(nav.next).toHaveBeenCalledTimes(2);
    swipe(el, [100, 150], [100, 300]); // down = previous
    expect(nav.prev).toHaveBeenCalledTimes(1);
  });
});
