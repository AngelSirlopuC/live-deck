import { describe, expect, it } from "vitest";
import { parseClipboard, pasteFromClipboard, serializeElements } from "../../web/src/editor/model/clipboard.ts";
import { deck, el, slide, slideAt, text } from "./fixtures.ts";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("clipboard", () => {
  it("serializes and parses elements through a tagged JSON string", () => {
    const items = [text("a", box(0.1, 0.1, 0.2, 0.2)), text("b", box(0.3, 0.3, 0.2, 0.2))];
    const s = serializeElements(items);
    expect(typeof s).toBe("string");
    expect(parseClipboard(s)).toEqual(items);
  });

  it("rejects foreign text", () => {
    expect(parseClipboard("hola")).toBeUndefined();
    expect(parseClipboard('{"foo":1}')).toBeUndefined();
    expect(parseClipboard('{"kind":"live-deck/elements","v":1,"elements":"x"}')).toBeUndefined();
  });

  it("pastes with fresh ids and an offset into the target slide", () => {
    const d = deck([slide("s", [text("a", box(0.1, 0.1, 0.2, 0.2))]), slide("t")]);
    const s = serializeElements([el(d, 0, "a")]);
    const same = pasteFromClipboard(d, 0, s);
    expect(slideAt(same, 0).elements.map((e) => e.id)).toEqual(["a", "a-2"]);
    expect(el(same, 0, "a-2").box).toEqual(box(0.12, 0.12, 0.2, 0.2));
    const other = pasteFromClipboard(d, 1, s);
    expect(slideAt(other, 1).elements.map((e) => e.id)).toEqual(["a"]);
    expect(pasteFromClipboard(d, 0, "nope")).toBe(d);
  });
});
