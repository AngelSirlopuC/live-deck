// The canvas: the real slide renderer scaled into a recessed well, with an
// interaction overlay on top. The overlay never touches the renderer's DOM:
// selection outlines, handles, guides, marquee and fragment badges are its
// own children positioned in percentages of the stage, so they stay crisp at
// any scale. Pointer geometry goes through the model (snapMove, resizeBox).
import type { Box, Deck, DeckElement, Slide } from "../../../../shared/deck.ts";
import { slideSteps } from "../../../../shared/deck-core.ts";
import { fitStage, renderSlide } from "../../render/slide.ts";
import { h } from "../../ui/dom.ts";
import { moveBox, resizeBox, snapEdge, snapMove, unionBox, type Guide, type Handle } from "../model/index.ts";
import type { EditorController, EditorState } from "./controller.ts";

/** Snap distance in slide units (≈15 px on the 1920 stage). */
export const SNAP_THRESHOLD = 0.008;
/** Pointer travel (px) before a press becomes a drag or marquee. */
export const DRAG_THRESHOLD = 3;
/** Vertical tolerance for grabbing a 0-high line. */
const LINE_HIT = 0.012;

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const isLine = (el: DeckElement) => el.type === "shape" && el.shape === "line";
const clampFor = (el: DeckElement) => (isLine(el) ? { minH: 0 } : {});

/** Topmost element under a normalized point, or undefined. Quiz/ask overlays are not elements. */
export function hitElement(slide: Pick<Slide, "elements">, pt: { x: number; y: number }): DeckElement | undefined {
  for (let i = slide.elements.length - 1; i >= 0; i--) {
    const el = slide.elements[i]!;
    const b = el.box;
    const pad = isLine(el) ? LINE_HIT : 0;
    if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y - pad && pt.y <= b.y + b.h + pad) return el;
  }
  return undefined;
}

/** Elements whose box intersects the marquee rectangle. */
export function elementsInRect(slide: Pick<Slide, "elements">, rect: Box): string[] {
  return slide.elements
    .filter((el) => {
      const b = el.box;
      const h = Math.max(b.h, isLine(el) ? LINE_HIT : 0);
      return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + h > rect.y;
    })
    .map((el) => el.id);
}

/** Normalizes a box with negative width/height (marquee drawn up/left). */
export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export interface CanvasOptions {
  assetBase: string;
  onContextMenu: (at: { x: number; y: number }) => void;
  onDropFiles: (files: File[], at: { x: number; y: number }) => void;
}

type Gesture =
  | { kind: "none" }
  | { kind: "pending"; mode: "move" | "marquee"; start: { x: number; y: number }; client: { x: number; y: number } }
  | { kind: "move"; start: { x: number; y: number }; boxes: Record<string, Box>; others: Box[] }
  | { kind: "marquee"; start: { x: number; y: number }; additive: string[] }
  | { kind: "resize"; id: string; handle: Handle; start: Box; begin: { x: number; y: number }; others: Box[] };

