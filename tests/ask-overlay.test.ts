// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ASK_OVERLAY_MAX, applyAskView } from "../web/src/render/ask-overlay.ts";
import type { AskView } from "../shared/ask.ts";

const view = (over: Partial<AskView> = {}): AskView => ({ id: "a1", question: "¿Una palabra?", maxChars: 20, status: "open", entries: [], total: 0, ...over });

function stage() {
  const s = document.createElement("div");
  s.className = "stage";
  document.body.replaceChildren(s);
  return s;
}

describe("free-text overlay on the slide", () => {
  it("shows the question and the answers in order with a ×N badge only on repeats", () => {
    const s = stage();
    applyAskView(s, view({ total: 4, entries: [{ text: "Rojo", count: 3 }, { text: "azul", count: 1 }] }));
    const box = s.querySelector(".stage-ask")!;
    expect(box.querySelector(".stage-ask-question")!.textContent).toBe("¿Una palabra?");
    const items = [...box.querySelectorAll(".stage-ask-entry")];
    expect(items.map((i) => i.querySelector(".stage-ask-text")!.textContent)).toEqual(["Rojo", "azul"]);
    expect(items[0]!.querySelector(".stage-ask-count")!.textContent).toBe("×3");
    expect(items[1]!.querySelector(".stage-ask-count")).toBeNull();
    expect(box.textContent).toContain("4 respuestas");
  });

  it("treats answers as plain text", () => {
    const s = stage();
    applyAskView(s, view({ total: 1, entries: [{ text: "<img src=x onerror=alert(1)>", count: 1 }] }));
    expect(s.querySelector("img")).toBeNull();
    expect(s.querySelector(".stage-ask-text")!.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("says when it is waiting, closed, and how many more did not fit", () => {
    const s = stage();
    applyAskView(s, view());
    expect(s.textContent).toContain("Responde desde tu teléfono");
    const many = Array.from({ length: ASK_OVERLAY_MAX + 5 }, (_, i) => ({ text: `w${i}`, count: 1 }));
    applyAskView(s, view({ status: "closed", total: many.length, entries: many }));
    expect(s.querySelectorAll(".stage-ask-entry")).toHaveLength(ASK_OVERLAY_MAX);
    expect(s.textContent).toContain("+5 más");
    expect(s.textContent).toContain("Cerrada");
  });

  it("removes itself when there is no question", () => {
    const s = stage();
    applyAskView(s, view());
    applyAskView(s, null);
    expect(s.querySelector(".stage-ask")).toBeNull();
  });
});
