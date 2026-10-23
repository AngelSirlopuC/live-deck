// The editor document: a deck plus `apply(command)` that returns a new deck
// without mutating the old one (structural sharing). Commands that cannot
// apply (delete the last slide, 61st element, bad id) return the SAME deck
// reference, so callers can treat `next === deck` as "nothing happened".
//
// Browser-safe: only `import type` from shared/deck.ts (zod stays on the server).
import type { Ask, Box, Deck, DeckElement, Quiz, Slide, SlideBackground, Theme } from "../../../../shared/deck.ts";
import { ICON_NAMES } from "../../../../shared/icons.ts";
import { clampBox, moveBox, round4, unionBox, type ClampOptions } from "./geometry.ts";
import { isValidId, uniqueId } from "./ids.ts";

export const MAX_SLIDES = 200;
export const MAX_ELEMENTS = 60;
/** Offset applied to duplicates and pasted elements so they do not hide the original. */
export const DUPLICATE_OFFSET = 0.02;

export type ElementKind = DeckElement["type"];
export type SlideKind = "blank" | "quiz" | "ask";
export type ZOrder = "front" | "back" | "forward" | "backward";
export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type Axis = "horizontal" | "vertical";

type TextElement = Extract<DeckElement, { type: "text" }>;
type ShapeElement = Extract<DeckElement, { type: "shape" }>;
type ImageElement = Extract<DeckElement, { type: "image" }>;
type IconElement = Extract<DeckElement, { type: "icon" }>;
type ChartElement = Extract<DeckElement, { type: "chart" }>;
type DecorElement = Extract<DeckElement, { type: "decor" }>;

/** What `addElement` needs per kind; everything else gets a sensible default. */
export type NewElement =
  | { kind: "text"; text?: string; style?: TextElement["style"] }
  | { kind: "shape"; shape?: ShapeElement["shape"]; style?: ShapeElement["style"] }
  | { kind: "image"; src: string; alt: string; fit?: ImageElement["fit"] }
  | { kind: "qr" }
  | { kind: "icon"; name?: IconElement["name"]; style?: IconElement["style"] }
  | { kind: "chart"; chart?: ChartElement["kind"]; data?: ChartElement["data"] }
  | { kind: "decor"; shape?: DecorElement["shape"]; style?: DecorElement["style"] };

/** Keys present with `undefined` are removed from the target. */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };

export interface SlidePatch {
  id?: string;
  layout?: "free" | "quiz" | "ask";
  background?: string | SlideBackground | undefined;
  notes?: string | undefined;
  quiz?: Patch<Quiz>;
  ask?: Patch<Ask>;
}

/** Element patch: top-level keys shallow-merge; `style` merges one level deeper. */
export type ElementPatch = { id?: string; box?: Box; fragment?: number | undefined; style?: Record<string, unknown> } & Record<string, unknown>;

export type Command =
  | { type: "addSlide"; at: number; kind: SlideKind }
  | { type: "duplicateSlide"; index: number }
  | { type: "deleteSlide"; index: number }
  | { type: "moveSlide"; from: number; to: number }
  | { type: "setSlide"; index: number; patch: SlidePatch }
  | { type: "addElement"; slide: number; element: NewElement; box?: Partial<Box> }
  | { type: "duplicateElements"; slide: number; ids: readonly string[] }
  | { type: "deleteElements"; slide: number; ids: readonly string[] }
  | { type: "setBoxes"; slide: number; boxes: Readonly<Record<string, Box>> }
  | { type: "patchElement"; slide: number; id: string; patch: ElementPatch }
  | { type: "reorderZ"; slide: number; ids: readonly string[]; to: ZOrder }
  | { type: "align"; slide: number; ids: readonly string[]; edge: AlignEdge }
  | { type: "distribute"; slide: number; ids: readonly string[]; axis: Axis }
  | { type: "pasteElements"; slide: number; elements: readonly DeckElement[]; offset?: number }
  | { type: "setTheme"; patch: Patch<Theme> }
  | { type: "setTitle"; title: string };

export interface EditorDoc {
  readonly deck: Deck;
}

