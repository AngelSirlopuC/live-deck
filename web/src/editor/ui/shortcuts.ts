// Keyboard shortcuts as a pure decision: the event plus "is the user typing"
// in, so typing in a field never deletes an element and ⌘Z keeps editing text.

export type Shortcut =
  | "save"
  | "undo"
  | "redo"
  | "delete"
  | "duplicate"
  | "copy"
  | "cut"
  | "paste"
  | "selectAll"
  | "escape"
  | "commandMenu"
  | "nudge"
  | "slideUp"
  | "slideDown"
  | "nextSlide"
  | "prevSlide"
  | "overview";

export interface ShortcutContext {
  /** Focus is in an input, textarea, select or contenteditable. */
  typing: boolean;
  /** A modal sheet is open: only Esc is handled by the editor. */
  dialogOpen?: boolean;
}

export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** True when the focused element takes text input. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(type);
  }
  return false;
}

/** Keys that are the same shortcut on macOS (⌘) and elsewhere (Ctrl). */
const mod = (e: KeyLike) => e.metaKey || e.ctrlKey;

export function shortcutFor(e: KeyLike, ctx: ShortcutContext): Shortcut | undefined {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === "Escape") return "escape";
  if (ctx.dialogOpen) return undefined;
  if (mod(e) && key === "s") return "save";
  if (mod(e) && key === "k") return "commandMenu";
  // Everything below would fight the browser's own editing behaviour in a field.
  if (ctx.typing) return undefined;
  if (mod(e) && key === "z") return e.shiftKey ? "redo" : "undo";
  if (mod(e) && key === "y") return "redo";
  if (mod(e) && key === "d") return "duplicate";
  if (mod(e) && key === "c") return "copy";
  if (mod(e) && key === "x") return "cut";
  if (mod(e) && key === "v") return "paste";
  if (mod(e) && key === "a") return "selectAll";
  if (mod(e)) return undefined;
  if (key === "Delete" || key === "Backspace") return "delete";
  if (e.altKey && key === "ArrowUp") return "slideUp";
  if (e.altKey && key === "ArrowDown") return "slideDown";
  if (key.startsWith("Arrow")) return "nudge";
  if (key === "PageDown") return "nextSlide";
  if (key === "PageUp") return "prevSlide";
  if (key === "g") return "overview";
  return undefined;
}
