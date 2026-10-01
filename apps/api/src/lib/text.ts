// Text helpers shared by ingestion and the API responses.

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&hellip;': '…',
};

function decodeEntities(input: string): string {
  return input
    .replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp|mdash|ndash|rsquo|lsquo|hellip);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)));
}

/** Collapse runs of whitespace, keep single newlines and at most one blank line, and trim. */
export function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Turn a job description's HTML into plain text. Block-level tags become newlines and list items keep a
 * bullet, so requirement lists stay countable (the scorer rules in ARCHITECTURE section 7.5 rely on that).
 */
export function stripHtml(input: string): string {
  const withBreaks = input
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr|table|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    // Adzuna truncates its descriptions mid-markup, so a trailing unterminated tag is normal.
    .replace(/<[^>]*$/, ' ');
  return collapseWhitespace(decodeEntities(withBreaks));
}

/** First `maxChars` of text, cut on a word boundary, for list views. */
export function snippet(input: string, maxChars = 220): string {
  const text = collapseWhitespace(input.replace(/\n+/g, ' '));
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