export function createDoc(deck: Deck): EditorDoc {
  return { deck };
}

/** Returns the same doc when the command had no effect. */
export function apply(doc: EditorDoc, command: Command): EditorDoc {
  const next = applyCommand(doc.deck, command);
  return next === doc.deck ? doc : { deck: next };
}

export function applyCommand(deck: Deck, command: Command): Deck {
  switch (command.type) {
    case "addSlide": return addSlide(deck, command.at, command.kind);
    case "duplicateSlide": return duplicateSlide(deck, command.index);
    case "deleteSlide": return deleteSlide(deck, command.index);
    case "moveSlide": return moveSlide(deck, command.from, command.to);
    case "setSlide": return updateSlide(deck, command.index, (s) => setSlide(deck, s, command.patch));
    case "addElement": return updateSlide(deck, command.slide, (s) => addElement(s, command.element, command.box));
    case "duplicateElements": return updateSlide(deck, command.slide, (s) => pasteElements(s, s.elements.filter((e) => command.ids.includes(e.id)), DUPLICATE_OFFSET));
    case "deleteElements": return updateSlide(deck, command.slide, (s) => deleteElements(s, command.ids));
    case "setBoxes": return updateSlide(deck, command.slide, (s) => setBoxes(s, command.boxes));
    case "patchElement": return updateSlide(deck, command.slide, (s) => patchElement(s, command.id, command.patch));
    case "reorderZ": return updateSlide(deck, command.slide, (s) => reorderZ(s, command.ids, command.to));
    case "align": return updateSlide(deck, command.slide, (s) => align(s, command.ids, command.edge));
    case "distribute": return updateSlide(deck, command.slide, (s) => distribute(s, command.ids, command.axis));
    case "pasteElements": return updateSlide(deck, command.slide, (s) => pasteElements(s, command.elements, command.offset ?? DUPLICATE_OFFSET));
    case "setTheme": return setTheme(deck, command.patch);
    case "setTitle": return command.title === deck.title ? deck : { ...deck, title: command.title };
  }
}

// ---------------------------------------------------------------------------
// Defaults

export const DEFAULT_QUIZ: Quiz = { question: "¿Cuál es la respuesta correcta?", options: ["Opción A", "Opción B"], correctIndex: 0, display: "live" };
export const DEFAULT_ASK: Ask = { question: "¿Qué palabra describe tu semana?" };

const centered = (w: number, h: number): Box => ({ x: round4((1 - w) / 2), y: round4((1 - h) / 2), w, h });

/** Default box per kind, centered on the slide. */
export function defaultBox(kind: ElementKind, shape?: string): Box {
  switch (kind) {
    case "text": return centered(0.6, 0.14);
    case "shape": return shape === "line" ? { ...centered(0.3, 0), h: 0 } : centered(0.24, 0.3);
    case "image": return centered(0.4, 0.5);
    case "qr": return centered(0.26, 0.46);
    case "icon": return centered(0.08, 0.14);
    case "chart": return centered(0.6, 0.5);
    case "decor": return centered(0.3, 0.4);
  }
}

function buildElement(id: string, init: NewElement, box: Box): DeckElement {
  switch (init.kind) {
    case "text": return { id, type: "text", box, text: init.text ?? "Texto", style: init.style ?? { fontSize: 48 } };
    case "shape": return { id, type: "shape", box, shape: init.shape ?? "rect", ...(init.style ? { style: init.style } : {}) };
    case "image": return { id, type: "image", box, src: init.src, alt: init.alt, ...(init.fit ? { fit: init.fit } : {}) };
    case "qr": return { id, type: "qr", box };
    case "icon": return { id, type: "icon", box, name: init.name ?? ICON_NAMES[0], ...(init.style ? { style: init.style } : {}) };
    case "chart": {
      const kind = init.chart ?? "bar";
      const data = init.data ?? [{ label: "A", value: 40 }, { label: "B", value: 25 }, { label: "C", value: 35 }];
      return { id, type: "chart", box, kind, data };
    }
    case "decor": return { id, type: "decor", box, shape: init.shape ?? "blob", ...(init.style ? { style: init.style } : {}) };
  }
}

