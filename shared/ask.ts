// Free-text question the presenter launches live; the audience answers in a few words.

export const ASK_QUESTION_MAX = 200;
export const ASK_TEXT_MIN = 10;
export const ASK_TEXT_DEFAULT = 40;
export const ASK_TEXT_MAX = 100;

/** One distinct answer and how many people gave it. */
export interface AskEntry {
  text: string;
  count: number;
}

export interface AskView {
  id: string;
  question: string;
  maxChars: number;
  /** "open" accepts answers; "closed" keeps them on screen. */
  status: "open" | "closed";
  /** Grouped answers, most repeated first. */
  entries: AskEntry[];
  /** People who answered. */
  total: number;
}

/** Answers that differ only in case, accents or spacing count as the same. */
export function answerKey(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

/** Groups equal answers, shows each group's most common spelling, most repeated first and ties A to Z. */
export function groupAnswers(answers: Iterable<string>): AskEntry[] {
  const groups = new Map<string, Map<string, number>>();
  for (const raw of answers) {
    const text = raw.replace(/\s+/g, " ").trim();
    const key = answerKey(text);
    if (!key) continue;
    const spellings = groups.get(key) ?? new Map<string, number>();
    spellings.set(text, (spellings.get(text) ?? 0) + 1);
    groups.set(key, spellings);
  }
  const entries: AskEntry[] = [];
  for (const spellings of groups.values()) {
    let best = "";
    let bestCount = 0;
    let count = 0;
    // Map keeps insertion order, so a tie goes to the spelling seen first.
    for (const [text, n] of spellings) {
      count += n;
      if (n > bestCount) [best, bestCount] = [text, n];
    }
    entries.push({ text: best, count });
  }
  return entries.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "es"));
}
