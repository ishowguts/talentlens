'use client';

import { useState } from 'react';
import type { ScoreResponse } from 'shared';
import { ApiRequestError, scoreJobAd } from '../../lib/api';

type Status = 'idle' | 'loading';

export default function ScorePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResponse | null>(null);

  const ready = title.trim().length >= 3 && description.trim().length >= 50;

  async function submit() {
    setStatus('loading');
    setError(null);
    try {
      setResult(
        await scoreJobAd({
          title: title.trim(),
          description: description.trim(),
          ...(location.trim() ? { location: location.trim() } : {}),
          ...(salaryMin ? { salaryMin: Number(salaryMin) } : {}),
          ...(salaryMax ? { salaryMax: Number(salaryMax) } : {}),
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.code === 'RATE_LIMITED'
            ? 'Only ten adverts a minute. Wait a moment and try again.'
            : caught.message
          : 'The API could not be reached. Is it running on port 4000?',
      );
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Score a job advert</h1>
        <p className="text-stone-600">
          Seven rules, each worth a fixed number of points. The score is the same every time for the same
          advert; only the title rewrite and the notes come from a model.
        </p>
      </section>

      <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm">
            Job title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={150}
              placeholder="Senior Backend Engineer, Payments"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="text-sm sm:w-56">
            Location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Bristol, United Kingdom"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <label className="text-sm">
            Salary from
            <input
              type="number"
              value={salaryMin}
              onChange={(event) => setSalaryMin(event.target.value)}
              min={0}
              step={1000}
              className="mt-1 w-32 rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Salary to
            <input
              type="number"
              value={salaryMax}
              onChange={(event) => setSalaryMax(event.target.value)}
              min={0}
              step={1000}
              className="mt-1 w-32 rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          Advert text
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={12}
            maxLength={20_000}
            placeholder="Paste the advert here"
            className="mt-1 w-full rounded-md border border-stone-300 p-2 text-sm"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!ready || status === 'loading'}
            onClick={() => void submit()}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {status === 'loading' ? 'Scoring…' : 'Score this advert'}
          </button>
          <span className="text-xs text-stone-500">
            {description.trim().length} characters{ready ? '' : ' · title and at least 50 characters needed'}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold tabular-nums">{result.score}</span>
            <span className="text-stone-500">out of 100</span>
          </div>

          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {result.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-3 p-3">
                <span
                  aria-hidden
                  className={check.pass ? 'text-emerald-700' : 'text-red-700'}
                  title={check.pass ? 'Passed' : 'Failed'}
                >
                  {check.pass ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {check.label}
                    <span className="ml-2 text-xs font-normal text-stone-500">
                      {check.pass ? `+${check.weight}` : `0 / ${check.weight}`}
                    </span>
                  </p>
                  <p className="text-sm text-stone-600">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          {result.flaggedTerms.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-medium">Wording to change</h2>
              <ul className="space-y-2">
                {result.flaggedTerms.map((flagged) => (
                  <li
                    key={flagged.term}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                  >
                    <p className="font-medium">“{flagged.term}”</p>
                    <p className="text-stone-700">{flagged.reason}</p>
                    <p className="mt-1 text-stone-700">
                      <span className="text-stone-500">Instead: </span>
                      {flagged.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.rewrittenTitle && (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-medium text-stone-500">Suggested title</h2>
              <p className="mt-1">{result.rewrittenTitle}</p>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-medium text-stone-500">Suggested edits</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {result.rewrittenTitle === null && (
            <p className="text-xs text-stone-500">
              No written suggestions: the model was unavailable or its answer was rejected. The score above
              does not depend on it.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
