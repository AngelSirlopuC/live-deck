// Id generation for slides and elements. Mirrors the deck schema regex so the
// editor never produces an id the server would reject.

export const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_LEN = 40;

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

/** Turns free text into a valid id ("Mi título!" → "Mi-t-tulo"); falls back to "item". */
export function sanitizeId(text: string): string {
  const cleaned = text.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_LEN);
  return cleaned || "item";
}

/**
 * First id not in `taken`: `base`, then `base-2`, `base-3`…  With `numbered`
 * the counter always applies (`text-1`, `text-2`), which reads better for
 * freshly inserted elements. A trailing `-N` on the base is replaced, not stacked.
 */
export function uniqueId(base: string, taken: Iterable<string>, opts: { numbered?: boolean } = {}): string {
  const used = taken instanceof Set ? taken : new Set(taken);
  const safe = sanitizeId(base);
  if (!opts.numbered && !used.has(safe)) return safe;
  const match = /^(.*?)-(\d+)$/.exec(safe);
  const stem = match ? match[1]! : safe;
  let n = match ? Number(match[2]) + 1 : opts.numbered ? 1 : 2;
  for (;;) {
    const suffix = `-${n}`;
    const candidate = `${stem.slice(0, MAX_LEN - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
    n++;
  }
}
