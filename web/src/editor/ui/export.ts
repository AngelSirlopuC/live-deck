// Print-to-PDF export: every slide rendered at full size with all fragments
// visible, one 16:9 page each, through the browser's print dialog. The print
// root lives in the same document so the stage styles and preset fonts apply.
import type { Deck } from "../../../../shared/deck.ts";
import { slideSteps } from "../../../../shared/deck-core.ts";
import { renderSlide } from "../../render/slide.ts";
import { h } from "../../ui/dom.ts";

/** Builds the print pages; exported so the structure is testable without printing. */
export function buildPrintRoot(deck: Deck, assetBase: string): HTMLElement {
  const root = h("div", { class: "ed-print", "aria-hidden": "true" });
  deck.slides.forEach((slide, i) => {
    const page = h("div", { class: "ed-print-page" });
    page.append(renderSlide(deck, i, { step: slideSteps(slide), assetBase }));
    root.append(page);
  });
  return root;
}

export function exportPdf(deck: Deck, assetBase: string, win: Window = window): void {
  const root = buildPrintRoot(deck, assetBase);
  const doc = win.document;
  doc.body.append(root);
  doc.documentElement.classList.add("ed-printing");
  const cleanup = () => {
    root.remove();
    doc.documentElement.classList.remove("ed-printing");
    win.removeEventListener("afterprint", cleanup);
  };
  win.addEventListener("afterprint", cleanup);
  // Give fonts and images a frame to settle before the dialog snapshots the page.
  const go = () => {
    try {
      win.print();
    } finally {
      // afterprint does the real cleanup; this backstop covers engines that never fire it
      // and is long enough not to tear the pages down under an open print preview.
      setTimeout(cleanup, 60_000);
    }
  };
  if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(() => win.requestAnimationFrame(go));
  else go();
}
