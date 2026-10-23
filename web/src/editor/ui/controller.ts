// Editor controller: owns the document history, the selection and the save
// cycle. DOM-free so the flows (load → edit → undo → save, conflicts, paste)
// are testable with a mocked fetch; the UI modules render from `state`.
import type { Box, Deck, DeckElement, Slide } from "../../../../shared/deck.ts";
import {
  applyCommand,
  changeSlide,
  clearSelection,
  emptySelection,
  History,
  nudgeDelta,
  parseClipboard,
  pruneSelection,
  selectAll,
  selectOnly,
  serializeElements,
  toggleId,
  validateDeck,
  moveBox,
  type Command,
  type EditorSelection,
  type ElementPatch,
  type NewElement,
  type SlideKind,
  type ValidationIssue,
} from "../model/index.ts";
import type { EditorApi } from "./api.ts";

export type Phase = "loading" | "ready" | "unauthorized" | "not-found" | "invalid" | "error";
export type SaveState = "saved" | "dirty" | "saving" | "error";

export interface EditorState {
  phase: Phase;
  deck: Deck | null;
  revision: string;
  selection: EditorSelection;
  saveState: SaveState;
  /** Message for phase "error"/"invalid" or saveState "error". */
  error: string;
  /** Raw file for phase "invalid". */
  raw: string;
  overview: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export type SaveOutcome =
  | { kind: "saved" }
  | { kind: "issues"; issues: ValidationIssue[] }
  | { kind: "conflict" }
  | { kind: "invalid"; error: string }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string }
  | { kind: "clean" };

export interface ClipboardPort {
  write(text: string): Promise<void>;
  read(): Promise<string>;
}

/** In-memory clipboard: the fallback when navigator.clipboard is unavailable or denied. */
export function memoryClipboard(): ClipboardPort {
  let text = "";
  return {
    write: async (t) => void (text = t),
    read: async () => text,
  };
}

type Listener = (state: EditorState) => void;

export class EditorController {
  readonly api: EditorApi;
  readonly deckId: string;
  private history: History | null = null;
  private listeners = new Set<Listener>();
  private clipboard: ClipboardPort;
  private saving = false;
  private saveError = "";
  state: EditorState = {
    phase: "loading",
    deck: null,
    revision: "",
    selection: emptySelection(0),
    saveState: "saved",
    error: "",
    raw: "",
    overview: false,
    canUndo: false,
    canRedo: false,
  };

  constructor(api: EditorApi, deckId: string, opts: { clipboard?: ClipboardPort } = {}) {
    this.api = api;
    this.deckId = deckId;
    this.clipboard = opts.clipboard ?? memoryClipboard();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<EditorState> = {}) {
    const h = this.history;
    const saveState: SaveState = this.saving ? "saving" : this.saveError ? "error" : h?.isDirty ? "dirty" : "saved";
    this.state = {
      ...this.state,
      ...patch,
      ...(h ? { deck: h.present, canUndo: h.canUndo, canRedo: h.canRedo } : {}),
      saveState,
      error: this.state.phase === "ready" ? this.saveError : (patch.error ?? this.state.error),
    };
    for (const fn of this.listeners) fn(this.state);
  }

  // ---------------------------------------------------------------------------
  // Loading

  async load(): Promise<void> {
    this.emit({ phase: "loading", error: "", raw: "" });
    const result = await this.api.load(this.deckId);
    switch (result.kind) {
      case "ok":
        this.history = new History(result.deck);
        this.saveError = "";
        this.emit({ phase: "ready", revision: result.revision, selection: emptySelection(0) });
        return;
      case "unauthorized":
        this.emit({ phase: "unauthorized" });
        return;
      case "not-found":
        this.emit({ phase: "not-found" });
        return;
      case "invalid":
        this.emit({ phase: "invalid", error: result.error, raw: result.raw });
        return;
      case "error":
        this.emit({ phase: "error", error: result.message });
        return;
    }
  }

  // ---------------------------------------------------------------------------
  // Document access

  get deck(): Deck {
    const deck = this.history?.present;
    if (!deck) throw new Error("deck not loaded");
    return deck;
  }

  get isDirty(): boolean {
    return this.history?.isDirty ?? false;
  }

  get currentSlide(): Slide | undefined {
    return this.history?.present.slides[this.state.selection.slide];
  }

