// Selection state: the current slide and the selected element ids on it.
// Every helper returns a new value (or the same one when nothing changed).

export interface EditorSelection {
  slide: number;
  ids: readonly string[];
}

export function emptySelection(slide: number): EditorSelection {
  return { slide, ids: [] };
}

export function selectOnly(sel: EditorSelection, id: string): EditorSelection {
  return { slide: sel.slide, ids: [id] };
}

/** Shift-click: add when missing, remove when present. */
export function toggleId(sel: EditorSelection, id: string): EditorSelection {
  return sel.ids.includes(id) ? { slide: sel.slide, ids: sel.ids.filter((x) => x !== id) } : { slide: sel.slide, ids: [...sel.ids, id] };
}

export function selectAll(sel: EditorSelection, ids: readonly string[]): EditorSelection {
  return { slide: sel.slide, ids: [...ids] };
}

export function clearSelection(sel: EditorSelection): EditorSelection {
  return sel.ids.length === 0 ? sel : { slide: sel.slide, ids: [] };
}

export function isSelected(sel: EditorSelection, id: string): boolean {
  return sel.ids.includes(id);
}

/** Moving to another slide drops the element selection. */
export function changeSlide(sel: EditorSelection, slide: number): EditorSelection {
  return sel.slide === slide ? sel : { slide, ids: [] };
}

/** Drops ids that no longer exist (after delete, undo, reload). */
export function pruneSelection(sel: EditorSelection, existing: readonly string[]): EditorSelection {
  const kept = sel.ids.filter((id) => existing.includes(id));
  return kept.length === sel.ids.length ? sel : { slide: sel.slide, ids: kept };
}
