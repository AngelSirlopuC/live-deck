import { ASK_TEXT_DEFAULT, groupAnswers, type AskEntry, type AskView } from "../../shared/ask.ts";
import { cleanText } from "./social.ts";

/** What the deck says about an open-question slide. */
export interface AskDef {
  question: string;
  maxChars?: number;
}

interface Runtime {
  status: "open" | "closed";
  answers: Map<string, string>;
}

export type AnswerResult = "ok" | "closed" | "empty";

/** Answers for every open-question slide of a session, keyed by slide id. */
export class AskBook {
  // Map keeps insertion order: the order the questions opened in.
  private readonly runtimes = new Map<string, Runtime>();
  private readonly def: (slideId: string) => AskDef | null;

  constructor(def: (slideId: string) => AskDef | null) {
    this.def = def;
  }

  private limit(def: AskDef): number {
    return def.maxChars ?? ASK_TEXT_DEFAULT;
  }

  /** Presenter reached an open-question slide: opens it the first time only. */
  arrive(slideId: string) {
    if (!this.def(slideId) || this.runtimes.has(slideId)) return;
    this.runtimes.set(slideId, { status: "open", answers: new Map() });
  }

  /** Stops taking answers; the answers stay on screen. */
  close(slideId: string) {
    const rt = this.runtimes.get(slideId);
    if (rt) rt.status = "closed";
  }

  /** Records or replaces a participant's answer on one slide. */
  answer(participantId: string, slideId: string, raw: string): AnswerResult {
    const def = this.def(slideId);
    const rt = this.runtimes.get(slideId);
    if (!def || !rt || rt.status !== "open") return "closed";
    const text = cleanText(raw, this.limit(def));
    if (!text) return "empty";
    rt.answers.set(participantId, text);
    return "ok";
  }

  view(slideId: string): AskView | null {
    const def = this.def(slideId);
    const rt = this.runtimes.get(slideId);
    if (!def || !rt) return null;
    return { slideId, question: def.question, maxChars: this.limit(def), status: rt.status, entries: groupAnswers(rt.answers.values()), total: rt.answers.size };
  }

  views(): Record<string, AskView> {
    const out: Record<string, AskView> = {};
    for (const id of this.runtimes.keys()) out[id] = this.view(id)!;
    return out;
  }

  /** The participant's answer on every slide they answered. */
  myAnswers(participantId: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [id, rt] of this.runtimes) {
      const a = rt.answers.get(participantId);
      if (a !== undefined) out[id] = a;
    }
    return out;
  }

  results(): Array<{ question: string; maxChars: number; entries: AskEntry[]; total: number }> {
    return [...this.runtimes.keys()].map((id) => {
      const v = this.view(id)!;
      return { question: v.question, maxChars: v.maxChars, entries: v.entries, total: v.total };
    });
  }
}
