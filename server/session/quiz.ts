import type { LeaderboardRow, QuizStatus, QuizView } from "../../shared/protocol.ts";

export interface QuizDef {
  options: readonly string[];
  correctIndex: number;
  display: "live" | "secret";
  timerSec?: number;
}

interface Runtime {
  status: QuizStatus;
  endsAt: number | null;
  votes: Map<string, number>;
}

export type ViewerRole = "presenter" | "audience";

/** Votes, reveal state and scoring for every quiz slide of a session. */
export class QuizBook {
  private readonly runtimes = new Map<string, Runtime>();
  private readonly def: (slideId: string) => QuizDef | null;

  constructor(def: (slideId: string) => QuizDef | null) {
    this.def = def;
  }

  /** Presenter reached a quiz slide: opens voting the first time only. */
  arrive(slideId: string, now: number) {
    const def = this.def(slideId);
    if (!def || this.runtimes.has(slideId)) return;
    this.runtimes.set(slideId, { status: "open", endsAt: def.timerSec ? now + def.timerSec * 1000 : null, votes: new Map() });
  }

  vote(participantId: string, slideId: string, option: number, now: number): boolean {
    const def = this.def(slideId);
    const rt = this.runtimes.get(slideId);
    if (!def || !rt || rt.status !== "open") return false;
    if (rt.endsAt !== null && now >= rt.endsAt) return false;
    if (!Number.isInteger(option) || option < 0 || option >= def.options.length) return false;
    rt.votes.set(participantId, option);
    return true;
  }

  close(slideId: string) {
    const rt = this.runtimes.get(slideId);
    if (rt?.status === "open") rt.status = "closed";
  }

  reveal(slideId: string) {
    const rt = this.runtimes.get(slideId);
    if (rt) rt.status = "revealed";
  }

  /** Closes timed quizzes whose time ran out. Returns true when anything changed. */
  tick(now: number): boolean {
    let changed = false;
    for (const rt of this.runtimes.values()) {
      if (rt.status === "open" && rt.endsAt !== null && now >= rt.endsAt) {
        rt.status = "closed";
        changed = true;
      }
    }
    return changed;
  }

  view(slideId: string, role: ViewerRole): QuizView | null {
    const def = this.def(slideId);
    const rt = this.runtimes.get(slideId);
    if (!def || !rt) return null;
    const counts = def.options.map(() => 0);
    for (const v of rt.votes.values()) counts[v] = (counts[v] ?? 0) + 1;
    const revealed = rt.status === "revealed";
    const presenter = role === "presenter";
    return {
      slideId,
      status: rt.status,
      counts: presenter || revealed || def.display === "live" ? counts : null,
      total: rt.votes.size,
      correctIndex: presenter || revealed ? def.correctIndex : null,
      endsAt: rt.endsAt,
    };
  }

  views(role: ViewerRole): Record<string, QuizView> {
    const out: Record<string, QuizView> = {};
    for (const id of this.runtimes.keys()) out[id] = this.view(id, role)!;
    return out;
  }

  myVote(participantId: string, slideId: string): number | undefined {
    return this.runtimes.get(slideId)?.votes.get(participantId);
  }

  myVotes(participantId: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, rt] of this.runtimes) {
      const v = rt.votes.get(participantId);
      if (v !== undefined) out[id] = v;
    }
    return out;
  }

  /** Correct answers over revealed quizzes this participant voted in. */
  score(participantId: string): { correct: number; answered: number } {
    let correct = 0;
    let answered = 0;
    for (const [id, rt] of this.runtimes) {
      if (rt.status !== "revealed") continue;
      const v = rt.votes.get(participantId);
      if (v === undefined) continue;
      answered++;
      if (v === this.def(id)?.correctIndex) correct++;
    }
    return { correct, answered };
  }

  private standings(name: (id: string) => string): Array<LeaderboardRow & { id: string }> {
    const ids = new Set<string>();
    for (const rt of this.runtimes.values()) if (rt.status === "revealed") for (const id of rt.votes.keys()) ids.add(id);
    const rows = [...ids].map((id) => ({ id, name: name(id), ...this.score(id), rank: 0 }));
    rows.sort((a, b) => b.correct - a.correct || a.answered - b.answered || a.name.localeCompare(b.name, "es"));
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = prev && prev.correct === r.correct && prev.answered === r.answered ? prev.rank : i + 1;
    });
    return rows;
  }

  leaderboard(name: (id: string) => string, limit: number): LeaderboardRow[] {
    return this.standings(name)
      .slice(0, limit)
      .map(({ name: n, correct, answered, rank }) => ({ name: n, correct, answered, rank }));
  }

  rankOf(participantId: string, name: (id: string) => string): { rank: number; of: number } | null {
    const rows = this.standings(name);
    const me = rows.find((r) => r.id === participantId);
    return me ? { rank: me.rank, of: rows.length } : null;
  }

  /** Every quiz that was opened, with full counts, for the presenter summary. */
  results(): Array<{ slideId: string; counts: number[]; total: number; correctIndex: number; status: QuizStatus }> {
    return [...this.runtimes.keys()].map((id) => {
      const v = this.view(id, "presenter")!;
      return { slideId: id, counts: v.counts!, total: v.total, correctIndex: v.correctIndex!, status: v.status };
    });
  }
}