  get selectedElements(): DeckElement[] {
    const slide = this.currentSlide;
    if (!slide) return [];
    return slide.elements.filter((e) => this.state.selection.ids.includes(e.id));
  }

  /** Applies a command; returns whether the deck changed. */
  dispatch(command: Command, coalesceKey?: string): boolean {
    const h = this.history;
    if (!h) return false;
    const next = applyCommand(h.present, command);
    if (next === h.present) return false;
    h.push(next, coalesceKey);
    this.saveError = "";
    this.syncSelection();
    return true;
  }

  /** Ends a coalescing run (drag end, field blur). */
  seal() {
    this.history?.seal();
  }

  private syncSelection(patch: Partial<EditorState> = {}) {
    const deck = this.history?.present;
    if (!deck) return;
    let sel = this.state.selection;
    const slideIndex = Math.min(sel.slide, deck.slides.length - 1);
    if (slideIndex !== sel.slide) sel = emptySelection(slideIndex);
    sel = pruneSelection(sel, deck.slides[slideIndex]?.elements.map((e) => e.id) ?? []);
    this.emit({ ...patch, selection: sel });
  }

  undo() {
    if (!this.history?.undo()) return;
    this.syncSelection();
  }

  redo() {
    if (!this.history?.redo()) return;
    this.syncSelection();
  }

  // ---------------------------------------------------------------------------
  // Selection

  selectSlide(index: number) {
    const deck = this.history?.present;
    if (!deck) return;
    const i = Math.min(Math.max(index, 0), deck.slides.length - 1);
    this.emit({ selection: changeSlide(this.state.selection, i) });
  }

  select(ids: readonly string[]) {
    this.emit({ selection: selectAll(this.state.selection, ids) });
  }

  selectOne(id: string) {
    this.emit({ selection: selectOnly(this.state.selection, id) });
  }

  toggle(id: string) {
    this.emit({ selection: toggleId(this.state.selection, id) });
  }

  selectAllElements() {
    const slide = this.currentSlide;
    if (!slide) return;
    this.emit({ selection: selectAll(this.state.selection, slide.elements.map((e) => e.id)) });
  }

  clearSelection() {
    this.emit({ selection: clearSelection(this.state.selection) });
  }

  setOverview(on: boolean) {
    if (this.state.overview !== on) this.emit({ overview: on });
  }

  // ---------------------------------------------------------------------------
  // Slides

  addSlide(kind: SlideKind, at: number = this.state.selection.slide + 1) {
    const before = this.deck.slides.length;
    if (!this.dispatch({ type: "addSlide", at, kind })) return;
    const index = Math.min(at, before);
    this.emit({ selection: emptySelection(index) });
  }

  duplicateSlide(index: number = this.state.selection.slide) {
    if (this.dispatch({ type: "duplicateSlide", index })) this.emit({ selection: emptySelection(index + 1) });
  }

  deleteSlide(index: number = this.state.selection.slide) {
    const len = this.deck.slides.length;
    if (!this.dispatch({ type: "deleteSlide", index })) return;
    const next = Math.min(index, len - 2);
    this.emit({ selection: emptySelection(Math.max(next, 0)) });
  }

  moveSlide(from: number, to: number) {
    if (this.dispatch({ type: "moveSlide", from, to })) this.emit({ selection: emptySelection(to) });
  }

  // ---------------------------------------------------------------------------
  // Elements on the current slide

  addElement(element: NewElement, box?: Partial<Box>) {
    const slide = this.state.selection.slide;
    const before = this.currentSlide?.elements.length ?? 0;
    if (!this.dispatch({ type: "addElement", slide, element, box })) return;
    const added = this.currentSlide?.elements[before];
    if (added) this.selectOne(added.id);
  }

  patchSelected(patch: ElementPatch, coalesceKey?: string) {
    const slide = this.state.selection.slide;
    for (const id of this.state.selection.ids) this.dispatch({ type: "patchElement", slide, id, patch }, coalesceKey);
  }

  patchElement(id: string, patch: ElementPatch, coalesceKey?: string) {
    this.dispatch({ type: "patchElement", slide: this.state.selection.slide, id, patch }, coalesceKey);
  }

