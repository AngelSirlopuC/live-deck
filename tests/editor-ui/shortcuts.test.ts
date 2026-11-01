// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isTypingTarget, shortcutFor } from "../../web/src/editor/ui/shortcuts.ts";

const key = (k: string, mods: Partial<{ meta: boolean; ctrl: boolean; shift: boolean; alt: boolean }> = {}) => ({
  key: k,
  metaKey: !!mods.meta,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
});

describe("shortcutFor", () => {
  it("maps the editor shortcuts on the canvas", () => {
    expect(shortcutFor(key("s", { meta: true }), { typing: false })).toBe("save");
    expect(shortcutFor(key("S", { ctrl: true }), { typing: false })).toBe("save");
    expect(shortcutFor(key("z", { meta: true }), { typing: false })).toBe("undo");
    expect(shortcutFor(key("z", { meta: true, shift: true }), { typing: false })).toBe("redo");
    expect(shortcutFor(key("k", { meta: true }), { typing: false })).toBe("commandMenu");
    expect(shortcutFor(key("d", { meta: true }), { typing: false })).toBe("duplicate");
    expect(shortcutFor(key("c", { meta: true }), { typing: false })).toBe("copy");
    expect(shortcutFor(key("v", { meta: true }), { typing: false })).toBe("paste");
    expect(shortcutFor(key("a", { meta: true }), { typing: false })).toBe("selectAll");
    expect(shortcutFor(key("Backspace"), { typing: false })).toBe("delete");
    expect(shortcutFor(key("Delete"), { typing: false })).toBe("delete");
    expect(shortcutFor(key("ArrowLeft"), { typing: false })).toBe("nudge");
    expect(shortcutFor(key("ArrowUp", { alt: true }), { typing: false })).toBe("slideUp");
    expect(shortcutFor(key("Escape"), { typing: false })).toBe("escape");
    expect(shortcutFor(key("q"), { typing: false })).toBeUndefined();
  });

  it("ignores editing keys while typing but keeps save, command menu and escape", () => {
    expect(shortcutFor(key("Backspace"), { typing: true })).toBeUndefined();
    expect(shortcutFor(key("z", { meta: true }), { typing: true })).toBeUndefined();
    expect(shortcutFor(key("a", { meta: true }), { typing: true })).toBeUndefined();
    expect(shortcutFor(key("ArrowLeft"), { typing: true })).toBeUndefined();
    expect(shortcutFor(key("s", { meta: true }), { typing: true })).toBe("save");
    expect(shortcutFor(key("k", { meta: true }), { typing: true })).toBe("commandMenu");
    expect(shortcutFor(key("Escape"), { typing: true })).toBe("escape");
  });

  it("only handles Escape while a dialog is open", () => {
    expect(shortcutFor(key("s", { meta: true }), { typing: false, dialogOpen: true })).toBeUndefined();
    expect(shortcutFor(key("Escape"), { typing: false, dialogOpen: true })).toBe("escape");
  });
});

describe("isTypingTarget", () => {
  it("recognizes inputs, textareas, selects and contenteditable, not buttons or checkboxes", () => {
    const input = document.createElement("input");
    const check = document.createElement("input");
    check.type = "checkbox";
    const color = document.createElement("input");
    color.type = "color";
    const area = document.createElement("textarea");
    const select = document.createElement("select");
    const button = document.createElement("button");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "plaintext-only");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(area)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(check)).toBe(false);
    expect(isTypingTarget(color)).toBe(false);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
  });
});