/** Lines are the only element allowed to be 0 high. */
function clampFor(el: Pick<DeckElement, "type"> & { shape?: string }): ClampOptions {
  return el.type === "shape" && el.shape === "line" ? { minH: 0 } : {};
}

// ---------------------------------------------------------------------------
// Slides

function slideIds(deck: Deck): string[] {
  return deck.slides.map((s) => s.id);
}

function updateSlide(deck: Deck, index: number, fn: (slide: Slide) => Slide): Deck {
  const slide = deck.slides[index];
  if (!slide) return deck;
  const next = fn(slide);
  if (next === slide) return deck;
  const slides = deck.slides.slice();
  slides[index] = next;
  return { ...deck, slides };
}

function newSlide(deck: Deck, kind: SlideKind): Slide {
  const id = uniqueId(`slide-${deck.slides.length + 1}`, slideIds(deck));
  if (kind === "quiz") return { id, layout: "quiz", elements: [], quiz: { ...DEFAULT_QUIZ, options: [...DEFAULT_QUIZ.options] } };
  if (kind === "ask") return { id, layout: "ask", elements: [], ask: { ...DEFAULT_ASK } };
  return { id, elements: [] };
}

function insertSlide(deck: Deck, at: number, slide: Slide): Deck {
  if (deck.slides.length >= MAX_SLIDES) return deck;
  const index = Math.min(Math.max(at, 0), deck.slides.length);
  const slides = deck.slides.slice();
  slides.splice(index, 0, slide);
  return { ...deck, slides };
}

function addSlide(deck: Deck, at: number, kind: SlideKind): Deck {
  return insertSlide(deck, at, newSlide(deck, kind));
}

function duplicateSlide(deck: Deck, index: number): Deck {
  const source = deck.slides[index];
  if (!source) return deck;
  const copy = structuredClone(source);
  copy.id = uniqueId(source.id, slideIds(deck));
  return insertSlide(deck, index + 1, copy);
}

function deleteSlide(deck: Deck, index: number): Deck {
  if (deck.slides.length <= 1 || !deck.slides[index]) return deck;
  return { ...deck, slides: deck.slides.filter((_, i) => i !== index) };
}

function moveSlide(deck: Deck, from: number, to: number): Deck {
  const slide = deck.slides[from];
  if (!slide || from === to || to < 0 || to >= deck.slides.length) return deck;
  const slides = deck.slides.slice();
  slides.splice(from, 1);
  slides.splice(to, 0, slide);
  return { ...deck, slides };
}

/** Structural equality for plain JSON values (key order ignored); undefined keys count as absent. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!sameValue(ao[k], bo[k])) return false;
  return true;
}

/** Shallow merge where a key present with `undefined` deletes; `undefined` result means "empty". */
function mergePatch<T extends object>(base: T | undefined, patch: Patch<T>): T | undefined {
  const out: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return Object.keys(out).length === 0 ? undefined : (out as T);
}

