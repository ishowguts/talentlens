// Wording that narrows an applicant pool, with a neutral replacement for each.
// Used by the job ad scorer's `inclusive` check (docs/ARCHITECTURE.md section 7.5).

export interface BiasTerm {
  /** Matched case-insensitively on word boundaries. */
  term: string;
  reason: string;
  suggestion: string;
}

export const BIAS_TERMS: readonly BiasTerm[] = [
  {
    term: 'rockstar',
    reason: 'Industry slang that signals a bro culture and deters experienced applicants.',
    suggestion: 'Name the skill level you need, for example "senior engineer".',
  },
  {
    term: 'ninja',
    reason: 'Industry slang that says nothing about the work.',
    suggestion: 'Describe the actual responsibility instead.',
  },
  {
    term: 'guru',
    reason: 'Vague seniority claim that sets no measurable bar.',
    suggestion: 'State the years of experience or the specific expertise.',
  },
  {
    term: 'superstar',
    reason: 'Hype wording that filters for confidence rather than ability.',
    suggestion: 'Describe the outcome the role owns.',
  },
  {
    term: 'wizard',
    reason: 'Slang that hides what the role actually requires.',
    suggestion: 'List the tools and the depth you need.',
  },
  {
    term: 'aggressive',
    reason: 'Reads as a demand for a combative style and discourages many applicants.',
    suggestion: 'Say "ambitious targets" or describe the pace of the work.',
  },
  {
    term: 'young',
    reason: 'Age-related wording, and unlawful as a requirement in many places.',
    suggestion: 'Describe the experience level, not the age.',
  },
  {
    term: 'youthful',
    reason: 'Age-related wording.',
    suggestion: 'Describe the team or the culture without implying an age.',
  },
  {
    term: 'digital native',
    reason: 'A proxy for age rather than a skill.',
    suggestion: 'Name the tools the person must be comfortable with.',
  },
  {
    term: 'recent graduate',
    reason: 'A proxy for age; it also excludes career changers.',
    suggestion: 'Say "no prior industry experience required".',
  },
  {
    term: 'he/she',
    reason: 'Gendered construction that leaves people out.',
    suggestion: 'Use "you" or "they".',
  },
  {
    term: 'his/her',
    reason: 'Gendered construction that leaves people out.',
    suggestion: 'Use "your" or "their".',
  },
  {
    term: 'salesman',
    reason: 'Gendered job title.',
    suggestion: 'Use "salesperson".',
  },
  {
    term: 'manpower',
    reason: 'Gendered collective noun.',
    suggestion: 'Use "staffing" or "people".',
  },
  {
    term: 'chairman',
    reason: 'Gendered job title.',
    suggestion: 'Use "chair".',
  },
  {
    term: 'work hard play hard',
    reason: 'Signals long hours and a drinking culture; it excludes carers.',
    suggestion: 'Describe the working pattern and the benefits honestly.',
  },
  {
    term: 'hungry',
    reason: 'Reads as a demand for unpaid extra effort.',
    suggestion: 'Say what drive looks like in the role, for example ownership of a product area.',
  },
  {
    term: 'native speaker',
    reason: 'Excludes fluent speakers and can be discriminatory.',
    suggestion: 'State the level needed, for example "fluent written English".',
  },
  {
    term: 'cultural fit',
    reason: 'Open-ended criterion that tends to favour people like the existing team.',
    suggestion: 'List the specific values or working practices you assess.',
  },
];

export interface FlaggedTerm {
  term: string;
  reason: string;
  suggestion: string;
}

/** Every bias term present in the text, once each, in the order they are defined. */
export function findBiasTerms(text: string): FlaggedTerm[] {
  const found: FlaggedTerm[] = [];
  for (const entry of BIAS_TERMS) {
    const pattern = new RegExp(`\\b${entry.term.replace(/[/\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(text)) {
      found.push({ term: entry.term, reason: entry.reason, suggestion: entry.suggestion });
    }
  }
  return found;
}
