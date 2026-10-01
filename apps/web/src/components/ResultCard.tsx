'use client';

import Link from 'next/link';
import type { SearchResult } from 'shared';
import { logClick } from '../lib/api';
import { formatPostedAt, formatSalary } from '../lib/format';

/** One result. Opening it logs the click against the search, which is how result quality is judged later. */
export function ResultCard({ result, logId }: { result: SearchResult; logId: number }) {
  const { job, ranks } = result;
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const posted = formatPostedAt(job.postedAt);

  return (
    <li className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">
          <Link href={`/jobs/${job.id}`} onClick={() => logClick(logId, job.id)} className="hover:underline">
            {job.title}
          </Link>
        </h3>
        <div className="flex shrink-0 gap-1 text-xs">
          {ranks.keyword !== null && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900" title="Keyword rank">
              kw #{ranks.keyword}
            </span>
          )}
          {ranks.vector !== null && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-900" title="Vector rank">
              vec #{ranks.vector}
            </span>
          )}
        </div>
      </div>

      <p className="mt-0.5 text-sm text-stone-600">
        {job.company}
        {job.location ? ` · ${job.location}` : ''}
        {job.isRemote ? ' · Remote' : ''}
      </p>

      <p className="mt-2 text-sm text-stone-700">{job.snippet}</p>

      <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-stone-500">
        {salary && <span>{salary}</span>}
        {posted && <span>Posted {posted}</span>}
        <span>score {result.score.toFixed(4)}</span>
      </p>
    </li>
  );
}
