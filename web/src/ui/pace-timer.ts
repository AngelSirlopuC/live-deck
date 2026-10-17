import { formatClock, paceOf } from "../../../shared/pace.ts";
import { h } from "./dom.ts";

const PACE_COPY = { ok: "a tiempo", near: "cerca del límite" } as const;

/** How long the clock icon rings, in ms; then it rests. Green never rings. */
const RING_MS = { near: 2400, over: 3200, remind: 1400 } as const;
type Ring = keyof typeof RING_MS;

/**
 * Presenter stopwatch with an optional time limit: green while on time, yellow
 * near the limit, red past it. Only presenters see it.
 */
export function createPaceTimer() {
  const el = h("span", { class: "pace-timer", "data-pace": "", role: "timer" });
  let lastPace: string | null = null;
  let lastOverMinute = 0;
  let ringTimer: ReturnType<typeof setTimeout> | undefined;
  // data-ring drives a short bell swing on the clock icon (CSS), then clears.
  const ring = (kind: Ring) => {
    clearTimeout(ringTimer);
    el.dataset.ring = kind;
    ringTimer = setTimeout(() => delete el.dataset.ring, RING_MS[kind]);
  };
  return {
    el,
    update(startedAt: number | null, limitMin: number | null, now: number = Date.now()) {
      const elapsed = startedAt !== null ? Math.max(0, now - startedAt) : 0;
      const limitMs = limitMin === null ? null : limitMin * 60_000;
      const pace = paceOf(elapsed, limitMs);
      el.dataset.pace = pace ?? "";
      if (pace !== lastPace) {
        if (pace === "near" || pace === "over") ring(pace);
        lastPace = pace;
        lastOverMinute = 0;
      } else if (pace === "over" && limitMs !== null) {
        // Past the limit: one short reminder per extra minute.
        const overMinute = Math.floor((elapsed - limitMs) / 60_000);
        if (overMinute > lastOverMinute) ring("remind");
        lastOverMinute = overMinute;
      }
      // The counter alone is shown; the color tells the pace and the label spells it out.
      el.textContent = formatClock(elapsed);
      if (limitMs === null || pace === null) {
        el.setAttribute("aria-label", `Tiempo transcurrido ${formatClock(elapsed)}`);
        el.removeAttribute("title");
        return;
      }
      const limit = formatClock(limitMs);
      el.title = `Límite: ${limit}`;
      el.setAttribute(
        "aria-label",
        pace === "over" ? `Tiempo ${formatClock(elapsed)}, te pasaste por ${formatClock(elapsed - limitMs)} del límite de ${limit}` : `Tiempo ${formatClock(elapsed)} de ${limit}, ${PACE_COPY[pace]}`,
      );
    },
  };
}
