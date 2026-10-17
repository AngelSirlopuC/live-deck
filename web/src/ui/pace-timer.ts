import { formatClock, paceOf } from "../../../shared/pace.ts";
import { h } from "./dom.ts";

const PACE_COPY = { ok: "a tiempo", near: "cerca del límite" } as const;

/**
 * Presenter stopwatch with an optional time limit: green while on time, yellow
 * near the limit, red past it. Only presenters see it.
 */
export function createPaceTimer() {
  const el = h("span", { class: "pace-timer", "data-pace": "", role: "timer" });
  return {
    el,
    update(startedAt: number | null, limitMin: number | null, now: number = Date.now()) {
      const elapsed = startedAt !== null ? Math.max(0, now - startedAt) : 0;
      const limitMs = limitMin === null ? null : limitMin * 60_000;
      const pace = paceOf(elapsed, limitMs);
      el.dataset.pace = pace ?? "";
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
