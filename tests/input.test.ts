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
