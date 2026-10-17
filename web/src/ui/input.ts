export interface NavHandlers {
  next: () => void;
  prev: () => void;
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

/** Keyboard and presentation-clicker navigation. Ignores typing in form fields. */
export function bindDeckKeys(target: Window, nav: NavHandlers): () => void {
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    // A focused button handles its own activation keys; arrows still navigate.
    if (el && /^(BUTTON|A|SUMMARY)$/.test(el.tagName) && (e.key === "Enter" || e.key === " ")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (NEXT_KEYS.has(e.key)) {
      e.preventDefault();
      nav.next();
    } else if (PREV_KEYS.has(e.key)) {
      e.preventDefault();
      nav.prev();
    }
  };
  target.addEventListener("keydown", onKey);
  return () => target.removeEventListener("keydown", onKey);
}

/** Horizontal swipe navigation for touch screens. */
export function bindSwipe(el: HTMLElement, nav: NavHandlers, threshold = 40, rotated: () => boolean = () => false): () => void {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  const down = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  };
  const up = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    // When the slide is shown rotated 90° (portrait theater mode), the slide's
    // horizontal axis runs down the screen.
    const sx = e.clientX - startX;
    const sy = e.clientY - startY;
    const dx = rotated() ? sy : sx;
    const dy = rotated() ? -sx : sy;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    // A swipe must not also count as a tap on the slide.
    const swallow = (c: Event) => c.stopPropagation();
    el.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 400);
    if (dx < 0) nav.next();
    else nav.prev();
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", () => (tracking = false));
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointerup", up);
  };
}