function setSlide(deck: Deck, slide: Slide, patch: SlidePatch): Slide {
  let next: Slide = { ...slide };
  let changed = false;

  if (patch.id !== undefined && patch.id !== slide.id) {
    if (!isValidId(patch.id) || slideIds(deck).includes(patch.id)) return slide;
    next.id = patch.id;
    changed = true;
  }

  const layout = patch.layout ?? slide.layout ?? "free";
  if (patch.layout !== undefined && layout !== (slide.layout ?? "free")) {
    changed = true;
    const { quiz: _q, ask: _a, layout: _l, ...rest } = next;
    next = rest;
    if (layout === "quiz") next = { ...next, layout: "quiz", quiz: slide.quiz ?? { ...DEFAULT_QUIZ, options: [...DEFAULT_QUIZ.options] } };
    else if (layout === "ask") next = { ...next, layout: "ask", ask: slide.ask ?? { ...DEFAULT_ASK } };
  }

  if ("background" in patch) {
    const bg = patch.background;
    const { background: _b, ...rest } = next;
    // An object background with nothing left in it is dropped rather than saved invalid.
    const value = typeof bg === "string" || (bg && Object.values(bg).some((v) => v !== undefined)) ? bg : undefined;
    if (!sameValue(value, slide.background)) {
      changed = true;
      next = value === undefined ? rest : { ...rest, background: value };
    }
  }
  if ("notes" in patch) {
    const value = patch.notes !== undefined && patch.notes !== "" ? patch.notes : undefined;
    if (value !== slide.notes) {
      changed = true;
      const { notes: _n, ...rest } = next;
      next = value === undefined ? rest : { ...rest, notes: value };
    }
  }
  if (patch.quiz && layout === "quiz") {
    const quiz = mergePatch(next.quiz ?? DEFAULT_QUIZ, patch.quiz) ?? { ...DEFAULT_QUIZ };
    if (!sameValue(quiz, next.quiz)) {
      changed = true;
      next = { ...next, quiz };
    }
  }
  if (patch.ask && layout === "ask") {
    const ask = mergePatch(next.ask ?? DEFAULT_ASK, patch.ask) ?? { ...DEFAULT_ASK };
    if (!sameValue(ask, next.ask)) {
      changed = true;
      next = { ...next, ask };
    }
  }
  return changed ? next : slide;
}

// ---------------------------------------------------------------------------
// Elements

function elementIds(slide: Slide): string[] {
  return slide.elements.map((e) => e.id);
}

function addElement(slide: Slide, init: NewElement, box?: Partial<Box>): Slide {
  if (slide.elements.length >= MAX_ELEMENTS) return slide;
  const shape = "shape" in init ? init.shape : undefined;
  const id = uniqueId(init.kind, elementIds(slide), { numbered: true });
  const base = defaultBox(init.kind, shape);
  const el = buildElement(id, init, clampBox({ ...base, ...box }, clampFor({ type: init.kind, shape: init.kind === "shape" ? (init.shape ?? "rect") : undefined })));
  return { ...slide, elements: [...slide.elements, el] };
}

/** Appends copies with fresh ids (unique on this slide) shifted by `offset` on both axes. */
function pasteElements(slide: Slide, source: readonly DeckElement[], offset: number): Slide {
  if (source.length === 0) return slide;
  const room = MAX_ELEMENTS - slide.elements.length;
  if (room <= 0) return slide;
  const taken = new Set(elementIds(slide));
  const added: DeckElement[] = [];
  for (const el of source.slice(0, room)) {
    const id = uniqueId(el.id, taken);
    taken.add(id);
    const copy = structuredClone(el);
    copy.id = id;
    copy.box = moveBox(copy.box, offset, offset, clampFor(copy));
    added.push(copy);
  }
  return { ...slide, elements: [...slide.elements, ...added] };
}

function deleteElements(slide: Slide, ids: readonly string[]): Slide {
  const kept = slide.elements.filter((e) => !ids.includes(e.id));
  return kept.length === slide.elements.length ? slide : { ...slide, elements: kept };
}

function setBoxes(slide: Slide, boxes: Readonly<Record<string, Box>>): Slide {
  let changed = false;
  const elements = slide.elements.map((el) => {
    const box = boxes[el.id];
    if (!box) return el;
    const next = clampBox(box, clampFor(el));
    if (next.x === el.box.x && next.y === el.box.y && next.w === el.box.w && next.h === el.box.h) return el;
    changed = true;
    return { ...el, box: next };
  });
  return changed ? { ...slide, elements } : slide;
}

