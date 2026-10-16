import { describe, expect, it } from "vitest";
import { summaryToMarkdown } from "../web/src/ui/summary.ts";

describe("summary markdown", () => {
  it("reports quizzes, ranking and reactions, escaping table syntax", () => {
    const md = summaryToMarkdown({
      title: "Demo | test",
      code: "ABC234",
      startedAt: 0,
      endedAt: 45 * 60_000,
      participants: 3,
      peakAudience: 2,
      quizzes: [{ slideId: "q", question: "¿Sí?", options: ["Uno", "Dos"], counts: [1, 3], total: 4, correctIndex: 1, revealed: true }],
      leaderboard: [{ name: "Ana", correct: 1, answered: 1, rank: 1 }],
      reactions: [{ emoji: "👏", count: 7 }],
    });
    expect(md).toContain("# Demo \\| test");
    expect(md).toContain("- Duración: 45 min");
    expect(md).toContain("| B. Dos (correcta) | 3 | 75% |");
    expect(md).toContain("4 votos · 75% acertó");
    expect(md).toContain("| 1 | Ana | 1/1 |");
    expect(md).toContain("👏 7");
  });
});
