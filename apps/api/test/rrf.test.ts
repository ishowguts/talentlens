import { describe, expect, it } from 'vitest';
import { rrfFuse, RRF_K } from '../src/services/rrf.js';

describe('rrfFuse', () => {
  it('ranks a job found by both lists above jobs found by one', () => {
    const fused = rrfFuse([
      { source: 'keyword', ids: [1, 2, 3] },
      { source: 'vector', ids: [3, 4, 1] },
    ]);

    expect(fused.map((entry) => entry.id)).toEqual([1, 3, 2, 4]);
    expect(fused[0]?.ranks).toEqual({ keyword: 1, vector: 3 });
    expect(fused[0]?.score).toBeCloseTo(1 / (RRF_K + 1) + 1 / (RRF_K + 3), 10);
  });

  it('records a null rank for a list that did not return the job', () => {
    const fused = rrfFuse([
      { source: 'keyword', ids: [10] },
      { source: 'vector', ids: [20] },
    ]);

    expect(fused.find((entry) => entry.id === 10)?.ranks).toEqual({ keyword: 1, vector: null });
    expect(fused.find((entry) => entry.id === 20)?.ranks).toEqual({ keyword: null, vector: 1 });
  });

  it('breaks ties on the lower id so the order is stable', () => {
    const fused = rrfFuse([
      { source: 'keyword', ids: [7] },
      { source: 'vector', ids: [3] },
    ]);

    expect(fused.map((entry) => entry.id)).toEqual([3, 7]);
  });

  it('uses only ranks, so a list with huge scores cannot dominate', () => {
    // Identical rank positions give identical contributions regardless of the underlying scores.
    const a = rrfFuse([{ source: 'keyword', ids: [1, 2] }]);
    const b = rrfFuse([{ source: 'vector', ids: [1, 2] }]);

    expect(a[0]?.score).toBe(b[0]?.score);
  });

  it('handles empty lists', () => {
    expect(rrfFuse([])).toEqual([]);
    expect(rrfFuse([{ source: 'keyword', ids: [] }])).toEqual([]);
  });

  it('keeps the best rank when a list repeats an id', () => {
    const fused = rrfFuse([{ source: 'keyword', ids: [5, 5] }]);

    expect(fused[0]?.ranks.keyword).toBe(1);
  });
});
