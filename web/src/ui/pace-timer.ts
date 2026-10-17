import { formatClock, paceOf } from "../../../shared/pace.ts";
import { h } from "./dom.ts";

const PACE_COPY = { ok: "a tiempo", near: "cerca del límite" } as const;

/**
 * Presenter stopwatch with an optional time limit: green while on time, yellow
 * near the limit, red past it (showing the overrun). Only presenters see it.
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
      if (limitMs === null || pace === null) {
        el.textContent = formatClock(elapsed);
        el.setAttribute("aria-label", `Tiempo transcurrido ${formatClock(elapsed)}`);
        return;
      }
      const limit = formatClock(limitMs);
      if (pace === "over") {
        const over = formatClock(elapsed - limitMs);
        el.textContent = `+${over} / ${limit}`;
        el.setAttribute("aria-label", `Te pasaste por ${over} del límite de ${limit}`);
      } else {
        el.textContent = `${formatClock(elapsed)} / ${limit}`;
        el.setAttribute("aria-label", `Tiempo ${formatClock(elapsed)} de ${limit}, ${PACE_COPY[pace]}`);
      }
    },
  };
}
