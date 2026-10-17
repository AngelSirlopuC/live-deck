// Presenter time limit: how the elapsed time compares with the planned duration.

export type Pace = "ok" | "near" | "over";

export const TIME_LIMIT_MIN = 1;
export const TIME_LIMIT_MAX = 600;

const MINUTE = 60_000;

/** Yellow window before the limit: the last 20% of it, between 1 and 5 minutes. */
export function warnWindowMs(limitMs: number): number {
  return Math.min(5 * MINUTE, Math.max(MINUTE, Math.round(limitMs * 0.2)));
}

/** Green while on time, yellow in the warning window, red once the limit is reached. */
export function paceOf(elapsedMs: number, limitMs: number | null): Pace | null {
  if (limitMs === null) return null;
  if (elapsedMs >= limitMs) return "over";
  return limitMs - elapsedMs <= warnWindowMs(limitMs) ? "near" : "ok";
}

/** mm:ss, or h:mm:ss from one hour on. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}
