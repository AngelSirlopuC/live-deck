// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createCommandMenu, filterCommands, fuzzyScore } from "../../web/src/editor/ui/command-menu.ts";

const items = [
  { id: "save", label: "Guardar", group: "Deck", run: () => {} },
  { id: "go-3", label: "Ir a la diapositiva 3", group: "Ir a", keywords: "agenda", run: () => {} },
  { id: "preset", label: "Preset: neón", group: "Diseño", run: () => {} },
  { id: "text", label: "Texto", group: "Insertar", run: () => {} },
];

describe("filterCommands", () => {
  it("matches substrings first, then subsequences, ignoring accents", () => {
    expect(filterCommands("", items).map((i) => i.id)).toEqual(["save", "go-3", "preset", "text"]);
    expect(filterCommands("neon", items).map((i) => i.id)).toEqual(["preset"]);
    expect(filterCommands("agenda", items).map((i) => i.id)).toEqual(["go-3"]);
    expect(filterCommands("dia 3", items).map((i) => i.id)).toEqual(["go-3"]);
    expect(filterCommands("grd", items)[0]?.id).toBe("save");
    expect(filterCommands("zzz", items)).toEqual([]);
    expect(fuzzyScore("gua", "Guardar")).toBe(0);
  });

  it("opens, filters with the keyboard and runs the active item", () => {
    let ran = "";
    const menu = createCommandMenu(() => items.map((i) => ({ ...i, run: () => (ran = i.id) })));
    const { input } = menu.open();
    expect(menu.isOpen).toBe(true);
    input.value = "tex";
    input.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll(".ed-cmd-item")).toHaveLength(1);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    expect(ran).toBe("text");
    expect(menu.isOpen).toBe(false);
  });
});
