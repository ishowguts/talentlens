import { SEARCH_MODES, type SearchMode } from 'shared';

export interface SearchFormValues {
  q: string;
  mode: SearchMode;
  remote: boolean;
  country: string;
  salaryMin: string;
}

const MODE_HINT: Record<SearchMode, string> = {
  hybrid: 'Match your keywords and related experience',
  vector: 'Find related roles even when the wording differs',
  keyword: 'Match words in the job advert',
};

/** A plain GET form: the URL holds the whole query, so results are shareable and need no client state. */
export function SearchForm({ values }: { values: SearchFormValues }) {
  return (
    <form method="get" action="/" className="search-panel">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={values.q}
          placeholder="Job title, skill, or type of work"
          aria-label="Search jobs"
          maxLength={200}
          className="search-input"
        />
        <button type="submit" className="primary-button">
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <fieldset className="search-modes">
          <legend className="sr-only">Search mode</legend>
          {SEARCH_MODES.map((mode) => (
            <label key={mode} className="search-mode" title={MODE_HINT[mode]}>
              <input type="radio" name="mode" value={mode} defaultChecked={values.mode === mode} />
              <span>
                {mode === 'hybrid' ? 'Keywords + meaning' : mode === 'vector' ? 'Meaning' : 'Keywords'}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="filter-row">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="remote" value="true" defaultChecked={values.remote} />
          Remote only
        </label>

        <label className="flex items-center gap-1.5">
          Country
          <input
            type="text"
            name="country"
            defaultValue={values.country}
            placeholder="GB"
            maxLength={2}
            className="w-16 rounded-md border border-stone-300 px-2 py-1 uppercase"
          />
        </label>

        <label className="flex items-center gap-1.5">
          Min salary
          <input
            type="number"
            name="salaryMin"
            defaultValue={values.salaryMin}
            min={0}
            step={1000}
            className="w-28 rounded-md border border-stone-300 px-2 py-1"
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-stone-500">
        Keywords match the advert’s wording. Meaning also finds related roles. Combine both to compare their
        rankings.
      </p>
    </form>
  );
}
