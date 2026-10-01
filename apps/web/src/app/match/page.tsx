'use client';

import { useState } from 'react';
import type { MatchResponse } from 'shared';
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
        <section className="space-y-2">
          <h2 className="text-lg font-medium">
            {response.matches.length} matches
            {response.reranked ? '' : ' (ranked by similarity only)'}
          </h2>
          <ul className="space-y-2">
            {response.matches.map((match) => (
              <li key={match.job.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="font-medium">{match.job.title}</p>
                <p className="text-sm text-stone-600">
                  {match.job.company}
                  {match.job.location ? ` · ${match.job.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
