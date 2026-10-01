import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, getJob } from '../../../lib/api';
import { formatPostedAt, formatSalary } from '../../../lib/format';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<'remotive' | 'adzuna', string> = {
  remotive: 'via Remotive',
  adzuna: 'via Adzuna',
};

export default async function JobPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let job;
  try {
    job = await getJob(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const posted = formatPostedAt(job.postedAt);

  return (
    <article className="space-y-5">
      <Link href="/" className="text-sm text-stone-600 hover:text-stone-900">
        ← Back to search
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="text-stone-600">
          {job.company}
          {job.location ? ` · ${job.location}` : ''}
          {job.isRemote ? ' · Remote' : ''}
          {job.country ? ` · ${job.country}` : ''}
        </p>
        <p className="flex flex-wrap gap-x-3 text-sm text-stone-500">
          {salary && <span>{salary}</span>}
          {posted && <span>Posted {posted}</span>}
          <span>{SOURCE_LABEL[job.source]}</span>
        </p>
      </header>

      <a
        href={job.url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-block rounded-md bg-stone-900 px-4 py-2 text-white hover:bg-stone-700"
      >
        Open the original posting
      </a>

      <div className="whitespace-pre-line rounded-lg border border-stone-200 bg-white p-5 leading-relaxed">
        {job.description}
      </div>

      <p className="text-xs text-stone-500">
        This description is stored as plain text from the source API. The original posting is the authority.
      </p>
    </article>
  );
}
