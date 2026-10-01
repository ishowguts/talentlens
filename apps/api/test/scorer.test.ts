import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { ScoreRequest, ScoreResponse } from 'shared';
import { createApp } from '../src/app.js';
import { CHECK_WEIGHTS, runChecks } from '../src/services/scorer.js';
import { findBiasTerms } from '../src/lib/biasTerms.js';
import type { LlmClient } from '../src/services/llm.js';
import { fakeEmbedder } from './fakeEmbedder.js';
import { createTestApp } from './helpers.js';

const { db, env, close } = createTestApp();

afterAll(() => close());

function appWithLlm(llm: LlmClient | null) {
  return createApp({ db, env, embedder: fakeEmbedder, llm, rateLimits: { score: 1000 } });
}

/** An advert that passes every rule: 100. */
const GOOD_AD: ScoreRequest = {
  title: 'Senior Backend Engineer, Payments',
  location: 'Bristol, United Kingdom',
  salaryMin: 75_000,
  salaryMax: 95_000,
  description: [
    'The role',
    'You will own the payments service that settles every transaction on our platform. It handles a few',
    'thousand payments an hour today and we expect that to grow steadily over the next two years. You will',
    'work with two other backend engineers, a product manager and a designer, and you will be the person who',
    'decides how the service is structured. We deploy several times a day and we keep the on-call rota light',
    'by investing in tests and alerting rather than heroics.',
    '',
    'What you will need',
    '- Several years writing server-side code in TypeScript, Go or a similar language',
    '- Comfortable designing relational schemas and reading query plans',
    '- Experience with a payment provider or another system where correctness really matters',
    '- Willingness to review other people code carefully and kindly',
    '',
    'What we offer',
    'A clear salary band, reviewed every year, and a budget for conferences and courses. Hybrid working with',
    'two days a week in the Bristol office, flexible hours around them, and a proper handover when you are on',
    'leave. We pay for the equipment you want and we do not expect anyone to answer messages at night. The',
    'interview is a conversation about your experience, a short technical discussion about a system you have',
    'built, and a meeting with the team you would join. We give a decision within a week and we always',
    'explain it. We welcome applications from people who do not tick every point above.',
  ].join('\n'),
};

/** An advert that fails every rule: 0. */
const BAD_AD: ScoreRequest = {
  title: 'SENIOR ROCKSTAR DEVELOPER NINJA 🚀 REQ-1234',
  description: [
    'We want a rockstar who can work hard play hard and move fast.',
    '- fast',
    '- hungry',
    '- young',
    '- driven',
    '- flexible',
    '- scrappy',
    '- gritty',
    '- loyal',
    '- humble',
    '- curious',
    '- tireless',
    '- fearless',
    'Send your CV and we will be in touch at some point.',
  ].join('\n'),
};

