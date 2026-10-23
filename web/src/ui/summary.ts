import type { SessionSummary } from "../../../shared/protocol.ts";
import { h, trusted } from "./dom.ts";
import { icon } from "./icons.ts";

const LETTERS = "ABCDEF";

function fmtDate(ms: number | null): string {
  return ms !== null ? new Date(ms).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function fmtDuration(a: number | null, b: number | null): string {
  if (a === null || b === null) return "—";
  const min = Math.round((b - a) / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

const esc = (s: string) => s.replace(/([\\|*_`#[\]])/g, "\\$1");

/** Human-readable session report for the presenter. */
export function summaryToMarkdown(s: SessionSummary): string {
  const lines = [
    `# ${esc(s.title)}`,
    "",
    `- Sesión: ${s.code}`,
    `- Inicio: ${fmtDate(s.startedAt)}`,
    `- Duración: ${fmtDuration(s.startedAt, s.endedAt)}`,
    `- Participantes: ${s.participants} (máximo simultáneo: ${s.peakAudience})`,
    "",
    "## Preguntas",
  ];
  if (!s.quizzes.length) lines.push("", "No se abrió ninguna pregunta.");
  for (const q of s.quizzes) {
    lines.push("", `### ${esc(q.question)}`, "", "| Opción | Votos | % |", "| --- | ---: | ---: |");
    q.options.forEach((o, i) => {
      const pct = q.total ? Math.round(((q.counts[i] ?? 0) / q.total) * 100) : 0;
      lines.push(`| ${LETTERS[i]}. ${esc(o)}${i === q.correctIndex ? " (correcta)" : ""} | ${q.counts[i] ?? 0} | ${pct}% |`);
    });
    const right = q.counts[q.correctIndex] ?? 0;
    lines.push("", `${q.total} votos · ${q.total ? Math.round((right / q.total) * 100) : 0}% acertó${q.revealed ? "" : " · respuesta no revelada"}`);
  }
  lines.push("", "## Preguntas abiertas");
  if (!s.asks.length) lines.push("", "No se lanzó ninguna pregunta abierta.");
  for (const a of s.asks) {
    lines.push("", `### ${esc(a.question)}`, "");
    if (a.entries.length) {
      lines.push("| Respuesta | Veces |", "| --- | ---: |");
      for (const e of a.entries) lines.push(`| ${esc(e.text)} | ${e.count} |`);
      lines.push("");
    }
    lines.push(`${a.total === 1 ? "1 respuesta" : `${a.total} respuestas`} · máx. ${a.maxChars} caracteres`);
  }
  lines.push("", "## Ranking", "");
  if (!s.leaderboard.length) lines.push("Sin respuestas reveladas.");
  else {
    lines.push("| Puesto | Nombre | Aciertos |", "| ---: | --- | ---: |");
    for (const r of s.leaderboard) lines.push(`| ${r.rank} | ${esc(r.name)} | ${r.correct}/${r.answered} |`);
  }
  lines.push("", "## Reacciones", "", s.reactions.map((r) => `${r.emoji} ${r.count}`).join(" · "), "");
  return lines.join("\n");
}

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Panel shown on the console once the session ends. */
export function createEndPanel(onPurge: () => void) {
  const stats = h("p", { class: "end-stats" });
  const md = trusted("button", { type: "button", class: "key key-primary" }, `${icon("download")}<span>Resumen (.md)</span>`);
  const js = trusted("button", { type: "button", class: "key" }, `${icon("download")}<span>Datos (.json)</span>`);
  const purge = h("button", { type: "button", class: "key key-danger" }, "Borrar datos ahora");
  const el = h(
    "section",
    { class: "end-panel", "aria-labelledby": "end-title" },
    h("span", { class: "lamp", "data-state": "off" }, "Fuera del aire"),
    h("h2", { id: "end-title" }, "Sesión finalizada"),
    stats,
    h("p", { class: "end-note" }, "Descarga el resumen ahora. Los datos de la sesión se borran solos en 30 minutos o cuando pulses borrar. El chat no se guarda."),
    h("div", { class: "sheet-actions" }, md, js),
    purge,
  );
  let summary: SessionSummary | null = null;
  const slug = () => (summary ? `${summary.code}-${summary.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "sesion");
  md.addEventListener("click", () => summary && download(`${slug()}.md`, "text/markdown;charset=utf-8", summaryToMarkdown(summary)));
  js.addEventListener("click", () => summary && download(`${slug()}.json`, "application/json", JSON.stringify(summary, null, 2)));
  purge.addEventListener("click", onPurge);
  md.disabled = js.disabled = true;
  return {
    el,
    setSummary(s: SessionSummary) {
      summary = s;
      md.disabled = js.disabled = false;
      stats.textContent = `${s.participants} participantes · ${s.quizzes.length} preguntas · ${fmtDuration(s.startedAt, s.endedAt)}`;
    },
  };
}
