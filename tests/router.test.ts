import { describe, expect, it } from "vitest";
import { matchRoute } from "../web/src/router.ts";

describe("router", () => {
  const token = "a".repeat(32);
  it("maps presenter surfaces and audience codes", () => {
    expect(matchRoute(`/p/${token}`)).toEqual({ page: "presenter", token, surface: "console" });
    expect(matchRoute(`/p/${token}/screen`)).toEqual({ page: "presenter", token, surface: "screen" });
    expect(matchRoute(`/p/${token}/remote/`)).toEqual({ page: "presenter", token, surface: "remote" });
    expect(matchRoute("/s/abc234")).toEqual({ page: "audience", code: "ABC234" });
  });
  it("maps the editor and keeps the preview route", () => {
    expect(matchRoute("/edit/mi-deck")).toEqual({ page: "editor", deckId: "mi-deck" });
    expect(matchRoute("/edit/mi-deck/")).toEqual({ page: "editor", deckId: "mi-deck" });
    expect(matchRoute("/edit/Bad_Id").page).toBe("not-found");
    expect(matchRoute("/preview/demo")).toEqual({ page: "preview", deckId: "demo" });
  });
  it("rejects short tokens and unknown paths", () => {
    expect(matchRoute("/p/short").page).toBe("not-found");
    expect(matchRoute("/nope").page).toBe("not-found");
  });
});
