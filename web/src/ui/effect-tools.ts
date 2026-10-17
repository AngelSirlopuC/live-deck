import type { PersistentEffect, Rect } from "../../../shared/effects.ts";
import type { PresenterCommand } from "../../../shared/protocol.ts";
import type { StageView } from "../render/stage-view.ts";

export type EffectTool = "ripple" | "focus" | "zoom";

/**
 * Pressing a tool's key or button. The pointer (ripple) works alongside a
 * focus or zoom on screen; focus and zoom exclude each other. Pressing the tool
 * of the effect on screen removes it; pressing the excluded one does nothing.
 */
export function pressTool(current: EffectTool, pressed: EffectTool, active: PersistentEffect["kind"] | null): { tool: EffectTool; clear: boolean } {
  if (pressed === "ripple") return { tool: "ripple", clear: false };
  if (active === pressed) return { tool: "ripple", clear: true };
  if (active && active !== pressed) return { tool: current, clear: false };
  if (current === pressed) return { tool: "ripple", clear: false };
  return { tool: pressed, clear: false };
}

export interface ToolState {
  /** Selected for the next click on the slide. */
  pressed: boolean;
  /** Its effect is on screen. */
  active: boolean;
  /** Excluded while the other persistent effect is selected or on screen. */
  disabled: boolean;
}

export function toolStates(tool: EffectTool, active: PersistentEffect["kind"] | null): Record<EffectTool, ToolState> {
  const busy = (k: "focus" | "zoom") => active === k || tool === k;
  return {
    ripple: { pressed: tool === "ripple", active: false, disabled: false },
    focus: { pressed: tool === "focus", active: active === "focus", disabled: busy("zoom") },
    zoom: { pressed: tool === "zoom", active: active === "zoom", disabled: busy("focus") },
  };
}

const DRAG_MIN_PX = 8;

/**
 * Presenter pointer tools on a monitor: click pulses a ripple; with focus or
 * zoom, clicking an element targets it and dragging targets a rectangle.
 */
export function bindEffectTools(view: StageView, getTool: () => EffectTool, send: (cmd: PresenterCommand) => void, current: () => PersistentEffect | null) {
  const host = view.host;
  let start: { x: number; y: number; cx: number; cy: number } | null = null;
  let box: HTMLElement | null = null;

  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // Buttons layered over the slide (exit, fullscreen, recovery) keep their own clicks.
    if ((e.target as HTMLElement | null)?.closest?.("button, a, input")) return;
    const p = view.toSlidePoint(e.clientX, e.clientY);
    if (!p) return;
    start = { ...p, cx: e.clientX, cy: e.clientY };
    host.setPointerCapture(e.pointerId);
  });

  host.addEventListener("pointermove", (e) => {
    if (!start || getTool() === "ripple") return;
    const dx = e.clientX - start.cx;
    const dy = e.clientY - start.cy;
    if (!box && Math.hypot(dx, dy) < DRAG_MIN_PX) return;
    if (!box) {
      box = document.createElement("div");
      box.className = "fx-select";
      host.append(box);
    }
    const hr = host.getBoundingClientRect();
    box.style.left = `${Math.min(start.cx, e.clientX) - hr.left}px`;
    box.style.top = `${Math.min(start.cy, e.clientY) - hr.top}px`;
    box.style.width = `${Math.abs(dx)}px`;
    box.style.height = `${Math.abs(dy)}px`;
  });

  const finish = (e: PointerEvent) => {
    if (!start) return;
    const s = start;
    start = null;
    const dragged = !!box;
    box?.remove();
    box = null;
    const tool = getTool();
    const p = view.toSlidePoint(e.clientX, e.clientY);

    if (tool === "ripple") {
      // A swipe is navigation, not a pointer tap.
      if (p && Math.hypot(e.clientX - s.cx, e.clientY - s.cy) < DRAG_MIN_PX * 2) send({ t: "ripple", x: p.x, y: p.y });
      return;
    }
    if (dragged && p) {
      const rect: Rect = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
      if (rect.w > 0.01 && rect.h > 0.01) send({ t: "effect", effect: { kind: tool, target: { rect } } });
      return;
    }
    const hit = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-element-id]");
    const id = hit && host.contains(hit) ? hit.dataset.elementId : undefined;
    const active = current();
    if (id && active?.kind === tool && "elementId" in active.target && active.target.elementId === id) {
      send({ t: "effect", effect: null });
    } else if (id) {
      send({ t: "effect", effect: { kind: tool, target: { elementId: id } } });
    } else if (p) {
      // Empty area: a small region around the click.
      const w = tool === "zoom" ? 0.34 : 0.26;
      const h = w;
      send({ t: "effect", effect: { kind: tool, target: { rect: { x: Math.max(0, p.x - w / 2), y: Math.max(0, p.y - h / 2), w, h } } } });
    }
  };
  host.addEventListener("pointerup", finish);
  host.addEventListener("pointercancel", () => {
    start = null;
    box?.remove();
    box = null;
  });
}
