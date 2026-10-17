export interface RankedOption {
  index: number;
  count: number;
  /** 1-based; tied counts share a rank. */
  rank: number;
}

/** Options sorted by votes (ties keep deck order), with competition ranks. */
export function rankOptions(counts: readonly number[]): RankedOption[] {
  const rows = counts.map((count, index) => ({ index, count, rank: 0 })).sort((a, b) => b.count - a.count || a.index - b.index);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.count === r.count ? prev.rank : i + 1;
  });
  return rows;
}