describe('runChecks', () => {
  it('gives a well-written advert full marks', () => {
    const { score, checks } = runChecks(GOOD_AD);

    expect(score).toBe(100);
    expect(checks.every((check) => check.pass)).toBe(true);
  });

  it('gives an advert that breaks every rule zero', () => {
    const { score, checks } = runChecks(BAD_AD);

    expect(score).toBe(0);
    expect(checks.some((check) => check.pass)).toBe(false);
  });

  it('weights add up to 100', () => {
    expect(Object.values(CHECK_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });

  const checkFor = (ad: ScoreRequest, id: string) => runChecks(ad).checks.find((check) => check.id === id)!;

  it('salary: passes on a figure in the fields or in the text', () => {
    expect(checkFor({ ...BAD_AD, salaryMin: 50_000 }, 'salary').pass).toBe(true);
    expect(
      checkFor({ ...BAD_AD, description: `${BAD_AD.description}\nSalary £50,000 per year.` }, 'salary').pass,
    ).toBe(true);
    expect(checkFor(BAD_AD, 'salary').pass).toBe(false);
  });

  it('length: fails short and long adverts', () => {
    const long = { ...GOOD_AD, description: 'word '.repeat(900) };

    expect(checkFor(GOOD_AD, 'length').pass).toBe(true);
    expect(checkFor(BAD_AD, 'length').pass).toBe(false);
    expect(checkFor(long, 'length').pass).toBe(false);
  });

  it('title: fails on length, shouting, emoji and internal codes', () => {
    expect(checkFor({ ...GOOD_AD, title: 'A'.repeat(61) }, 'title').pass).toBe(false);
    expect(checkFor({ ...GOOD_AD, title: 'URGENT Backend Engineer' }, 'title').pass).toBe(false);
    expect(checkFor({ ...GOOD_AD, title: 'Backend Engineer 🚀' }, 'title').pass).toBe(false);
    expect(checkFor({ ...GOOD_AD, title: 'Backend Engineer REQ-1234' }, 'title').pass).toBe(false);
    expect(checkFor(GOOD_AD, 'title').pass).toBe(true);
  });

  it('location: a stated location or the word remote is enough', () => {
    // A city named only in the body does not count; the field or the word remote does.
    expect(checkFor({ ...GOOD_AD, location: undefined }, 'location').pass).toBe(false);
    expect(checkFor({ ...BAD_AD, location: 'Leeds' }, 'location').pass).toBe(true);
    expect(
      checkFor({ ...BAD_AD, description: `${BAD_AD.description}\nThis role is remote.` }, 'location').pass,
    ).toBe(true);
    expect(checkFor(BAD_AD, 'location').pass).toBe(false);
  });

  it('requirements: fails past ten bulleted lines', () => {
    const elevenBullets = { ...GOOD_AD, description: `${GOOD_AD.description}\n${'- one more\n'.repeat(8)}` };

    expect(checkFor(GOOD_AD, 'requirements').pass).toBe(true);
    expect(checkFor(elevenBullets, 'requirements').pass).toBe(false);
  });

  it('inclusive: fails when a bias term appears in the title or the body', () => {
    expect(checkFor(GOOD_AD, 'inclusive').pass).toBe(true);
    expect(checkFor({ ...GOOD_AD, title: 'Backend Ninja' }, 'inclusive').pass).toBe(false);
    expect(
      checkFor({ ...GOOD_AD, description: `${GOOD_AD.description}\nMust be a native speaker.` }, 'inclusive')
        .pass,
    ).toBe(false);
  });

  it('structure: needs two of responsibilities, requirements and benefits', () => {
    expect(checkFor(GOOD_AD, 'structure').pass).toBe(true);
    expect(checkFor(BAD_AD, 'structure').pass).toBe(false);
  });
});

describe('findBiasTerms', () => {
  it('reports each term once with a reason and a suggestion', () => {
    const found = findBiasTerms('We need a rockstar ninja rockstar');

    expect(found.map((term) => term.term)).toEqual(['rockstar', 'ninja']);
    expect(found[0]?.suggestion.length).toBeGreaterThan(0);
    expect(found[0]?.reason.length).toBeGreaterThan(0);
  });

  it('matches on word boundaries only', () => {
    expect(findBiasTerms('our guruhood is strong')).toEqual([]);
  });
});

describe('POST /api/jobs/score', () => {
  it('scores without a model and returns no suggestions', async () => {
    const res = await request(appWithLlm(null)).post('/api/jobs/score').send(GOOD_AD);

    expect(res.status).toBe(200);
    const body = res.body as ScoreResponse;
    expect(body.score).toBe(100);
    expect(body.rewrittenTitle).toBeNull();
    expect(body.notes).toEqual([]);
    expect(body.checks).toHaveLength(7);
  });

  it('adds the model title rewrite and notes', async () => {
    const llm: LlmClient = {
      model: 'test-model',
      generateJson: vi.fn(async () =>
        JSON.stringify({ rewrittenTitle: 'Senior Backend Engineer', notes: ['State the salary band'] }),
      ),
    };

    const res = await request(appWithLlm(llm)).post('/api/jobs/score').send(BAD_AD);

    const body = res.body as ScoreResponse;
    expect(body.rewrittenTitle).toBe('Senior Backend Engineer');
    expect(body.notes).toEqual(['State the salary band']);
    // The model never moves the score.
    expect(body.score).toBe(0);
    expect(body.flaggedTerms.map((term) => term.term)).toContain('rockstar');
  });

  it('keeps the score when the model fails twice', async () => {
    const llm: LlmClient = {
      model: 'test-model',
      generateJson: vi.fn(async () => 'not json'),
    };

    const res = await request(appWithLlm(llm)).post('/api/jobs/score').send(GOOD_AD);

    const body = res.body as ScoreResponse;
    expect(body.score).toBe(100);
    expect(body.rewrittenTitle).toBeNull();
    expect(llm.generateJson).toHaveBeenCalledTimes(2);
  });

  it('rejects a body that is missing the description', async () => {
    const res = await request(appWithLlm(null)).post('/api/jobs/score').send({ title: 'Backend Engineer' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
