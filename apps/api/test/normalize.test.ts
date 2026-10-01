import { describe, expect, it } from 'vitest';
import { jobContentHash, resumeTextHash } from '../src/lib/hash.js';
import { collapseWhitespace, snippet, stripHtml } from '../src/lib/text.js';
import {
  detectRemote,
  normalizeCompanyName,
  parseDate,
  parseSalary,
  toIso2Country,
} from '../src/ingest/normalize.js';

describe('stripHtml', () => {
  it('turns markup into plain text and keeps list items countable', () => {
    const html = '<p>Build things.</p><ul><li>React</li><li>Node</li></ul>';

    expect(stripHtml(html)).toBe('Build things.\n\n- React\n- Node');
  });

  it('decodes entities and drops scripts', () => {
    expect(stripHtml('<script>alert(1)</script><p>Tom &amp; Jerry&nbsp;Ltd</p>')).toBe('Tom & Jerry Ltd');
  });

  it('removes a trailing unterminated tag', () => {
    expect(stripHtml('<p>Senior role</p><div class="x" style="color: re')).toBe('Senior role');
  });
});

describe('collapseWhitespace and snippet', () => {
  it('collapses runs of whitespace', () => {
    expect(collapseWhitespace('  a \t b \n\n\n c  ')).toBe('a b\n\nc');
  });

  it('cuts a snippet on a word boundary', () => {
    const text = 'one two three four five six seven eight nine ten';

    const result = snippet(text, 20);

    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result).toBe('one two three four…');
  });
});

describe('parseSalary', () => {
  const cases: Array<[string, { min: number | null; max: number | null; currency: string | null }]> = [
    ['$90k - $105k', { min: 90_000, max: 105_000, currency: 'USD' }],
    ['$10K-$20K', { min: 10_000, max: 20_000, currency: 'USD' }],
    ['OTE $25k - $35k', { min: 25_000, max: 35_000, currency: 'USD' }],
    ['£45,000 - £55,000', { min: 45_000, max: 55_000, currency: 'GBP' }],
    ['€60000', { min: 60_000, max: null, currency: 'EUR' }],
    ['$90 - $150 /hour', { min: 187_200, max: 312_000, currency: 'USD' }],
    ['5000 per month', { min: 60_000, max: null, currency: null }],
    ['120000 INR', { min: 120_000, max: null, currency: 'INR' }],
  ];

  it.each(cases)('parses %s', (input, expected) => {
    expect(parseSalary(input)).toEqual(expected);
  });

  it('returns null for text with no usable figure', () => {
    expect(parseSalary('Competitive')).toBeNull();
    expect(parseSalary('')).toBeNull();
    expect(parseSalary(null)).toBeNull();
    // An hourly rate only converts when the text says so in a form the parser recognizes.
    expect(parseSalary('$12 an hour and 5 days holiday')).toBeNull();
  });

  it('drops implausible annual figures', () => {
    expect(parseSalary('$20')).toBeNull();
  });
});

describe('toIso2Country', () => {
  it('maps names, aliases and codes', () => {
    expect(toIso2Country('USA')).toBe('US');
    expect(toIso2Country('United Kingdom')).toBe('GB');
    expect(toIso2Country('india')).toBe('IN');
    expect(toIso2Country('gb')).toBe('GB');
    expect(toIso2Country('Bengaluru, India')).toBe('IN');
  });

  it('stays null for regions and country lists', () => {
    expect(toIso2Country('Worldwide')).toBeNull();
    expect(toIso2Country('USA, Canada, Argentina, Mexico, Peru')).toBeNull();
    expect(toIso2Country('Northern America, LATAM, Europe, APAC')).toBeNull();
    expect(toIso2Country(null)).toBeNull();
  });
});

describe('detectRemote', () => {
  it('trusts the source flag', () => {
    expect(detectRemote(null, true)).toBe(true);
  });

  it('reads the location text', () => {
    expect(detectRemote('Remote - Europe')).toBe(true);
    expect(detectRemote('Work from home')).toBe(true);
    expect(detectRemote('London, UK')).toBe(false);
  });
});

describe('parseDate', () => {
  it('treats a naive timestamp as UTC', () => {
    expect(parseDate('2026-09-21T12:55:11')?.toISOString()).toBe('2026-09-21T12:55:11.000Z');
  });

  it('returns null for junk', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('normalizeCompanyName', () => {
  it('lower-cases and collapses spaces', () => {
    expect(normalizeCompanyName('  Acme   Corp ')).toBe('acme corp');
  });
});

describe('jobContentHash', () => {
  const job = {
    title: 'Senior React Developer',
    company: 'Acme Corp',
    location: 'Remote',
    description: 'Build web applications with React and TypeScript.',
  };

  it('is stable and case-insensitive', () => {
    const other = { ...job, title: 'SENIOR REACT DEVELOPER', company: '  acme corp  ' };

    expect(jobContentHash(job)).toBe(jobContentHash(other));
    expect(jobContentHash(job)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the content changes', () => {
    expect(jobContentHash({ ...job, title: 'Junior React Developer' })).not.toBe(jobContentHash(job));
  });

  it('ignores description text past 2000 characters', () => {
    const long = { ...job, description: 'x'.repeat(2500) };
    const longer = { ...job, description: `${'x'.repeat(2500)} and more` };

    expect(jobContentHash(long)).toBe(jobContentHash(longer));
  });
});

describe('resumeTextHash', () => {
  it('ignores whitespace and case', () => {
    expect(resumeTextHash('Hello   World')).toBe(resumeTextHash('hello world'));
  });
});
