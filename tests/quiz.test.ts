import { describe, expect, it } from "vitest";
import { QuizBook } from "../server/session/quiz.ts";

const quizzes = {
  q1: { options: ["a", "b", "c"], correctIndex: 1, display: "secret" as const },
  q2: { options: ["x", "y"], correctIndex: 0, display: "live" as const, timerSec: 10 },
};

function book() {
  return new QuizBook((id) => quizzes[id as keyof typeof quizzes] ?? null);
}

describe("quiz lifecycle", () => {
  it("opens when the presenter arrives and accepts editable votes until closed", () => {
    const b = book();
    b.arrive("q1", 0);
    expect(b.vote("u1", "q1", 0, 1)).toBe(true);
    expect(b.vote("u1", "q1", 2, 2)).toBe(true);
    expect(b.vote("u2", "q1", 2, 3)).toBe(true);
    expect(b.view("q1", "presenter")!.counts).toEqual([0, 0, 2]);
    b.close("q1");
    expect(b.vote("u1", "q1", 1, 4)).toBe(false);
    expect(b.myVote("u1", "q1")).toBe(2);
  });

  it("rejects votes for quizzes that were never opened or options out of range", () => {
    const b = book();
    expect(b.vote("u1", "q1", 0, 0)).toBe(false);
    b.arrive("q1", 0);
    expect(b.vote("u1", "q1", 9, 0)).toBe(false);
    expect(b.vote("u1", "nope", 0, 0)).toBe(false);
  });

  it("does not reopen a closed quiz when the presenter comes back to it", () => {
    const b = book();
    b.arrive("q1", 0);
    b.close("q1");
    b.arrive("q1", 5);
    expect(b.view("q1", "audience")!.status).toBe("closed");
  });

  it("hides secret counts and the answer from the audience until reveal", () => {
    const b = book();
    b.arrive("q1", 0);
    b.vote("u1", "q1", 1, 0);
    const before = b.view("q1", "audience")!;
    expect(before.counts).toBeNull();
    expect(before.correctIndex).toBeNull();
    expect(before.total).toBe(1);
    b.reveal("q1");
    const after = b.view("q1", "audience")!;
    expect(after.status).toBe("revealed");
    expect(after.counts).toEqual([0, 1, 0]);
    expect(after.correctIndex).toBe(1);
  });

  it("shows live counts to everyone but never the answer before reveal", () => {
    const b = book();
    b.arrive("q2", 0);
    b.vote("u1", "q2", 1, 0);
    const v = b.view("q2", "audience")!;
    expect(v.counts).toEqual([0, 1]);
    expect(v.correctIndex).toBeNull();
  });

  it("closes timed quizzes when the timer runs out", () => {
    const b = book();
    b.arrive("q2", 1_000);
    expect(b.view("q2", "audience")!.endsAt).toBe(11_000);
    expect(b.tick(10_999)).toBe(false);
    expect(b.tick(11_000)).toBe(true);
    expect(b.view("q2", "audience")!.status).toBe("closed");
  });
});

describe("scoring", () => {
  it("counts correct answers over revealed quizzes the user voted in", () => {
    const b = book();
    b.arrive("q1", 0);
    b.vote("ana", "q1", 1, 0);
    b.vote("luis", "q1", 0, 0);
    b.reveal("q1");
    b.arrive("q2", 0);
    b.vote("ana", "q2", 1, 0);
    b.vote("late", "q2", 0, 0); // joined late: only q2 counts
    b.reveal("q2");
    expect(b.score("ana")).toEqual({ correct: 1, answered: 2 });
    expect(b.score("luis")).toEqual({ correct: 0, answered: 1 });
    expect(b.score("late")).toEqual({ correct: 1, answered: 1 });
    expect(b.score("ghost")).toEqual({ correct: 0, answered: 0 });
  });

  it("ignores unrevealed quizzes in the score", () => {
    const b = book();
    b.arrive("q1", 0);
    b.vote("ana", "q1", 1, 0);
    expect(b.score("ana")).toEqual({ correct: 0, answered: 0 });
  });

  it("ranks by correct answers, then by fewer answered, then by name", () => {
    const b = book();
    b.arrive("q1", 0);
    for (const [u, o] of [["ana", 1], ["bea", 1], ["carl", 0]] as const) b.vote(u, "q1", o, 0);
    b.reveal("q1");
    const names = new Map([["ana", "Ana"], ["bea", "Bea"], ["carl", "Carl"]]);
    const board = b.leaderboard((id) => names.get(id) ?? "?", 10);
    expect(board.map((r) => [r.name, r.correct, r.rank])).toEqual([
      ["Ana", 1, 1],
      ["Bea", 1, 1],
      ["Carl", 0, 3],
    ]);
    expect(b.rankOf("carl", (id) => names.get(id) ?? "?")).toEqual({ rank: 3, of: 3 });
  });
});