function patchElement(slide: Slide, id: string, patch: ElementPatch): Slide {
  const index = slide.elements.findIndex((e) => e.id === id);
  const el = slide.elements[index];
  if (!el) return slide;
  const { id: newId, style: stylePatch, box, ...rest } = patch;
  const out: Record<string, unknown> = { ...el };
  if (newId !== undefined && newId !== el.id) {
    if (!isValidId(newId) || elementIds(slide).includes(newId)) return slide;
    out.id = newId;
  }
  for (const [key, value] of Object.entries(rest)) {
    if (key === "type") continue;
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  if (box) out.box = clampBox(box, clampFor(el));
  if (stylePatch) {
    const style = mergePatch((el as { style?: Record<string, unknown> }).style, stylePatch);
    if (style) out.style = style;
    else delete out.style;
  }
  if (sameValue(out, el)) return slide;
  const elements = slide.elements.slice();
  elements[index] = out as DeckElement;
  return { ...slide, elements };
}

/** Z-order is array order: the last element paints on top. The selection keeps its relative order. */
function reorderZ(slide: Slide, ids: readonly string[], to: ZOrder): Slide {
  const picked = slide.elements.filter((e) => ids.includes(e.id));
  if (picked.length === 0) return slide;
  const others = slide.elements.filter((e) => !ids.includes(e.id));
  let elements: DeckElement[];
  if (to === "front") elements = [...others, ...picked];
  else if (to === "back") elements = [...picked, ...others];
  else {
    const indices = slide.elements.map((e, i) => (ids.includes(e.id) ? i : -1)).filter((i) => i >= 0);
    const first = indices[0]!;
    const last = indices[indices.length - 1]!;
    if (to === "forward") {
      if (last === slide.elements.length - 1) return slide;
      // Insert the block after the first non-selected element that follows it.
      const after = slide.elements[last + 1]!;
      const at = others.indexOf(after) + 1;
      elements = [...others.slice(0, at), ...picked, ...others.slice(at)];
    } else {
      if (first === 0) return slide;
      const before = slide.elements[first - 1]!;
      const at = others.indexOf(before);
      elements = [...others.slice(0, at), ...picked, ...others.slice(at)];
    }
  }
  return elements.every((e, i) => e === slide.elements[i]) ? slide : { ...slide, elements };
}

/** One element aligns to the slide; several align to their common bounds. */
function align(slide: Slide, ids: readonly string[], edge: AlignEdge): Slide {
  const picked = slide.elements.filter((e) => ids.includes(e.id));
  if (picked.length === 0) return slide;
  const ref = picked.length === 1 ? { x: 0, y: 0, w: 1, h: 1 } : unionBox(picked.map((e) => e.box))!;
  const boxes: Record<string, Box> = {};
  for (const el of picked) {
    const b = el.box;
    switch (edge) {
      case "left": boxes[el.id] = { ...b, x: ref.x }; break;
      case "hcenter": boxes[el.id] = { ...b, x: ref.x + (ref.w - b.w) / 2 }; break;
      case "right": boxes[el.id] = { ...b, x: ref.x + ref.w - b.w }; break;
      case "top": boxes[el.id] = { ...b, y: ref.y }; break;
      case "vcenter": boxes[el.id] = { ...b, y: ref.y + (ref.h - b.h) / 2 }; break;
      case "bottom": boxes[el.id] = { ...b, y: ref.y + ref.h - b.h }; break;
    }
  }
  return setBoxes(slide, boxes);
}

/** Equal gaps between three or more elements; the outer two stay put. */
function distribute(slide: Slide, ids: readonly string[], axis: Axis): Slide {
  const picked = slide.elements.filter((e) => ids.includes(e.id));
  if (picked.length < 3) return slide;
  const pos = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "w" : "h";
  const sorted = picked.slice().sort((a, b) => a.box[pos] - b.box[pos]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = last.box[pos] + last.box[size] - first.box[pos];
  const total = sorted.reduce((sum, e) => sum + e.box[size], 0);
  const gap = (span - total) / (sorted.length - 1);
  const boxes: Record<string, Box> = {};
  let cursor = first.box[pos];
  for (const el of sorted) {
    boxes[el.id] = { ...el.box, [pos]: cursor };
    cursor += el.box[size] + gap;
  }
  return setBoxes(slide, boxes);
}

// ---------------------------------------------------------------------------
// Deck

function setTheme(deck: Deck, patch: Patch<Theme>): Deck {
  const theme = mergePatch(deck.theme, patch);
  if (sameValue(theme, deck.theme)) return deck;
  if (theme === undefined) {
    if (deck.theme === undefined) return deck;
    const { theme: _t, ...rest } = deck;
    return rest;
  }
  return { ...deck, theme };
}
