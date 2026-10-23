import { ASK_QUESTION_MAX, ASK_TEXT_MAX, ASK_TEXT_MIN, groupAnswers, type AskEntry, type AskView } from "../../shared/ask.ts";
import { cleanText } from "./social.ts";

interface Ask {
  id: string;
  question: string;
  maxChars: number;
  status: "open" | "closed";
  answers: Map<string, string>;
}

export type AnswerResult = "ok" | "closed" | "empty";

/** Live free-text questions: one on screen at a time, every one kept for the summary. */
export class AskBook {
  private readonly asks: Ask[] = [];
  private current: Ask | null = null;

  /** Launches a question, replacing the one on screen; false when the question is empty. */
  open(question: string, maxChars: number): boolean {
    const q = cleanText(question, ASK_QUESTION_MAX);
    if (!q) return false;
    const ask: Ask = {
      id: `a${this.asks.length + 1}`,
      question: q,
      maxChars: Math.min(ASK_TEXT_MAX, Math.max(ASK_TEXT_MIN, Math.round(maxChars))),
      status: "open",
      answers: new Map(),
    };
    this.asks.push(ask);
    this.current = ask;
    return true;
  }

  /** Stops taking answers; the results stay on screen. */
  close() {
    if (this.current) this.current.status = "closed";
  }

  /** Removes the question from the screen. */
  clear() {
    if (this.current) this.current.status = "closed";
    this.current = null;
  }

  /** Records or replaces a participant's answer to the question on screen. */
  answer(participantId: string, raw: string): AnswerResult {
    const ask = this.current;
    if (!ask || ask.status !== "open") return "closed";
    const text = cleanText(raw, ask.maxChars);
    if (!text) return "empty";
    ask.answers.set(participantId, text);
    return "ok";
  }

  view(): AskView | null {
    const ask = this.current;
    if (!ask) return null;
    return { id: ask.id, question: ask.question, maxChars: ask.maxChars, status: ask.status, entries: groupAnswers(ask.answers.values()), total: ask.answers.size };
  }

  /** The participant's answer to the question on screen. */
  mine(participantId: string): string | null {
    return this.current?.answers.get(participantId) ?? null;
  }

  results(): Array<{ question: string; maxChars: number; entries: AskEntry[]; total: number }> {
    return this.asks.map((a) => ({ question: a.question, maxChars: a.maxChars, entries: groupAnswers(a.answers.values()), total: a.answers.size }));
  }
}
