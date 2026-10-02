import { describe, expect, it } from 'vitest';
import {
  agreement,
  kappaLabel,
  ndcgAt,
  precisionAt,
  recallAt,
  reciprocalRankAt,
} from '../../../eval/metrics.js';

const relevant = new Set(['a', 'b', 'c']);

describe('recallAt', () => {
  it('counts how much of the relevant set was found', () => {
    expect(recallAt(['a', 'x', 'b'], relevant, 10)).toBeCloseTo(2 / 3, 10);
    expect(recallAt(['x', 'y'], relevant, 10)).toBe(0);
    expect(recallAt(['a', 'b', 'c'], relevant, 10)).toBe(1);
  });

  it('respects the cut-off', () => {
    expect(recallAt(['x', 'x', 'a'], relevant, 2)).toBe(0);
  });

  it('is zero when nothing is known to be relevant', () => {
    expect(recallAt(['a'], new Set(), 10)).toBe(0);
  });
});

describe('precisionAt', () => {
  it('divides by k, not by the number returned', () => {
    expect(precisionAt(['a', 'b'], relevant, 10)).toBeCloseTo(0.2, 10);
    expect(precisionAt(['a', 'x'], relevant, 2)).toBe(0.5);
  });
});

describe('reciprocalRankAt', () => {
  it('rewards an early first hit', () => {
    expect(reciprocalRankAt(['a', 'x'], relevant, 10)).toBe(1);
    expect(reciprocalRankAt(['x', 'a'], relevant, 10)).toBe(0.5);
    expect(reciprocalRankAt(['x', 'y'], relevant, 10)).toBe(0);
  });
});

describe('ndcgAt', () => {
  it('is 1 for the ideal ordering and lower when hits sit further down', () => {
    expect(ndcgAt(['a', 'b', 'c'], relevant, 10)).toBeCloseTo(1, 10);
    expect(ndcgAt(['x', 'a', 'b'], relevant, 10)).toBeLessThan(1);
    expect(ndcgAt(['a', 'x', 'b'], relevant, 10)).toBeGreaterThan(ndcgAt(['x', 'a', 'b'], relevant, 10));
  });

  it('is zero with no relevant set or no hits', () => {
    expect(ndcgAt(['a'], new Set(), 10)).toBe(0);
    expect(ndcgAt(['x', 'y'], relevant, 10)).toBe(0);
  });
});

describe('agreement', () => {
  it('is 1 with kappa 1 when both labelers agree everywhere', () => {
    const result = agreement([
      { human: true, judge: true },
      { human: false, judge: false },
      { human: true, judge: true },
    ]);

    expect(result.observed).toBe(1);
    expect(result.kappa).toBeCloseTo(1, 10);
  });

  it('reports kappa near zero when the judge only matches by chance', () => {
    // The judge calls everything relevant; the human calls half relevant.
    const result = agreement([
      { human: true, judge: true },
      { human: false, judge: true },
      { human: true, judge: true },
      { human: false, judge: true },
    ]);

    expect(result.observed).toBe(0.5);
    expect(result.kappa).toBeCloseTo(0, 10);
  });

  it('splits the disagreements by direction', () => {
    const result = agreement([
      { human: true, judge: false },
      { human: false, judge: true },
      { human: true, judge: true },
    ]);

    expect(result).toMatchObject({ n: 3, bothRelevant: 1, humanOnly: 1, judgeOnly: 1, bothNot: 0 });
  });

  it('handles an empty set without dividing by zero', () => {
    expect(agreement([])).toMatchObject({ n: 0, observed: 0, kappa: 0 });
  });
});

describe('kappaLabel', () => {
  it('names the conventional bands', () => {
    expect(kappaLabel(-0.1)).toBe('worse than chance');
    expect(kappaLabel(0.3)).toBe('fair');
    expect(kappaLabel(0.65)).toBe('substantial');
    expect(kappaLabel(0.9)).toBe('almost perfect');
  });
});
