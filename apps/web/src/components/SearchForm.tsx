import { SEARCH_MODES, type SearchMode } from 'shared';

export interface SearchFormValues {
  q: string;
  mode: SearchMode;
  remote: boolean;
  country: string;
  salaryMin: string;
}

const MODE_HINT: Record<SearchMode, string> = {
  hybrid: 'Keyword and meaning, fused by rank',
  vector: 'Meaning only, from embeddings',
  keyword: 'Words in the advert only',
};

/** A plain GET form: the URL holds the whole query, so results are shareable and need no client state. */
export function SearchForm({ values }: { values: SearchFormValues }) {
  return (
    <form method="get" action="/" className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={values.q}
          placeholder="frontend role that pays well, remote"
          aria-label="Search jobs"
          maxLength={200}
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
        />
        <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Search mode</legend>
          {SEARCH_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-1.5" title={MODE_HINT[mode]}>
              <input type="radio" name="mode" value={mode} defaultChecked={values.mode === mode} />
              <span className="capitalize">{mode}</span>
            </label>
          ))}
        </fieldset>

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

      <p className="text-xs text-stone-500">{MODE_HINT[values.mode]}</p>
    </form>
  );
}
