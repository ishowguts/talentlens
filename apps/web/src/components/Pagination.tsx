import Link from 'next/link';

/** Previous and next links that keep every other query parameter intact. */
export function Pagination({
  params,
  page,
  hasMore,
}: {
  params: Record<string, string>;
  page: number;
  hasMore: boolean;
}) {
  const href = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete('page');
    else next.set('page', String(target));
    return `/?${next.toString()}`;
  };

  if (page === 1 && !hasMore) return null;

  return (
    <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-md border border-stone-300 px-3 py-1.5 bg-white">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-stone-500">Page {page}</span>
      {hasMore ? (
        <Link href={href(page + 1)} className="rounded-md border border-stone-300 px-3 py-1.5 bg-white">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
