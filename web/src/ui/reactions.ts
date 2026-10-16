import { REACTION_LABELS, REACTIONS } from "../../../shared/protocol.ts";
import { h } from "./dom.ts";

const MAX_PER_BATCH = 12;
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** One-tap reaction keys. */
export function createReactionBar(onReact: (index: number) => void) {
  const el = h("div", { class: "reaction-bar", role: "group", "aria-label": "Reacciones" });
  REACTIONS.forEach((emoji, i) => {
    const b = h("button", { type: "button", class: "reaction-key", "aria-label": REACTION_LABELS[i] }, emoji);
    b.addEventListener("click", () => onReact(i));
    el.append(b);
  });
  return {
    el,
    setEnabled(enabled: boolean) {
      el.querySelectorAll("button").forEach((b) => (b.disabled = !enabled));
    },
  };
}

/** Floats reaction emojis up the right edge of `layer`, TikTok-live style. */
export function floatReactions(layer: HTMLElement, counts: readonly number[]) {
  if (reducedMotion()) return;
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return;
  // Keep the screen readable under heavy load: sample proportionally.
  const budget = Math.min(MAX_PER_BATCH, total);
  const pool: number[] = [];
  counts.forEach((n, i) => {
    for (let k = 0; k < Math.round((n / total) * budget); k++) pool.push(i);
  });
  if (!pool.length) pool.push(counts.findIndex((n) => n > 0));
  pool.forEach((i, k) => {
    const node = h("span", { class: "floater", "aria-hidden": "true" }, REACTIONS[i]!);
    node.style.setProperty("--x", `${Math.round(Math.random() * 60 - 30)}px`);
    node.style.setProperty("--d", `${2200 + Math.random() * 1200}ms`);
    node.style.animationDelay = `${k * 70}ms`;
    layer.append(node);
    node.addEventListener("animationend", () => node.remove(), { once: true });
  });
}

/** Per-emoji session totals, most used first (presenter trend view). */
export function createReactionCounter() {
  const el = h("ol", { class: "reaction-counter", "aria-label": "Reacciones acumuladas" });
  return {
    el,
    update(totals: readonly number[] | null) {
      el.hidden = !totals;
      if (!totals) return;
      const rows = REACTIONS.map((emoji, i) => ({ emoji, i, n: totals[i] ?? 0 })).sort((a, b) => b.n - a.n);
      const max = Math.max(1, ...rows.map((r) => r.n));
      el.replaceChildren(
        ...rows.map((r) => {
          const li = h("li", { "aria-label": `${REACTION_LABELS[r.i]}: ${r.n}` }, h("span", { class: "rc-emoji" }, r.emoji), h("span", { class: "rc-bar" }), h("span", { class: "rc-n" }, String(r.n)));
          li.style.setProperty("--share", String(r.n / max));
          return li;
        }),
      );
    },
  };
}
