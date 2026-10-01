import Link from 'next/link';
import type { MatchResult } from 'shared';
import { formatSalary } from '../lib/format';

/** One matched job: fit score when the model ranked it, otherwise similarity alone. */
export function MatchResultCard({ match, position }: { match: MatchResult; position: number }) {
  const salary = formatSalary(match.job.salaryMin, match.job.salaryMax, match.job.salaryCurrency);

  return (
    <li className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">
            <Link href={`/jobs/${match.job.id}`} className="hover:underline">
              {position}. {match.job.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-stone-600">
            {match.job.company}
            {match.job.location ? ` · ${match.job.location}` : ''}
            {match.job.isRemote ? ' · Remote' : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {match.fitScore === null ? (
            <span className="text-xs text-stone-500">similarity {match.vectorScore.toFixed(3)}</span>
          ) : (
            <>
              <span className="block text-lg font-semibold tabular-nums">{match.fitScore}</span>
              <span className="text-xs text-stone-500">fit score</span>
            </>
          )}
        </div>
      </div>

      {match.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-stone-700">
          {match.reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden className="text-emerald-700">
                ✓
              </span>
              {reason}
            </li>
          ))}
        </ul>
      )}

      {match.missingSkills.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-stone-500">Not shown in the resume:</span>
          {match.missingSkills.map((skill) => (
            <span key={skill} className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
              {skill}
            </span>
          ))}
        </p>
      )}

      {salary && <p className="mt-2 text-xs text-stone-500">{salary}</p>}
    </li>
  );
}
