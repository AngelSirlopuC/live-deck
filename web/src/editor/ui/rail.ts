// Slide rail and overview grid: numbered thumbnails, add/duplicate/delete,
// drag-and-drop and keyboard reorder. Both views share one list renderer.
import { h, trusted } from "../../ui/dom.ts";
import type { SlideKind } from "../model/index.ts";
import type { EditorController, EditorState } from "./controller.ts";
import { iconKey } from "./fields.ts";
import { edIcon } from "./icons.ts";
import { openMenu } from "./menu.ts";
import { confirmSheet } from "./sheets.ts";
import { applyThumbScale, observeThumbScale, type ThumbCache } from "./thumbs.ts";

const LAYOUT_LABEL: Record<string, string> = { quiz: "Quiz", ask: "Pregunta" };

export const ADD_SLIDE_ITEMS: Array<{ kind: SlideKind; label: string; icon: "slides" | "quiz" | "ask" }> = [
  { kind: "blank", label: "En blanco", icon: "slides" },
  { kind: "quiz", label: "Quiz", icon: "quiz" },
  { kind: "ask", label: "Pregunta abierta", icon: "ask" },
];

export function openAddSlideMenu(ctrl: EditorController, anchor: HTMLElement) {
  openMenu(
    ADD_SLIDE_ITEMS.map((item) => ({ label: item.label, icon: item.icon, onSelect: () => ctrl.addSlide(item.kind) })),
    anchor,
    { label: "Añadir diapositiva" },
  );
}

export async function deleteSlideWithConfirm(ctrl: EditorController, index = ctrl.state.selection.slide) {
  const slide = ctrl.deck.slides[index];
  if (!slide || ctrl.deck.slides.length <= 1) return;
  const ok = await confirmSheet({
    title: `¿Borrar la diapositiva ${index + 1}?`,
    message: slide.elements.length ? `Se borran sus ${slide.elements.length} elementos. Puedes deshacer con ⌘Z.` : "Puedes deshacer con ⌘Z.",
    confirmLabel: "Borrar",
    danger: true,
  });
  if (ok) ctrl.deleteSlide(index);
}

interface SlideListOptions {
  variant: "rail" | "grid";
  onPick: (index: number) => void;
}

