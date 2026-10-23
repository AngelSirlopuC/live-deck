import { describe, expect, it } from "vitest";
import { ID_RE, isValidId, sanitizeId, uniqueId } from "../../web/src/editor/model/ids.ts";

describe("ids", () => {
  it("validates against the deck id regex", () => {
    expect(ID_RE.source).toBe("^[A-Za-z0-9_-]{1,40}$");
    expect(isValidId("text-2")).toBe(true);
    expect(isValidId("")).toBe(false);
    expect(isValidId("a b")).toBe(false);
    expect(isValidId("x".repeat(41))).toBe(false);
  });

  it("sanitizes arbitrary text into a valid id", () => {
    expect(sanitizeId("Mi título!")).toBe("Mi-t-tulo");
    expect(sanitizeId("")).toBe("item");
    expect(sanitizeId("x".repeat(50))).toHaveLength(40);
  });

  it("uniqueId returns the base when free, otherwise the first free numbered suffix", () => {
    expect(uniqueId("text", [])).toBe("text");
    expect(uniqueId("text", ["text"])).toBe("text-2");
    expect(uniqueId("text", ["text", "text-2", "text-3"])).toBe("text-4");
    expect(uniqueId("text-2", ["text-2"])).toBe("text-3");
    expect(uniqueId("x".repeat(40), ["x".repeat(40)])).toMatch(ID_RE);
  });

  it("uniqueId with numbered=true always appends a counter (text-1, text-2)", () => {
    expect(uniqueId("text", [], { numbered: true })).toBe("text-1");
    expect(uniqueId("text", ["text-1"], { numbered: true })).toBe("text-2");
  });
});
