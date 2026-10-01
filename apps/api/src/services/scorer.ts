// Job ad scorer. The score is deterministic and rules-only, so it is testable and explainable; the model only
// writes the title rewrite and the notes (ADR-007, docs/ARCHITECTURE.md section 7.5).
import type { ScoreCheck, ScoreCheckId, ScoreRequest, ScoreResponse } from 'shared';
import { scoreSuggestionSchema } from 'shared';
import { findBiasTerms } from '../lib/biasTerms.js';
import { generateValidated, type LlmClient } from './llm.js';

/** Weights from section 7.5. They add up to 100. */
export const CHECK_WEIGHTS: Record<ScoreCheckId, number> = {
  salary: 25,
  length: 15,
  title: 15,
  location: 10,
  requirements: 10,
  inclusive: 15,
  structure: 10,
};

const MIN_WORDS = 150;
const MAX_WORDS = 700;
const MAX_TITLE_CHARS = 60;
const MAX_REQUIREMENT_BULLETS = 10;

/** A currency amount, or the word salary next to a number. */
const SALARY_IN_TEXT = /[$£€₹]\s?\d|\b\d{1,3}(?:,\d{3})+\b|\b\d{2,3}\s?k\b|\bsalary\b[^.\n]{0,40}\d/i;
const ALL_CAPS_WORD = /\b[A-Z]{5,}\b/;
const EMOJI = /\p{Extended_Pictographic}/u;
const INTERNAL_CODE = /\b[A-Z]{2,}[-_ ]?\d{3,}\b/;
const BULLET_LINE = /^\s*(?:[-*•–]|\d+[.)])\s+\S/;

const SECTION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'responsibilities', pattern: /\b(responsibilit|what you.{0,3}ll do|the role|duties)\b/i },
  {
    name: 'requirements',
    pattern: /\b(requirement|qualification|what you.{0,3}ll need|must have|skills)\b/i,
  },
  { name: 'benefits', pattern: /\b(benefit|perks|what we offer|we provide)\b/i },
];

function check(id: ScoreCheckId, label: string, pass: boolean, detail: string): ScoreCheck {
  return { id, label, pass, detail, weight: CHECK_WEIGHTS[id] };
}

/** Run every rule. Pure: same input, same score. */
export function runChecks(ad: ScoreRequest): { checks: ScoreCheck[]; score: number } {
  const words = ad.description.split(/\s+/).filter(Boolean).length;
  const bulletLines = ad.description.split('\n').filter((line) => BULLET_LINE.test(line)).length;
  const sections = SECTION_PATTERNS.filter((section) => section.pattern.test(ad.description));
  const biasTerms = findBiasTerms(`${ad.title}\n${ad.description}`);

  const hasSalary = ad.salaryMin != null || ad.salaryMax != null || SALARY_IN_TEXT.test(ad.description);
  const titleProblems: string[] = [];
  if (ad.title.length > MAX_TITLE_CHARS)
    titleProblems.push(`${ad.title.length} characters, over ${MAX_TITLE_CHARS}`);
  if (ALL_CAPS_WORD.test(ad.title)) titleProblems.push('contains a word in all capitals');
  if (EMOJI.test(ad.title)) titleProblems.push('contains an emoji');
  if (INTERNAL_CODE.test(ad.title)) titleProblems.push('contains an internal requisition code');

  const statesLocation = Boolean(ad.location?.trim()) || /\bremote\b/i.test(`${ad.title} ${ad.description}`);

  const checks: ScoreCheck[] = [
    check(
      'salary',
      'Pay is stated',
      hasSalary,
      hasSalary
        ? 'A salary figure is given.'
        : 'No salary range. Adverts without pay get fewer and worse-matched applications.',
    ),
    check(
      'length',
      'Length is readable',
      words >= MIN_WORDS && words <= MAX_WORDS,
      `${words} words. Aim for ${MIN_WORDS}-${MAX_WORDS}.`,
    ),
    check(
      'title',
      'Title is searchable',
      titleProblems.length === 0,
      titleProblems.length === 0
        ? 'Short, plain and free of internal codes.'
        : `Title ${titleProblems.join('; ')}.`,
    ),
    check(
      'location',
      'Location or remote is stated',
      statesLocation,
      statesLocation
        ? 'Where the work happens is clear.'
        : 'Neither a location nor remote working is stated.',
    ),
    check(
      'requirements',
      'Requirement list is not overwhelming',
      bulletLines <= MAX_REQUIREMENT_BULLETS,
      `${bulletLines} bulleted lines. Over ${MAX_REQUIREMENT_BULLETS} puts people off applying.`,
    ),
    check(
      'inclusive',
      'Wording is inclusive',
      biasTerms.length === 0,
      biasTerms.length === 0
        ? 'No narrowing wording found.'
        : `Found: ${biasTerms.map((term) => term.term).join(', ')}.`,
    ),
    check(
      'structure',
      'Advert is structured',
      sections.length >= 2,
      sections.length >= 2
        ? `Has ${sections.map((section) => section.name).join(' and ')}.`
        : 'Add at least two of responsibilities, requirements and benefits.',
    ),
  ];

  const score = checks.reduce((total, item) => total + (item.pass ? item.weight : 0), 0);
  return { checks, score };
}

export interface ScorerDeps {
  llm: LlmClient | null;
  llmTimeoutMs: number;
}

function buildSuggestionPrompt(ad: ScoreRequest, checks: ScoreCheck[]): string {
  const failed = checks.filter((item) => !item.pass);
  return [
    'You improve job adverts. Answer with JSON only:',
    '{"rewrittenTitle":"...","notes":["..."]}',
    'rewrittenTitle: a plain, searchable title under 60 characters, no internal codes, no capitals shouting.',
    'notes: up to 5 short, concrete edits the author should make. No praise, no restating the advert.',
    '',
    `CURRENT TITLE: ${ad.title}`,
    failed.length > 0
      ? `FAILED CHECKS: ${failed.map((item) => `${item.id} (${item.detail})`).join('; ')}`
      : '',
    '',
    'ADVERT:',
    ad.description.slice(0, 6_000),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Score an advert. The score never depends on the model: a model failure leaves it untouched. */
export async function scoreJobAd(deps: ScorerDeps, ad: ScoreRequest): Promise<ScoreResponse> {
  const { checks, score } = runChecks(ad);
  const flaggedTerms = findBiasTerms(`${ad.title}\n${ad.description}`);

  let rewrittenTitle: string | null = null;
  let notes: string[] = [];

  if (deps.llm) {
    const result = await generateValidated(
      deps.llm,
      buildSuggestionPrompt(ad, checks),
      scoreSuggestionSchema,
      deps.llmTimeoutMs,
    );
    if (result.data) {
      rewrittenTitle = result.data.rewrittenTitle;
      notes = result.data.notes;
    } else {
      console.warn(
        `scorer: suggestions failed after ${result.attempts} attempts (${result.error ?? 'no reason'})`,
      );
    }
  }

  return { score, checks, flaggedTerms, rewrittenTitle, notes };
}
