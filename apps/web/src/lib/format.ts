/** "£85,000 - £105,000" or "from $120,000", or null when the advert gave no figure. */
export function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (min === null && max === null) return null;
  const format = (value: number) =>
    new Intl.NumberFormat('en', {
      style: currency ? 'currency' : 'decimal',
      currency: currency ?? undefined,
      maximumFractionDigits: 0,
    }).format(value);

  if (min !== null && max !== null && max > min) return `${format(min)} – ${format(max)}`;
  const single = min ?? max;
  return single === null ? null : `from ${format(single)}`;
}

/** "3 days ago", or null when the source gave no date. */
export function formatPostedAt(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'last month' : `${months} months ago`;
}
