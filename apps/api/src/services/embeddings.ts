// Local embeddings. See docs/ARCHITECTURE.md section 7.2 and ADR-004.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env as transformersEnv, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

/** Embedding dimension of all-MiniLM-L6-v2. A different dimension needs a migration and a re-embed. */
export const EMBEDDING_DIMS = 384;

/** Batch size used when embedding many texts. */
const BATCH_SIZE = 32;

/** Resume chunking, in words. Chunks overlap so skills on a boundary are not lost. */
const CHUNK_WORDS = 180;
const CHUNK_OVERLAP_WORDS = 30;

/** Model input limit, in word pieces; longer text is truncated by the tokenizer. */
const JOB_DESCRIPTION_CHARS = 1200;

/**
 * Anything that turns text into unit vectors. A hosted embedding API can implement this without touching
 * callers (a dimension change means a migration and a re-embed).
 */
export interface Embedder {
  readonly model: string;
  readonly dims: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

// Keep the model inside the repository so a developer machine and CI can cache it.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
transformersEnv.cacheDir = path.join(repoRoot, '.cache', 'transformers');

class TransformersEmbedder implements Embedder {
  readonly dims = EMBEDDING_DIMS;
  private extractor: Promise<FeatureExtractionPipeline> | null = null;

  constructor(readonly model: string) {}

  /** Load the model once per process. Called on boot so the first request is not the slow one. */
  async warm(): Promise<void> {
    await this.load();
  }

  private load(): Promise<FeatureExtractionPipeline> {
    this.extractor ??= pipeline('feature-extraction', this.model);
    return this.extractor;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const extractor = await this.load();
    const vectors: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((text) => text.trim() || ' ');
      // Mean pooling plus normalization gives unit vectors, so cosine distance is 1 - dot product.
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      const data = output.data as Float32Array;
      for (let row = 0; row < batch.length; row += 1) {
        vectors.push(Float32Array.prototype.slice.call(data, row * this.dims, (row + 1) * this.dims));
      }
    }

    return vectors;
  }
}

let singleton: TransformersEmbedder | null = null;

/** The process-wide embedder for a model id. Loading the model is deferred to the first embed call. */
export function getEmbedder(model: string): Embedder & { warm(): Promise<void> } {
  if (!singleton || singleton.model !== model) singleton = new TransformersEmbedder(model);
  return singleton;
}

/**
 * The text a job is embedded from: title first, so tokenizer truncation keeps the most important part.
 */
export function jobEmbeddingText(job: {
  title: string;
  company: string;
  location: string | null;
  description: string;
}): string {
  return [job.title, job.company, job.location ?? '', job.description.slice(0, JOB_DESCRIPTION_CHARS)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');
}

/** Split a resume into overlapping word chunks so skills listed late are not cut off. */
export function chunkResume(text: string, chunkWords = CHUNK_WORDS, overlap = CHUNK_OVERLAP_WORDS): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= chunkWords) return [words.join(' ')];

  const step = Math.max(1, chunkWords - overlap);
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + chunkWords).join(' '));
    if (start + chunkWords >= words.length) break;
  }
  return chunks;
}

/** Mean of unit vectors, re-normalized back to unit length. */
export function meanNormalize(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) throw new Error('meanNormalize: no vectors');
  const dims = vectors[0]!.length;
  const sum = new Float32Array(dims);
  for (const vector of vectors) {
    if (vector.length !== dims) throw new Error('meanNormalize: mixed dimensions');
    for (let i = 0; i < dims; i += 1) sum[i]! += vector[i]!;
  }

  let norm = 0;
  for (let i = 0; i < dims; i += 1) norm += sum[i]! * sum[i]!;
  norm = Math.sqrt(norm);
  if (norm === 0) throw new Error('meanNormalize: zero vector');
  for (let i = 0; i < dims; i += 1) sum[i]! /= norm;
  return sum;
}

/** Embed a resume: chunk, embed each chunk, mean, re-normalize (section 7.2). */
export async function embedResume(embedder: Embedder, text: string): Promise<Float32Array> {
  const chunks = chunkResume(text);
  if (chunks.length === 0) throw new Error('embedResume: empty resume text');
  return meanNormalize(await embedder.embed(chunks));
}

/** Cosine similarity for unit vectors. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i]! * b[i]!;
  return dot;
}
