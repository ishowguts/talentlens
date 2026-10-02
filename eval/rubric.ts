// The relevance rubric the automated judge applies. See docs/ARCHITECTURE.md section 8 and ADR-017.
// Wording is fixed and versioned: changing it invalidates cached labels, so the version is stored with them.

export const RUBRIC_VERSION = 1;

/** One rule per query type, on top of the shared standard below. */
export const RUBRIC_BY_GROUP = {
  title: [
    'This query names a role. A job is relevant when its title is that role, or an obvious equivalent of it',
    '(for example "Front End Developer" for "frontend engineer", or "SRE" for "site reliability engineer").',
    'A different specialism is not relevant, even in the same field: a backend role does not answer a frontend',
    'query. A seniority mismatch is not relevant when the query states one: a junior post does not answer',
    '"senior X", and a manager post does not answer an individual-contributor query.',
  ],
  skill: [
    'This query describes work the person wants to do. A job is relevant when doing that job plainly involves',
    'that work, whatever the title says. The stated technologies matter: a query naming Python and pipelines is',
    'not answered by a job that is entirely Java and web front ends. A job that merely mentions the technology',
    'in passing, in a long list of nice-to-haves, is not relevant.',
  ],
  vague: [
    'This query states a preference or a constraint rather than a role. Judge the constraint strictly and the',
    'role loosely: any role a person could plausibly want is acceptable, but a stated constraint that the job',
    'violates makes it not relevant. "Remote" means the job is remote. "Pays well" means a salary is stated and',
    'is at or above the usual market rate for that role. A named country or region means the job is open there.',
    'When the query names no constraint at all, fall back on whether the role matches the intent described.',
  ],
} as const;

export type RubricGroup = keyof typeof RUBRIC_BY_GROUP;

/** The standard every query type is judged against. */
export const RUBRIC_STANDARD = [
  'Decide one thing: would a job seeker who typed this query want to click this posting?',
  'Mark a job relevant only when the answer is clearly yes.',
  'Mark it not relevant when it is in the wrong field, is the wrong role, or violates a constraint the query',
  'states (remote, pay, seniority, location).',
  'Judge the posting on what it says, not on what it might mean. A vague posting that could be anything is not',
  'relevant. Do not reward a job for repeating the query words if the work itself does not match.',
  'An advert that is clearly spam, or that is an agency listing with no actual role described, is not relevant.',
].join(' ');

export function rubricFor(group: RubricGroup): string {
  return `${RUBRIC_STANDARD}\n\nFor this query type:\n${RUBRIC_BY_GROUP[group].join(' ')}`;
}
