// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createTabs } from "../web/src/ui/tabs.ts";

function setup() {
  const panels = { control: document.createElement("div"), chat: document.createElement("div"), settings: document.createElement("div") };
  const tabs = createTabs("Remote", [
    { id: "control", label: "Control", panel: panels.control },
    { id: "chat", label: "Chat", panel: panels.chat },
    { id: "settings", label: "Ajustes", panel: panels.settings },
  ]);
  document.body.replaceChildren(tabs.list, ...Object.values(panels));
  const tab = (id: string) => tabs.list.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`)!;
  return { tabs, panels, tab };
}

describe("tabs", () => {
  it("shows the first panel and switches on click, wiring ARIA", () => {
    const { panels, tab } = setup();
    expect(panels.control.hidden).toBe(false);
    expect(panels.chat.hidden).toBe(true);
    tab("chat").click();
    expect(panels.chat.hidden).toBe(false);
    expect(panels.control.hidden).toBe(true);
    expect(tab("chat").getAttribute("aria-selected")).toBe("true");
    expect(panels.chat.getAttribute("aria-labelledby")).toBe(tab("chat").id);
  });

  it("marks unseen activity on a hidden tab and clears it when opened", () => {
    const { tabs, tab } = setup();
    tabs.notify("chat");
    expect(tab("chat").dataset.unread).toBe("true");
    tabs.notify("control"); // visible tab: nothing to flag
    expect(tab("control").dataset.unread).toBeUndefined();
    tab("chat").click();
    expect(tab("chat").dataset.unread).toBeUndefined();
  });

  it("moves between tabs with the arrow keys", () => {
    const { tab } = setup();
    tab("control").focus();
    tab("control").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(tab("chat").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("chat"));
  });
});