export function createCanvas(ctrl: EditorController, opts: CanvasOptions) {
  const overlay = h("div", { class: "ed-overlay", tabindex: "0", "aria-label": "Lienzo de la diapositiva. Usa las flechas para mover la selección." });
  const editLayer = h("div", { class: "ed-edit-layer" });
  // The host is the well: the stage, the edit mirror and the overlay all read its --stage-scale.
  const host = h("div", { class: "stage-host ed-stage-host" }, editLayer, overlay);
  const well = h("div", { class: "ed-canvas-well" }, host);
  const el = h("div", { class: "ed-canvas" }, well);

  let stage: HTMLElement | null = null;
  let disposeFit: (() => void) | null = null;
  let renderedSlide: Slide | null = null;
  let renderedDeck: Deck | null = null;
  let renderedIndex = -1;
  let gesture: Gesture = { kind: "none" };
  let editing: { id: string; node: HTMLElement; original: string; target: HTMLElement | null } | null = null;

  // --- geometry -------------------------------------------------------------

  const toSlidePoint = (clientX: number, clientY: number) => {
    const r = overlay.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
  const placeBox = (node: HTMLElement, b: Box) => {
    node.style.left = pct(b.x);
    node.style.top = pct(b.y);
    node.style.width = pct(b.w);
    node.style.height = pct(b.h);
  };

  // --- stage ----------------------------------------------------------------

  const renderStage = (deck: Deck, index: number) => {
    disposeFit?.();
    stage?.remove();
    stage = renderSlide(deck, index, { step: slideSteps(deck.slides[index]!), assetBase: opts.assetBase });
    host.insertBefore(stage, editLayer);
    disposeFit = fitStage(host, stage);
    renderedDeck = deck;
    renderedSlide = deck.slides[index]!;
    renderedIndex = index;
  };

  // --- overlay painting ----------------------------------------------------

  const guidesLayer = h("div", { class: "ed-guides", "aria-hidden": "true" });
  const selectionLayer = h("div", { class: "ed-selection", "aria-hidden": "true" });
  const badgesLayer = h("div", { class: "ed-badges", "aria-hidden": "true" });
  const marquee = h("div", { class: "ed-marquee", hidden: true, "aria-hidden": "true" });
  overlay.append(badgesLayer, selectionLayer, guidesLayer, marquee);

  const paintGuides = (guides: readonly Guide[]) => {
    guidesLayer.replaceChildren(
      ...guides.map((g) => {
        const line = h("div", { class: `ed-guide ed-guide-${g.axis}` });
        if (g.axis === "x") line.style.left = pct(g.at);
        else line.style.top = pct(g.at);
        return line;
      }),
    );
  };

  const paintSelection = (slide: Slide, ids: readonly string[]) => {
    const selected = slide.elements.filter((e) => ids.includes(e.id));
    const nodes: HTMLElement[] = [];
    for (const e of selected) {
      const box = h("div", { class: "ed-sel", "data-id": e.id });
      placeBox(box, e.box);
      if (selected.length === 1) {
        const handles = isLine(e) ? (["e", "w"] as Handle[]) : HANDLES;
        for (const hd of handles) box.append(h("div", { class: `ed-handle ed-handle-${hd}`, "data-handle": hd }));
      }
      nodes.push(box);
    }
    if (selected.length > 1) {
      const u = unionBox(selected.map((e) => e.box))!;
      const union = h("div", { class: "ed-sel-union" });
      placeBox(union, u);
      nodes.push(union);
    }
    selectionLayer.replaceChildren(...nodes);
    badgesLayer.replaceChildren(
      ...slide.elements
        .filter((e) => e.fragment !== undefined)
        .map((e) => {
          // Read-only: the step was chosen by the AI and has no control in the editor.
          const b = h("span", { class: "ed-frag", title: `La IA decidió que aparezca en el paso ${e.fragment}` }, String(e.fragment));
          b.style.left = pct(e.box.x);
          b.style.top = pct(e.box.y);
          return b;
        }),
    );
  };

  // --- inline text editing -------------------------------------------------

  const COPIED_STYLES = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "color", "textAlign", "letterSpacing", "textTransform", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "justifyContent"] as const;

  function startInlineEdit(id: string) {
    const slide = renderedSlide;
    const target = slide?.elements.find((e) => e.id === id);
    if (!slide || !target || target.type !== "text") return;
    stopInlineEdit(false);
    const node = h("div", { class: "ed-inline", contenteditable: "plaintext-only", role: "textbox", "aria-multiline": "true", "aria-label": "Editar texto" });
    node.style.left = `${target.box.x * 1920}px`;
    node.style.top = `${target.box.y * 1080}px`;
    node.style.width = `${target.box.w * 1920}px`;
    node.style.height = `${target.box.h * 1080}px`;
    // Element ids are [A-Za-z0-9_-], safe inside an attribute selector.
    const rendered = stage?.querySelector<HTMLElement>(`[data-element-id="${id}"]`) ?? null;
    // Only the text is hidden while editing; a card, background or mark keeps its box under the editor.
    const hidden = rendered?.querySelector<HTMLElement>(".el-text-inner") ?? rendered;
    if (rendered) {
      const cs = getComputedStyle(rendered);
      for (const prop of COPIED_STYLES) node.style[prop] = cs[prop];
    }
    if (hidden) hidden.style.visibility = "hidden";
    node.textContent = target.text;
    editLayer.append(node);
    editing = { id, node, original: target.text, target: hidden };
    node.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        stopInlineEdit(false);
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        stopInlineEdit(true);
      }
    });
    node.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      document.execCommand?.("insertText", false, text);
    });
    node.addEventListener("blur", () => stopInlineEdit(true));
    node.focus();
    const sel = window.getSelection?.();
    if (sel && node.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /** Ends inline editing; `commit` writes the text back through the controller. */
  function stopInlineEdit(commit: boolean) {
    const cur = editing;
    if (!cur) return;
    editing = null;
    const text = (cur.node.innerText ?? cur.node.textContent ?? "").replace(/\r\n?/g, "\n").replace(/\n$/, "");
    cur.node.remove();
    if (cur.target) cur.target.style.visibility = "";
    if (commit && text !== cur.original) ctrl.patchElement(cur.id, { text });
    overlay.focus({ preventScroll: true });
  }

  // --- pointer gestures ----------------------------------------------------

  const othersOf = (slide: Slide, ids: readonly string[]) => slide.elements.filter((e) => !ids.includes(e.id)).map((e) => e.box);

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !renderedSlide) return;
    if (editing) {
      stopInlineEdit(true);
      return;
    }
    overlay.setPointerCapture?.(e.pointerId);
    const pt = toSlidePoint(e.clientX, e.clientY);
    const handle = (e.target as HTMLElement).dataset?.handle as Handle | undefined;
    const sel = ctrl.state.selection;
    if (handle && sel.ids.length === 1) {
      const target = renderedSlide.elements.find((x) => x.id === sel.ids[0]);
      if (target) {
        gesture = { kind: "resize", id: target.id, handle, start: target.box, begin: pt, others: othersOf(renderedSlide, [target.id]) };
        e.preventDefault();
        return;
      }
    }
    const hit = hitElement(renderedSlide, pt);
    if (hit) {
      if (e.shiftKey) {
        ctrl.toggle(hit.id);
        if (!ctrl.state.selection.ids.includes(hit.id)) {
          gesture = { kind: "none" };
          return;
        }
      } else if (!sel.ids.includes(hit.id)) {
        ctrl.selectOne(hit.id);
      }
      gesture = { kind: "pending", mode: "move", start: pt, client: { x: e.clientX, y: e.clientY } };
    } else {
      if (!e.shiftKey) ctrl.clearSelection();
      gesture = { kind: "pending", mode: "marquee", start: pt, client: { x: e.clientX, y: e.clientY } };
    }
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (gesture.kind === "none" || !renderedSlide) return;
    const pt = toSlidePoint(e.clientX, e.clientY);
    if (gesture.kind === "pending") {
      if (Math.hypot(e.clientX - gesture.client.x, e.clientY - gesture.client.y) < DRAG_THRESHOLD) return;
      const start = gesture.start;
      if (gesture.mode === "move") {
        const ids = ctrl.state.selection.ids;
        const boxes: Record<string, Box> = {};
        for (const el of renderedSlide.elements) if (ids.includes(el.id)) boxes[el.id] = el.box;
        gesture = { kind: "move", start, boxes, others: othersOf(renderedSlide, ids) };
      } else {
        gesture = { kind: "marquee", start, additive: e.shiftKey ? [...ctrl.state.selection.ids] : [] };
        marquee.hidden = false;
      }
    }
    if (gesture.kind === "move") {
      const startBoxes = Object.values(gesture.boxes);
      const union = unionBox(startBoxes);
      if (!union) return;
      let dx = pt.x - gesture.start.x;
      let dy = pt.y - gesture.start.y;
      let guides: Guide[] = [];
      if (!e.altKey) {
        const snapped = snapMove(union, gesture.others, dx, dy, SNAP_THRESHOLD);
        dx = snapped.dx;
        dy = snapped.dy;
        guides = snapped.guides;
      }
      const next: Record<string, Box> = {};
      for (const [id, box] of Object.entries(gesture.boxes)) {
        const el = renderedSlide.elements.find((x) => x.id === id)!;
        next[id] = moveBox(box, dx, dy, clampFor(el));
      }
      ctrl.setBoxes(next, `drag:${Object.keys(gesture.boxes).join(",")}`);
      paintGuides(guides);
      return;
    }
    if (gesture.kind === "resize") {
      const resizing = gesture;
      const el = renderedSlide.elements.find((x) => x.id === resizing.id);
      if (!el) return;
      let dx = pt.x - gesture.begin.x;
      let dy = pt.y - gesture.begin.y;
      const guides: Guide[] = [];
      const { handle, start } = resizing;
      if (!e.altKey) {
        if (handle.includes("e")) {
          const s = snapEdge(start.x + start.w + dx, "x", resizing.others, SNAP_THRESHOLD);
          dx = s.value - (start.x + start.w);
          if (s.guide) guides.push(s.guide);
        } else if (handle.includes("w")) {
          const s = snapEdge(start.x + dx, "x", resizing.others, SNAP_THRESHOLD);
          dx = s.value - start.x;
          if (s.guide) guides.push(s.guide);
        }
        if (handle.includes("s")) {
          const s = snapEdge(start.y + start.h + dy, "y", resizing.others, SNAP_THRESHOLD);
          dy = s.value - (start.y + start.h);
          if (s.guide) guides.push(s.guide);
        } else if (handle.includes("n")) {
          const s = snapEdge(start.y + dy, "y", resizing.others, SNAP_THRESHOLD);
          dy = s.value - start.y;
          if (s.guide) guides.push(s.guide);
        }
      }
      const box = resizeBox(start, handle, dx, dy, { aspect: e.shiftKey && !isLine(el), ...clampFor(el) });
      ctrl.setBoxes({ [el.id]: box }, `resize:${el.id}`);
      paintGuides(guides);
      return;
    }
    if (gesture.kind === "marquee") {
      placeBox(marquee, normalizeRect(gesture.start, pt));
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (gesture.kind === "none") return;
    overlay.releasePointerCapture?.(e.pointerId);
    const g = gesture;
    gesture = { kind: "none" };
    paintGuides([]);
    if (g.kind === "move" || g.kind === "resize") ctrl.seal();
    if (g.kind === "marquee" && renderedSlide) {
      marquee.hidden = true;
      const rect = normalizeRect(g.start, toSlidePoint(e.clientX, e.clientY));
      const hits = elementsInRect(renderedSlide, rect);
      ctrl.select([...new Set([...g.additive, ...hits])]);
    }
  }

  overlay.addEventListener("pointerdown", onPointerDown);
  overlay.addEventListener("pointermove", onPointerMove);
  overlay.addEventListener("pointerup", onPointerUp);
  overlay.addEventListener("pointercancel", onPointerUp);
  overlay.addEventListener("dblclick", (e) => {
    if (!renderedSlide) return;
    const hit = hitElement(renderedSlide, toSlidePoint(e.clientX, e.clientY));
    if (hit?.type === "text") startInlineEdit(hit.id);
  });
  overlay.addEventListener("contextmenu", (e) => {
    if (!renderedSlide) return;
    e.preventDefault();
    const hit = hitElement(renderedSlide, toSlidePoint(e.clientX, e.clientY));
    if (hit && !ctrl.state.selection.ids.includes(hit.id)) ctrl.selectOne(hit.id);
    if (!hit) ctrl.clearSelection();
    opts.onContextMenu({ x: e.clientX, y: e.clientY });
  });
  overlay.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      well.classList.add("is-drop");
    }
  });
  overlay.addEventListener("dragleave", () => well.classList.remove("is-drop"));
  overlay.addEventListener("drop", (e) => {
    well.classList.remove("is-drop");
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    const files = [...(e.dataTransfer.files ?? [])];
    if (files.length) opts.onDropFiles(files, toSlidePoint(e.clientX, e.clientY));
  });

  return {
    el,
    overlay,
    get isEditing() {
      return editing !== null;
    },
    startInlineEdit,
    stopInlineEdit,
    /** Used by tests and the context menu: viewport → slide units. */
    toSlidePoint,
    render(state: EditorState) {
      const deck = state.deck;
      if (!deck) return;
      const index = state.selection.slide;
      const slide = deck.slides[index];
      if (!slide) return;
      if (slide !== renderedSlide || index !== renderedIndex || deck.theme !== renderedDeck?.theme) {
        if (editing) stopInlineEdit(true);
        renderStage(deck, index);
      }
      paintSelection(slide, state.selection.ids);
    },
    refit() {
      if (stage) {
        disposeFit?.();
        disposeFit = fitStage(host, stage);
      }
    },
    destroy() {
      disposeFit?.();
    },
  };
}
