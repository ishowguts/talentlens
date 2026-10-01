import { beforeAll, describe, expect, it } from 'vitest';
import {
  chunkResume,
  cosineSimilarity,
  EMBEDDING_DIMS,
  embedResume,
  getEmbedder,
  jobEmbeddingText,
  meanNormalize,
} from '../src/services/embeddings.js';

const l2 = (vector: Float32Array) => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

describe('chunkResume', () => {
  it('returns one chunk for short text', () => {
    expect(chunkResume('a b c')).toEqual(['a b c']);
  });

  it('overlaps chunks so a boundary skill appears twice', () => {
    const words = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ');

    const chunks = chunkResume(words, 180, 30);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.split(' ')).toHaveLength(180);
    const firstChunkTail = chunks[0]!.split(' ').slice(-30);
    expect(chunks[1]!.split(' ').slice(0, 30)).toEqual(firstChunkTail);
  });

  it('returns nothing for empty text', () => {
    expect(chunkResume('   ')).toEqual([]);
  });
});

describe('meanNormalize', () => {
  it('returns a unit vector', () => {
    const result = meanNormalize([new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])]);

    expect(l2(result)).toBeCloseTo(1, 5);
    expect(result[0]).toBeCloseTo(result[1]!, 5);
  });

  it('rejects mixed dimensions', () => {
    expect(() => meanNormalize([new Float32Array([1, 0]), new Float32Array([1, 0, 0])])).toThrow(
      /dimensions/,
    );
  });
});

describe('jobEmbeddingText', () => {
  it('puts the title first and truncates the description', () => {
    const text = jobEmbeddingText({
      title: 'Senior React Developer',
      company: 'Acme',
      location: 'Remote',
      description: 'x'.repeat(2000),
    });

    expect(text.startsWith('Senior React Developer\nAcme\nRemote\n')).toBe(true);
    expect(text.length).toBeLessThan(1300);
  });
});

describe('TransformersEmbedder', () => {
  // Downloads the model on first run, then uses the local cache.
  const embedder = getEmbedder('Xenova/all-MiniLM-L6-v2');

  beforeAll(async () => {
    await embedder.warm();
  }, 180_000);

  it('returns one unit vector of 384 dimensions per input', async () => {
    const [first, second] = await embedder.embed(['hello world', 'something else']);

    expect(embedder.dims).toBe(EMBEDDING_DIMS);
    expect(first).toHaveLength(EMBEDDING_DIMS);
    expect(second).toHaveLength(EMBEDDING_DIMS);
    expect(l2(first!)).toBeCloseTo(1, 3);
    expect(l2(second!)).toBeCloseTo(1, 3);
  });

  it('places related sentences closer than unrelated ones', async () => {
    const [frontend, react, baking] = await embedder.embed([
      'We are hiring a frontend engineer to build web interfaces.',
      'Looking for a React developer for our web application team.',
      'Sourdough bread baking techniques for home bakers.',
    ]);

    const related = cosineSimilarity(frontend!, react!);
    const unrelated = cosineSimilarity(frontend!, baking!);

    expect(related).toBeGreaterThan(unrelated);
  });

  it('embeds a chunked resume into one unit vector', async () => {
    const resume = `${'TypeScript React Node '.repeat(100)} PostgreSQL pgvector`;

    const vector = await embedResume(embedder, resume);

    expect(vector).toHaveLength(EMBEDDING_DIMS);
    expect(l2(vector)).toBeCloseTo(1, 3);
  });

  it('returns nothing for an empty batch', async () => {
    expect(await embedder.embed([])).toEqual([]);
  });
});
