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
          : 'The search API could not be reached. Is it running on port 4000?';
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
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Semantic job search</h1>
        <p className="text-stone-600">
          Keyword search, vector search, or both fused by rank. Compare the modes on the same query.
        </p>
      </section>

      <SearchForm values={values} />

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      {!values.q && !error && (
        <p className="text-sm text-stone-600">
          Try “senior react developer”, “build data pipelines in python”, or “frontend role that pays well,
          remote”.
        </p>
      )}

      {response && (
        <>
          <p className="text-sm text-stone-500">
            {response.results.length === 0
              ? 'No jobs matched.'
              : `Showing ${response.results.length} ${values.mode} results in ${response.latencyMs} ms.`}
          </p>

          {response.results.length === 0 ? (
            <p className="text-sm text-stone-600">
              Try fewer filters, or switch to hybrid mode, which also matches on meaning.
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
