// Reciprocal Rank Fusion. See docs/ARCHITECTURE.md section 7.3 and ADR-006.

/** The default k from the original RRF paper; large enough that no single list dominates. */
export const RRF_K = 60;

export type RrfSource = 'keyword' | 'vector';

export interface RankedList {
  source: RrfSource;
  /** Job ids, best match first. */
  ids: number[];
}

export interface FusedEntry {
  id: number;
  score: number;
  ranks: Record<RrfSource, number | null>;
}

/**
 * Fuse ranked lists by `sum(1 / (k + rank))`. Only ranks matter, so keyword scores and vector distances never
 * have to be put on a common scale. Ties break on the lower id so results are stable between runs.
 */
export function rrfFuse(lists: RankedList[], k = RRF_K): FusedEntry[] {
  const entries = new Map<number, FusedEntry>();

  for (const list of lists) {
    list.ids.forEach((id, index) => {
      const rank = index + 1;
      const entry = entries.get(id) ?? { id, score: 0, ranks: { keyword: null, vector: null } };
      entry.score += 1 / (k + rank);
      // A list should not contain the same id twice, but if it does, keep the best rank.
      const current = entry.ranks[list.source];
      entry.ranks[list.source] = current === null ? rank : Math.min(current, rank);
      entries.set(id, entry);
    });
  }

  return [...entries.values()].sort((a, b) => b.score - a.score || a.id - b.id);
}
