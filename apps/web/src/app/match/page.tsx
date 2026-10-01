'use client';

import { useState } from 'react';
import type { MatchResponse } from 'shared';
import { MatchResultCard } from '../../components/MatchResultCard';
import { ResumeUpload } from '../../components/ResumeUpload';

export default function MatchPage() {
  const [response, setResponse] = useState<MatchResponse | null>(null);

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Match a resume to jobs</h1>
        <p className="text-stone-600">
          The resume is embedded, compared against every posting, and the top 20 are then ranked for fit.
        </p>
      </section>

      <ResumeUpload onMatched={setResponse} />

      {response && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">{response.matches.length} matches</h2>
            {!response.reranked && (
              <p className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
                Ranked by similarity only: the explanation model was unavailable or its answer was rejected.
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {response.matches.map((match, index) => (
              <MatchResultCard key={match.job.id} match={match} position={index + 1} />
            ))}
          </ul>

          <p className="text-xs text-stone-500">
            Nothing from the resume is stored beyond its text and vector, which are reused if the same resume
            is uploaded again.
          </p>
        </section>
      )}
    </div>
  );
}
