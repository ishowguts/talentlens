'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import type { MatchResponse } from 'shared';
import { RESUME_PDF_MAX_BYTES, RESUME_TEXT_MAX, RESUME_TEXT_MIN } from 'shared';
import { ApiRequestError, matchResume } from '../lib/api';

type State = { status: 'idle' | 'loading' } | { status: 'error'; message: string };

/** Drop a PDF or paste text. The file is checked here too, so an obvious mistake costs no upload. */
export function ResumeUpload({ onMatched }: { onMatched: (response: MatchResponse) => void }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const textareaId = useId();

  const loading = state.status === 'loading';
  const error = state.status === 'error' ? state.message : null;

  async function submit(input: { file: File } | { text: string }) {
    setState({ status: 'loading' });
    try {
      onMatched(await matchResume(input));
      setState({ status: 'idle' });
    } catch (caught) {
      setState({
        status: 'error',
        message:
          caught instanceof ApiRequestError
            ? caught.code === 'RATE_LIMITED'
              ? 'Only five resumes a minute. Wait a moment and try again.'
              : caught.message
            : 'The API could not be reached. Is it running on port 4000?',
      });
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setState({ status: 'error', message: 'That file is not a PDF.' });
      return;
    }
    if (file.size > RESUME_PDF_MAX_BYTES) {
      setState({
        status: 'error',
        message: `That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`,
      });
      return;
    }
    void submit({ file });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files[0]);
  }

  const textTooShort = text.trim().length > 0 && text.trim().length < RESUME_TEXT_MIN;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center ${
          dragging ? 'border-stone-900 bg-stone-100' : 'border-stone-300 bg-white'
        }`}
      >
        <p className="text-stone-700">Drop a resume PDF here</p>
        <p className="mt-1 text-xs text-stone-500">
          PDF only, up to 2 MB. Scanned PDFs have no text to read.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => fileInput.current?.click()}
          className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Choose a file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <details className="rounded-lg border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">Or paste the text instead</summary>
        <label htmlFor={textareaId} className="sr-only">
          Resume text
        </label>
        <textarea
          id={textareaId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={RESUME_TEXT_MAX}
          rows={8}
          placeholder="Paste your resume text here"
          className="mt-3 w-full rounded-md border border-stone-300 p-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading || text.trim().length < RESUME_TEXT_MIN}
            onClick={() => void submit({ text: text.trim() })}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Match this resume
          </button>
          <span className="text-xs text-stone-500">
            {text.trim().length} / {RESUME_TEXT_MAX} characters
            {textTooShort ? ` · at least ${RESUME_TEXT_MIN} needed` : ''}
          </span>
        </div>
      </details>

      {loading && (
        <p role="status" className="text-sm text-stone-600">
          Reading the resume, embedding it and ranking jobs. The first run can take a few seconds.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
