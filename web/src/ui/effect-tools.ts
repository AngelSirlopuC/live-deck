import type { PersistentEffect, Rect } from "../../../shared/effects.ts";
import type { PresenterCommand } from "../../../shared/protocol.ts";
import type { StageView } from "../render/stage-view.ts";

export type EffectTool = "ripple" | "focus" | "zoom";

type EffectKind = PersistentEffect["kind"];

/**
 * Pressing a tool's key or button. Focus and zoom combine: arming one never
 * touches the other. Pressing the armed tool again disarms it (back to the
 * pointer) and removes its effect from the screen.
 */
export function pressTool(current: EffectTool, pressed: EffectTool, active: readonly EffectKind[]): { tool: EffectTool; clear: EffectKind | null } {
  if (pressed === "ripple" || pressed !== current) return { tool: pressed, clear: null };
  const kind = pressed as EffectKind;
  return { tool: "ripple", clear: active.includes(kind) ? kind : null };
}

export interface ToolState {
  /** Armed for the next click or drag on the slide. */
  pressed: boolean;
  /** Its effect is on screen. */
  active: boolean;
  /** Effects only reach the audience while the session is live. */
  disabled: boolean;
}

export function toolStates(tool: EffectTool, active: readonly EffectKind[], live: boolean): Record<EffectTool, ToolState> {
  const st = (t: EffectTool): ToolState => ({ pressed: tool === t, active: t !== "ripple" && active.includes(t), disabled: !live });
  return { ripple: st("ripple"), focus: st("focus"), zoom: st("zoom") };
}

/** "Quitar efecto" clears the screen and disarms the tool, so it works whenever there is either. */
export function canClearEffects(tool: EffectTool, active: readonly EffectKind[], live: boolean): boolean {
  return live && (active.length > 0 || tool !== "ripple");
}

const DRAG_MIN_PX = 8;

/**
 * Presenter pointer tools on a monitor: click pulses a ripple; with focus or
 * zoom, clicking an element targets it and dragging targets a rectangle.
 */
export function bindEffectTools(view: StageView, getTool: () => EffectTool, send: (cmd: PresenterCommand) => void, current: () => readonly PersistentEffect[]) {
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
    const active = current().find((e) => e.kind === tool);
    if (id && active && "elementId" in active.target && active.target.elementId === id) {
      send({ t: "effect", effect: null, kind: tool });
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
