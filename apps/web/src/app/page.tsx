import Link from 'next/link';
import { searchModeSchema, type SearchResponse } from 'shared';
import { ApiRequestError, searchJobs } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { ResultCard } from '../components/ResultCard';
import { SearchForm, type SearchFormValues } from '../components/SearchForm';

/** Results depend on the query string and on live data, so this page is never statically cached. */
export const dynamic = 'force-dynamic';

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

function readValues(params: RawParams): SearchFormValues {
  const mode = searchModeSchema.safeParse(first(params.mode));
  return {
    q: first(params.q).slice(0, 200),
    mode: mode.success ? mode.data : 'hybrid',
    remote: first(params.remote) === 'true',
    country: first(params.country).toUpperCase().slice(0, 2),
    salaryMin: first(params.salaryMin).replace(/\D/g, ''),
  };
}

export default async function SearchPage({ searchParams }: { searchParams: RawParams }) {
  const values = readValues(searchParams);
  const page = Math.max(1, Number(first(searchParams.page)) || 1);

  let response: SearchResponse | null = null;
  let error: string | null = null;

  if (values.q) {
    try {
      response = await searchJobs({
        q: values.q,
        mode: values.mode,
        remote: values.remote,
        country: values.country || undefined,
        salaryMin: values.salaryMin ? Number(values.salaryMin) : undefined,
        page,
      });
    } catch (caught) {
      error =
        caught instanceof ApiRequestError
          ? caught.code === 'RATE_LIMITED'
            ? 'Too many searches in the last minute. Wait a moment and try again.'
            : caught.message
          : 'Search is temporarily unavailable. Please try again in a moment.';
    }
  }

  const queryParams: Record<string, string> = {};
  if (values.q) queryParams.q = values.q;
  if (values.mode !== 'hybrid') queryParams.mode = values.mode;
  if (values.remote) queryParams.remote = 'true';
  if (values.country) queryParams.country = values.country;
  if (values.salaryMin) queryParams.salaryMin = values.salaryMin;

  return (
    <div className="space-y-6">
      <section className="page-header">
        <p className="eyebrow">A closer look at your next role</p>
        <h1 className="page-title">
          Good work starts
          <br className="hidden sm:block" /> with the right fit.
        </h1>
        <p className="page-description">
          Search real job postings by title, skills, or the work you want to do. Compare exact keywords with
          matches based on meaning.
        </p>
      </section>

      <SearchForm values={values} />

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      {!values.q && !error && (
        <div className="space-y-10 pt-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-stone-500">Try a search</span>
            <Link className="quiet-link" href="/?q=senior+react+developer">
              Senior React developer
            </Link>
            <Link className="quiet-link" href="/?q=data+pipelines+python">
              Data pipelines in Python
            </Link>
            <Link className="quiet-link" href="/?q=frontend+engineer&remote=true">
              Remote frontend roles
            </Link>
          </div>
          <div className="grid gap-8 border-t border-stone-300/70 pt-8 sm:grid-cols-2">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Start with your experience.</h2>
              <p className="text-sm leading-relaxed text-stone-600">
                Use your resume to find relevant roles and see which requested skills it does not yet show.
              </p>
              <Link className="quiet-link inline-block pt-2" href="/match">
                Match a resume <span aria-hidden="true">↗</span>
              </Link>
            </section>
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Hiring for a role?</h2>
              <p className="text-sm leading-relaxed text-stone-600">
                Check an advert for useful details, clear requirements, and wording that may discourage
                applicants.
              </p>
              <Link className="quiet-link inline-block pt-2" href="/score">
                Review a job advert <span aria-hidden="true">↗</span>
              </Link>
            </section>
          </div>
        </div>
      )}

      {response && (
        <>
          <p role="status" className="border-b border-stone-300/70 pb-4 text-sm text-stone-500">
            {response.results.length === 0
              ? 'No jobs matched.'
              : `Showing ${response.results.length} ${response.results.length === 1 ? 'job' : 'jobs'} · ${response.latencyMs} ms`}
          </p>

          {response.results.length === 0 ? (
            <p className="empty-note">
              Try fewer filters, or choose Keywords + meaning to include related roles.
            </p>
          ) : (
            <ul className="space-y-3">
              {response.results.map((result) => (
                <ResultCard key={result.job.id} result={result} logId={response.logId} />
              ))}
            </ul>
          )}

          <Pagination params={queryParams} page={response.page} hasMore={response.hasMore} />
        </>
      )}
    </div>
  );
}
