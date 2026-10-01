// Field-level normalization shared by every source client. See docs/ARCHITECTURE.md section 7.1.

/** Hours in a working year, used to turn an hourly rate into an annual figure. */
const HOURS_PER_YEAR = 2080;

/** Annual salaries outside this range are treated as unparseable rather than guessed. */
const MIN_ANNUAL = 1_000;
const MAX_ANNUAL = 10_000_000;

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '₨': 'INR',
};

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'CHF', 'SEK', 'PLN', 'SGD', 'BRL', 'ZAR'];

/** Country names and aliases seen in the two sources, mapped to ISO-3166 alpha-2. */
const COUNTRY_TO_ISO2: Record<string, string> = {
  usa: 'US',
  us: 'US',
  'united states': 'US',
  'united states of america': 'US',
  uk: 'GB',
  gb: 'GB',
  'united kingdom': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  india: 'IN',
  canada: 'CA',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  netherlands: 'NL',
  'the netherlands': 'NL',
  belgium: 'BE',
  poland: 'PL',
  portugal: 'PT',
  ireland: 'IE',
  romania: 'RO',
  ukraine: 'UA',
  switzerland: 'CH',
  austria: 'AT',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  czechia: 'CZ',
  'czech republic': 'CZ',
  greece: 'GR',
  turkey: 'TR',
  israel: 'IL',
  'united arab emirates': 'AE',
  uae: 'AE',
  'saudi arabia': 'SA',
  egypt: 'EG',
  nigeria: 'NG',
  kenya: 'KE',
  'south africa': 'ZA',
  brazil: 'BR',
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  mexico: 'MX',
  peru: 'PE',
  australia: 'AU',
  'new zealand': 'NZ',
  japan: 'JP',
  china: 'CN',
  'south korea': 'KR',
  singapore: 'SG',
  malaysia: 'MY',
  indonesia: 'ID',
  philippines: 'PH',
  vietnam: 'VN',
  thailand: 'TH',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  nepal: 'NP',
};

/** Company name reduced to its dedupe key: lower case, trimmed, single spaces. */
export function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * ISO-3166 alpha-2 for a location string, or null when it is a region, a list of countries, or unknown.
 * Guessing a country from "Northern America, LATAM, Europe, APAC" would be wrong, so it stays null.
 */
export function toIso2Country(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();

  const direct = COUNTRY_TO_ISO2[text.toLowerCase()];
  if (direct) return direct;

  // "Bengaluru, India" or "London, United Kingdom": with exactly two segments the last one is the country.
  // Longer lists ("USA, Canada, Argentina, Mexico, Peru") name several countries or regions, so they stay null.
  const parts = text.split(',').map((part) => part.trim());
  if (parts.length === 2) {
    const [first, last] = parts as [string, string];
    const firstIsCountry = Boolean(COUNTRY_TO_ISO2[first.toLowerCase()]);
    const lastIso = COUNTRY_TO_ISO2[last.toLowerCase()];
    if (lastIso && !firstIsCountry) return lastIso;
  }
  return null;
}

/** True when the source flags the job as remote or the location says so. */
export function detectRemote(location: string | null | undefined, sourceFlag = false): boolean {
  if (sourceFlag) return true;
  return /\b(remote|work from home|wfh|anywhere|worldwide|distributed)\b/i.test(location ?? '');
}

/** A number written as "90", "90k", "35,3k", "120,000" or "1.2m". */
function parseAmount(raw: string, suffix: string | undefined): number | null {
  // A comma followed by exactly three digits is a thousands separator; otherwise it is a decimal comma.
  const cleaned = /,\d{3}(?!\d)/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  const multiplier = suffix?.toLowerCase() === 'k' ? 1_000 : suffix?.toLowerCase() === 'm' ? 1_000_000 : 1;
  return value * multiplier;
}

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

/**
 * Best-effort parse of a free-text salary into annual figures, as section 7.1 requires.
 * Hourly and monthly rates are converted; anything that does not yield a plausible annual number is dropped.
 */
export function parseSalary(input: string | null | undefined): ParsedSalary | null {
  if (!input) return null;
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const symbol = Object.keys(CURRENCY_SYMBOLS).find((s) => text.includes(s));
  const code = CURRENCY_CODES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(text));
  const currency = code?.toUpperCase() ?? (symbol ? CURRENCY_SYMBOLS[symbol] : undefined) ?? null;

  const perHour = /\/\s*h(our|r)?\b|\bper hour\b|\bhourly\b/i.test(text);
  const perMonth = /\/\s*(month|mo)\b|\bper month\b|\bmonthly\b|\bpm\b/i.test(text);

  const amounts: number[] = [];
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s*([kKmM])?\b/g)) {
    const amount = parseAmount(match[1] ?? '', match[2]);
    if (amount === null) continue;
    const annual = perHour ? amount * HOURS_PER_YEAR : perMonth ? amount * 12 : amount;
    if (annual >= MIN_ANNUAL && annual <= MAX_ANNUAL) amounts.push(Math.round(annual));
  }

  if (amounts.length === 0) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { min, max: max > min ? max : null, currency };
}

/** Parse a source timestamp, returning null rather than an invalid date. */
export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  // Remotive sends naive timestamps ("2026-09-21T12:55:11"); treat them as UTC.
  const text = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(input) ? `${input}Z` : input;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
