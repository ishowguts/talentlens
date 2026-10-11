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
          Find roles that fit your experience and see which requested skills are missing from your resume.
        </p>
      </section>

      <ResumeUpload onMatched={setResponse} />

      {response && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">{response.matches.length} matches</h2>
            {!response.reranked && (
              <p className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
                Ranked by similarity. Detailed fit explanations are temporarily unavailable.
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {response.matches.map((match, index) => (
              <MatchResultCard key={match.job.id} match={match} position={index + 1} />
            ))}
          </ul>

          <p className="text-xs text-stone-500">
            Your resume text, its numerical representation, and match results are stored so repeat uploads can
            reuse earlier results.
          </p>
        </section>
      )}
    </div>
  );
}
