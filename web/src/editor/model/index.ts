// Editor model: pure, DOM-free and zod-free. The UI drives it with commands.
export {
  apply,
  applyCommand,
  createDoc,
  defaultBox,
  DEFAULT_ASK,
  DEFAULT_QUIZ,
  DUPLICATE_OFFSET,
  MAX_ELEMENTS,
  MAX_SLIDES,
} from "./document.ts";
export type { AlignEdge, Axis, Command, EditorDoc, ElementKind, ElementPatch, NewElement, Patch, SlideKind, SlidePatch, ZOrder } from "./document.ts";
export { ID_RE, isValidId, sanitizeId, uniqueId } from "./ids.ts";
export { DEFAULT_HISTORY_CAP, History } from "./history.ts";
export { changeSlide, clearSelection, emptySelection, isSelected, pruneSelection, selectAll, selectOnly, toggleId } from "./selection.ts";
export type { EditorSelection } from "./selection.ts";
export { snapEdge, snapMove } from "./snap.ts";
export type { Guide, SnapMoveResult } from "./snap.ts";
export { clampBox, moveBox, nudgeDelta, resizeBox, round4, unionBox, MIN_SIZE, NUDGE_BIG_STEP, NUDGE_STEP } from "./geometry.ts";
export type { ClampOptions, Handle, ResizeOptions } from "./geometry.ts";
export { parseClipboard, pasteFromClipboard, serializeElements } from "./clipboard.ts";
export { validateDeck } from "./validate.ts";
export type { ValidationIssue } from "./validate.ts";
