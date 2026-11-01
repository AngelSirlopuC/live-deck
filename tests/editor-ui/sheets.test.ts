// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ICON_NAMES } from "../../shared/icons.ts";
import { assetSheet, describeIssuePath, iconSheet } from "../../web/src/editor/ui/sheets.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("pickers", () => {
  it("icon sheet lists every curated icon, filters by name and returns the pick", () => {
    let picked = "";
    iconSheet((n) => (picked = n), "rocket");
    expect(document.querySelectorAll(".ed-icon-opt")).toHaveLength(ICON_NAMES.length);
    expect(document.querySelector('.ed-icon-opt[aria-selected="true"]')?.getAttribute("aria-label")).toBe("rocket");
    const search = document.querySelector<HTMLInputElement>("#ed-icon-search")!;
    search.value = "heart";
    search.dispatchEvent(new Event("input"));
    const options = [...document.querySelectorAll<HTMLButtonElement>(".ed-icon-opt")];
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => o.title.includes("heart"))).toBe(true);
    options[0]!.click();
    expect(picked).toBe(options[0]!.title);
    expect(document.querySelector("dialog.ed-sheet")).toBeNull();
  });

  it("asset sheet shows the deck's images, picks one, and shows upload errors in Spanish", async () => {
    let picked = "";
    assetSheet({
      assets: [{ name: "foto.png", size: 10 }, { name: "logo.webp", size: 20 }],
      assetBase: "/decks/x/",
      onPick: (src) => (picked = src),
      onUpload: async () => ({ ok: false, message: "Solo se aceptan imágenes PNG, JPEG, WebP o GIF." }),
    });
    const assets = document.querySelectorAll<HTMLButtonElement>(".ed-asset");
    expect(assets).toHaveLength(2);
    expect(assets[1]!.querySelector("img")?.getAttribute("src")).toBe("/decks/x/assets/logo.webp");
    const file = document.querySelector<HTMLInputElement>("#ed-asset-file")!;
    Object.defineProperty(file, "files", { value: [new File([new Uint8Array([1, 2])], "x.svg", { type: "image/svg+xml" })] });
    file.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(".form-error")?.textContent).toBe("Solo se aceptan imágenes PNG, JPEG, WebP o GIF.");
    assets[0]!.click();
    expect(picked).toBe("assets/foto.png");
  });

  it("describes validation paths as slide and element positions", () => {
    expect(describeIssuePath("slides.2.elements.0.box")).toEqual({ label: "Diapositiva 3 · elemento 1", slide: 2, elementIndex: 0 });
    expect(describeIssuePath("slides.0.quiz.question")).toEqual({ label: "Diapositiva 1", slide: 0, elementIndex: undefined });
    expect(describeIssuePath("theme.accent").label).toBe("Diseño");
    expect(describeIssuePath("title").label).toBe("Título");
  });
});
