import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { MatchResponse } from 'shared';
import { RESUME_PDF_MAX_BYTES } from 'shared';
import { createApp } from '../src/app.js';
import type { LlmClient } from '../src/services/llm.js';
import { fakeEmbedder } from './fakeEmbedder.js';
import { createTestApp } from './helpers.js';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const resumePdf = readFileSync(path.join(fixtureDir, 'resume.pdf'));

const RESUME_TEXT = [
  'Jane Doe, senior frontend engineer with six years of experience.',
  'Skills: React, TypeScript, Next.js, CSS, accessibility and Playwright tests.',
  'Built component libraries and design systems, migrated a jQuery front end to React,',
  'and worked with Node.js APIs and PostgreSQL in continuous deployment.',
  'Education: BSc Computer Science.',
].join(' ');

const { db, env, close } = createTestApp();

/** Build an app whose reranking model is scripted for one test. */
function appWithLlm(llm: LlmClient | null) {
  return createApp({ db, env, embedder: fakeEmbedder, llm, rateLimits: { match: 1000 } });
}

/** An LLM that returns whatever the script says, one entry per call. */
function scriptedLlm(...responses: string[]): LlmClient {
  const calls = [...responses];
  return {
    model: 'test-model',
    generateJson: vi.fn(async () => {
      const next = calls.shift();
      if (next === undefined) throw new Error('scriptedLlm: no response left');
      return next;
    }),
  };
}

function rankingFor(jobIds: number[], fitScore = 90): string {
  return JSON.stringify({
    ranking: jobIds.map((jobId, index) => ({
      jobId,
      fitScore: Math.max(1, fitScore - index),
      reasons: ['Matches the stack in the resume'],
      missingSkills: ['Kubernetes'],
    })),
  });
}

async function topJobIds(): Promise<number[]> {
  const res = await request(appWithLlm(null)).post('/api/match').send({ text: RESUME_TEXT });
  return (res.body as MatchResponse).matches.map((match) => match.job.id);
}

async function clearResumes(): Promise<void> {
  await db.execute(sql`TRUNCATE matches, resumes RESTART IDENTITY CASCADE`);
}

beforeEach(clearResumes);
afterEach(clearResumes);
afterAll(() => close());

describe('POST /api/match', () => {
  it('returns ten vector-ordered matches when no model is configured', async () => {
    const res = await request(appWithLlm(null)).post('/api/match').send({ text: RESUME_TEXT });

    expect(res.status).toBe(200);
    const body = res.body as MatchResponse;
    expect(body.reranked).toBe(false);
    expect(body.matches).toHaveLength(10);
    expect(body.matches.every((match) => match.fitScore === null)).toBe(true);
    expect(body.matches[0]!.vectorScore).toBeGreaterThanOrEqual(body.matches[9]!.vectorScore);
    expect(body.resumeId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses the model ranking when the output is valid', async () => {
    const ids = await topJobIds();
    await clearResumes();
    const llm = scriptedLlm(rankingFor([...ids].reverse()));

    const res = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });

    const body = res.body as MatchResponse;
    expect(body.reranked).toBe(true);
    expect(body.matches).toHaveLength(10);
    expect(body.matches[0]!.job.id).toBe(ids[ids.length - 1]);
    expect(body.matches[0]!.fitScore).toBe(90);
    expect(body.matches[0]!.reasons.length).toBeGreaterThan(0);
    expect(llm.generateJson).toHaveBeenCalledTimes(1);
  });

  it('retries once when the first answer is not valid JSON', async () => {
    const ids = await topJobIds();
    await clearResumes();
    const llm = scriptedLlm('not json at all', rankingFor(ids));

    const res = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });

    expect((res.body as MatchResponse).reranked).toBe(true);
    expect(llm.generateJson).toHaveBeenCalledTimes(2);
  });

  it('falls back to vector order when the model fails twice', async () => {
    const llm = scriptedLlm('{"nope":true}', '{"ranking":[]}');

    const res = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });

    const body = res.body as MatchResponse;
    expect(res.status).toBe(200);
    expect(body.reranked).toBe(false);
    expect(body.matches).toHaveLength(10);
    expect(body.matches.every((match) => match.fitScore === null)).toBe(true);
    expect(llm.generateJson).toHaveBeenCalledTimes(2);
  });

  it('falls back when the model call times out', async () => {
    const llm: LlmClient = {
      model: 'test-model',
      generateJson: vi.fn(async () => {
        throw new Error('llm: timed out after 15000ms');
      }),
    };

    const res = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });

    expect((res.body as MatchResponse).reranked).toBe(false);
  });

  it('drops a job id the model invented', async () => {
    const ids = await topJobIds();
    await clearResumes();
    const llm = scriptedLlm(rankingFor([999_999, ...ids.slice(0, 5)]));

    const res = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });

    const body = res.body as MatchResponse;
    expect(body.reranked).toBe(true);
    expect(body.matches.map((match) => match.job.id)).not.toContain(999_999);
    expect(body.matches).toHaveLength(5);
  });

  it('reuses the stored matches for the same resume text', async () => {
    const ids = await topJobIds();
    await clearResumes();
    const llm = scriptedLlm(rankingFor(ids));

    const first = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });
    const second = await request(appWithLlm(llm)).post('/api/match').send({ text: RESUME_TEXT });

    expect((first.body as MatchResponse).resumeId).toBe((second.body as MatchResponse).resumeId);
    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect((second.body as MatchResponse).reranked).toBe(true);
  });

  it('accepts a PDF upload', async () => {
    const res = await request(appWithLlm(null))
      .post('/api/match')
      .attach('file', resumePdf, { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect((res.body as MatchResponse).matches).toHaveLength(10);
  });

  it('rejects a file that is not a PDF with 400', async () => {
    const res = await request(appWithLlm(null))
      .post('/api/match')
      .attach('file', Buffer.from('plain text, not a pdf'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an upload over the size limit with 413', async () => {
    const tooBig = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(RESUME_PDF_MAX_BYTES + 1024, 0x20),
    ]);

    const res = await request(appWithLlm(null))
      .post('/api/match')
      .attach('file', tooBig, { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects text that is too short', async () => {
    const res = await request(appWithLlm(null)).post('/api/match').send({ text: 'too short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
