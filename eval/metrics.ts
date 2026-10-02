// Metric definitions, kept pure so they can be reasoned about and tested without a database.
// Relevance is binary throughout, so nDCG uses a gain of 1 for a relevant job.

/** Fraction of the known relevant jobs that appear in the top k. */
export function recallAt(retrieved: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0;
  const hits = retrieved.slice(0, k).filter((hash) => relevant.has(hash)).length;
  return hits / relevant.size;
}

/** Fraction of the top k that is relevant. Divided by k, not by how many were returned. */
export function precisionAt(retrieved: string[], relevant: Set<string>, k: number): number {
  const hits = retrieved.slice(0, k).filter((hash) => relevant.has(hash)).length;
  return hits / k;
}

/** Reciprocal of the rank of the first relevant job, or 0 when there is none in the top k. */
export function reciprocalRankAt(retrieved: string[], relevant: Set<string>, k: number): number {
  const index = retrieved.slice(0, k).findIndex((hash) => relevant.has(hash));
  return index === -1 ? 0 : 1 / (index + 1);
}

/** Discounted cumulative gain over the top k, normalized by the best possible ordering. */
export function ndcgAt(retrieved: string[], relevant: Set<string>, k: number): number {
  const dcg = retrieved
    .slice(0, k)
    .reduce((sum, hash, index) => sum + (relevant.has(hash) ? 1 / Math.log2(index + 2) : 0), 0);
  const ideal = Math.min(relevant.size, k);
  if (ideal === 0) return 0;
  let idcg = 0;
  for (let i = 0; i < ideal; i += 1) idcg += 1 / Math.log2(i + 2);
  return dcg / idcg;
}

export interface Agreement {
  /** Items judged by both. */
  n: number;
  /** Both called it relevant. */
  bothRelevant: number;
  /** Both called it not relevant. */
  bothNot: number;
  /** Human relevant, judge not. */
  humanOnly: number;
  /** Judge relevant, human not. */
  judgeOnly: number;
  /** Raw agreement, 0..1. */
  observed: number;
  /** Cohen's kappa, chance-corrected agreement. */
  kappa: number;
}

/**
 * Cohen's kappa between two binary labelers over the same items. Raw agreement alone flatters a judge when
 * most items are not relevant, which is exactly the case here, so kappa is the number that matters.
 */
export function agreement(pairs: Array<{ human: boolean; judge: boolean }>): Agreement {
  const n = pairs.length;
  const bothRelevant = pairs.filter((p) => p.human && p.judge).length;
  const bothNot = pairs.filter((p) => !p.human && !p.judge).length;
  const humanOnly = pairs.filter((p) => p.human && !p.judge).length;
  const judgeOnly = pairs.filter((p) => !p.human && p.judge).length;

  if (n === 0) return { n, bothRelevant, bothNot, humanOnly, judgeOnly, observed: 0, kappa: 0 };

  const observed = (bothRelevant + bothNot) / n;
  const humanRelevant = bothRelevant + humanOnly;
  const judgeRelevant = bothRelevant + judgeOnly;
  const expected =
    (humanRelevant / n) * (judgeRelevant / n) + ((n - humanRelevant) / n) * ((n - judgeRelevant) / n);
  const kappa = expected === 1 ? 1 : (observed - expected) / (1 - expected);

  return { n, bothRelevant, bothNot, humanOnly, judgeOnly, observed, kappa };
}

/** The conventional reading of a kappa value, so the number is not reported without its meaning. */
export function kappaLabel(kappa: number): string {
  if (kappa < 0) return 'worse than chance';
  if (kappa < 0.2) return 'slight';
  if (kappa < 0.4) return 'fair';
  if (kappa < 0.6) return 'moderate';
  if (kappa < 0.8) return 'substantial';
  return 'almost perfect';
}