/** Builds the `<ol>` of slides; drag-and-drop reorders through the controller. */
function renderSlideList(ctrl: EditorController, state: EditorState, thumbs: ThumbCache, o: SlideListOptions): HTMLOListElement {
  const deck = state.deck!;
  const current = state.selection.slide;
  const list = h("ol", { class: `ed-slides ed-slides-${o.variant}`, role: "listbox", "aria-label": "Diapositivas" });
  let dragFrom: number | null = null;
  deck.slides.forEach((slide, i) => {
    const layout = slide.layout && slide.layout !== "free" ? LAYOUT_LABEL[slide.layout] : undefined;
    const btn = h(
      "button",
      { type: "button", class: "ed-slide-btn", role: "option", "aria-selected": String(i === current), "aria-label": `Diapositiva ${i + 1}${layout ? `, ${layout.toLowerCase()}` : ""}: ${slide.id}`, tabindex: i === current ? "0" : "-1" },
      h("span", { class: "ed-slide-no", "aria-hidden": "true" }, String(i + 1)),
      thumbs.get(deck, i),
      layout ? h("span", { class: "ed-slide-badge", "aria-hidden": "true" }, layout) : null,
    );
    btn.addEventListener("click", () => o.onPick(i));
    btn.addEventListener("keydown", (e) => {
      if (e.altKey) return;
      const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      let target: number | undefined;
      if (delta) target = i + delta;
      else if (e.key === "Home") target = 0;
      else if (e.key === "End") target = deck.slides.length - 1;
      if (target === undefined || target < 0 || target >= deck.slides.length) return;
      e.preventDefault();
      ctrl.selectSlide(target);
      requestAnimationFrame(() => list.querySelector<HTMLElement>(`[data-index="${target}"] .ed-slide-btn`)?.focus());
    });
    const li = h("li", { class: "ed-slide", role: "presentation", "data-index": String(i), draggable: "true" }, btn);
    li.addEventListener("dragstart", (e) => {
      dragFrom = i;
      li.classList.add("is-dragging");
      e.dataTransfer?.setData("text/plain", `slide:${i}`);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => {
      dragFrom = null;
      li.classList.remove("is-dragging");
      list.querySelectorAll(".is-drop-target").forEach((n) => n.classList.remove("is-drop-target"));
    });
    li.addEventListener("dragover", (e) => {
      if (dragFrom === null) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      li.classList.add("is-drop-target");
    });
    li.addEventListener("dragleave", () => li.classList.remove("is-drop-target"));
    li.addEventListener("drop", (e) => {
      if (dragFrom === null) return;
      e.preventDefault();
      const from = dragFrom;
      dragFrom = null;
      if (from !== i) ctrl.moveSlide(from, i);
    });
    list.append(li);
  });
  return list;
}

export function createRail(ctrl: EditorController, thumbs: ThumbCache) {
  const count = h("span", { class: "ed-rail-count", "aria-live": "polite" });
  const addBtn = trusted("button", { type: "button", class: "key ed-key ed-rail-add", "aria-haspopup": "menu", "aria-expanded": "false" }, `${edIcon("plus")}<span>Añadir</span>`);
  addBtn.addEventListener("click", () => openAddSlideMenu(ctrl, addBtn));
  const overviewBtn = iconKey("grid", "Vista general (G)", () => ctrl.setOverview(!ctrl.state.overview), { "aria-pressed": "false" });
  const dupBtn = iconKey("duplicate", "Duplicar diapositiva", () => ctrl.duplicateSlide());
  const delBtn = iconKey("trash", "Borrar diapositiva", () => void deleteSlideWithConfirm(ctrl));
  delBtn.classList.add("key-danger");
  const listHost = h("div", { class: "ed-rail-list" });
  const el = h(
    "aside",
    { class: "ed-rail", "aria-label": "Diapositivas" },
    h("div", { class: "ed-rail-head" }, h("span", { class: "legend" }, "Diapositivas"), count, h("span", { class: "spacer" }), overviewBtn),
    listHost,
    h("div", { class: "ed-rail-foot" }, addBtn, dupBtn, delBtn),
  );
  let lastDeck: EditorState["deck"] = null;
  let lastSlide = -1;
  observeThumbScale(listHost, ".ed-thumb-stage");
  return {
    el,
    render(state: EditorState) {
      if (!state.deck) return;
      overviewBtn.setAttribute("aria-pressed", String(state.overview));
      delBtn.disabled = state.deck.slides.length <= 1;
      count.textContent = String(state.deck.slides.length);
      if (state.deck === lastDeck && state.selection.slide === lastSlide) return;
      lastDeck = state.deck;
      lastSlide = state.selection.slide;
      const hadFocus = listHost.contains(document.activeElement);
      listHost.replaceChildren(renderSlideList(ctrl, state, thumbs, { variant: "rail", onPick: (i) => ctrl.selectSlide(i) }));
      applyThumbScale(listHost, ".ed-thumb-stage");
      const currentBtn = listHost.querySelector<HTMLElement>(`[data-index="${state.selection.slide}"] .ed-slide-btn`);
      if (hadFocus) currentBtn?.focus();
      currentBtn?.scrollIntoView?.({ block: "nearest" });
    },
  };
}

export function createOverview(ctrl: EditorController, thumbs: ThumbCache) {
  const grid = h("div", { class: "ed-overview-grid" });
  const closeBtn = iconKey("close", "Cerrar vista general", () => ctrl.setOverview(false));
  const el = h(
    "section",
    { class: "ed-overview", "aria-label": "Vista general" },
    h("div", { class: "ed-overview-head" }, h("div", {}, h("h2", { class: "legend" }, "Vista general"), h("p", { class: "ed-overview-hint" }, "Toca una diapositiva para abrirla; arrastra para reordenar.")), closeBtn),
    grid,
  );
  let lastDeck: EditorState["deck"] = null;
  let lastSlide = -1;
  observeThumbScale(grid, ".ed-thumb-stage");
  return {
    el,
    render(state: EditorState) {
      el.hidden = !state.overview;
      if (!state.overview || !state.deck) return;
      if (state.deck === lastDeck && state.selection.slide === lastSlide) return;
      lastDeck = state.deck;
      lastSlide = state.selection.slide;
      grid.replaceChildren(
        renderSlideList(ctrl, state, thumbs, {
          variant: "grid",
          onPick: (i) => {
            ctrl.selectSlide(i);
            ctrl.setOverview(false);
          },
        }),
      );
      applyThumbScale(grid, ".ed-thumb-stage");
    },
  };
}