  setBoxes(boxes: Record<string, Box>, coalesceKey?: string) {
    this.dispatch({ type: "setBoxes", slide: this.state.selection.slide, boxes }, coalesceKey);
  }

  deleteSelected() {
    const ids = this.state.selection.ids;
    if (ids.length === 0) return;
    this.dispatch({ type: "deleteElements", slide: this.state.selection.slide, ids });
  }

  duplicateSelected() {
    const ids = this.state.selection.ids;
    if (ids.length === 0) return;
    const slide = this.currentSlide!;
    const before = slide.elements.length;
    if (!this.dispatch({ type: "duplicateElements", slide: this.state.selection.slide, ids })) return;
    this.select(this.currentSlide!.elements.slice(before).map((e) => e.id));
  }

  nudge(key: string, big: boolean) {
    const delta = nudgeDelta(key, big);
    if (!delta) return;
    const boxes: Record<string, Box> = {};
    for (const el of this.selectedElements) boxes[el.id] = moveBox(el.box, delta.dx, delta.dy, el.type === "shape" && el.shape === "line" ? { minH: 0 } : {});
    this.setBoxes(boxes, `nudge:${this.state.selection.ids.join(",")}`);
  }

  async copy(): Promise<boolean> {
    const els = this.selectedElements;
    if (els.length === 0) return false;
    await this.clipboard.write(serializeElements(els));
    return true;
  }

  async cut(): Promise<void> {
    if (await this.copy()) this.deleteSelected();
  }

  async paste(): Promise<boolean> {
    let text = "";
    try {
      text = await this.clipboard.read();
    } catch {
      return false;
    }
    const elements = parseClipboard(text);
    if (!elements || elements.length === 0) return false;
    const before = this.currentSlide?.elements.length ?? 0;
    if (!this.dispatch({ type: "pasteElements", slide: this.state.selection.slide, elements })) return false;
    this.select(this.currentSlide!.elements.slice(before).map((e) => e.id));
    return true;
  }

  // ---------------------------------------------------------------------------
  // Saving

  validate(): ValidationIssue[] {
    return this.history ? validateDeck(this.history.present) : [];
  }

  /** Validates, then PUTs the present deck with the loaded revision. */
  async save(opts: { force?: boolean } = {}): Promise<SaveOutcome> {
    const h = this.history;
    if (!h) return { kind: "error", message: "No hay deck cargado." };
    if (!h.isDirty && !opts.force) return { kind: "clean" };
    const issues = validateDeck(h.present);
    if (issues.length) return { kind: "issues", issues };
    const sent = h.present;
    this.saving = true;
    this.saveError = "";
    this.emit();
    const result = await this.api.save(this.deckId, sent, this.state.revision);
    this.saving = false;
    switch (result.kind) {
      case "ok":
        // Edits made while the request was in flight stay dirty.
        if (h.present === sent) h.markSaved();
        this.emit({ revision: result.revision });
        return { kind: "saved" };
      case "conflict":
        this.emit();
        return { kind: "conflict" };
      case "invalid":
        this.saveError = result.error;
        this.emit();
        return { kind: "invalid", error: result.error };
      case "unauthorized":
        this.emit();
        return { kind: "unauthorized" };
      case "error":
        this.saveError = result.message;
        this.emit();
        return { kind: "error", message: result.message };
    }
  }

  /** Conflict → "Recargar": drops local edits and loads what is on disk. */
  async reload(): Promise<void> {
    const result = await this.api.load(this.deckId);
    if (result.kind !== "ok") {
      this.saveError = result.kind === "error" ? result.message : "No se pudo recargar el deck.";
      this.emit();
      return;
    }
    this.history?.reset(result.deck);
    this.saveError = "";
    this.syncSelection({ revision: result.revision });
  }

  /** Conflict → "Sobrescribir": takes the current revision and saves mine over it. */
  async overwrite(): Promise<SaveOutcome> {
    const result = await this.api.load(this.deckId);
    if (result.kind !== "ok") return { kind: "error", message: result.kind === "error" ? result.message : "No se pudo leer la revisión actual." };
    this.state.revision = result.revision;
    return this.save({ force: true });
  }

  /** Clears a save error (the user dismissed it). */
  clearError() {
    if (!this.saveError) return;
    this.saveError = "";
    this.emit();
  }
}
