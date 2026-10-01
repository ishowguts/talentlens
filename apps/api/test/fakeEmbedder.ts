import { EMBEDDING_DIMS, type Embedder } from '../src/services/embeddings.js';

/**
 * A deterministic bag-of-words embedder for tests: each word is hashed into one of the 384 dimensions and the
 * vector is L2-normalized. Texts that share words land closer together, which is enough to test ranking and
 * the endpoints without downloading the real model.
 */
export const fakeEmbedder: Embedder = {
  model: 'test-bag-of-words',
  dims: EMBEDDING_DIMS,
  embed: async (texts) => texts.map(embedOne),
};

function embedOne(text: string): Float32Array {
  const vector = new Float32Array(EMBEDDING_DIMS);
  const words = text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? [];
  for (const word of words) {
    let hash = 2166136261;
    for (let i = 0; i < word.length; i += 1) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % EMBEDDING_DIMS;
    vector[index] = (vector[index] ?? 0) + 1;
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) {
    vector[0] = 1;
    return vector;
  }
  for (let i = 0; i < EMBEDDING_DIMS; i += 1) vector[i]! /= norm;
  return vector;
}
