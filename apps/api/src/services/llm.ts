// LLM client. Model output is untrusted input: every response is validated, retried once with the validation
// error, then abandoned in favour of a deterministic fallback (ADR-008, ARCHITECTURE section 7.4 step 6).
import { GoogleGenAI } from '@google/genai';
import type { z } from 'zod';

export interface LlmClient {
  readonly model: string;
  /** Ask for one JSON document. Throws on transport failure or timeout. */
  generateJson(prompt: string, timeoutMs: number): Promise<string>;
}

/** Null when `GEMINI_API_KEY` or `GEMINI_MODEL` is unset: callers then use their fallback path. */
export function createLlmClient(apiKey: string | undefined, model: string | undefined): LlmClient | null {
  if (!apiKey || !model) return null;
  const client = new GoogleGenAI({ apiKey });

  return {
    model,
    async generateJson(prompt, timeoutMs) {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0 },
        }),
        timeoutMs,
      );
      return response.text ?? '';
    },
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`llm: timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Strip a markdown code fence, which models add even in JSON mode. */
function unfence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

export interface ValidatedResult<T> {
  data: T | null;
  /** How many calls were made, for logging. */
  attempts: number;
  /** Why it gave up, when `data` is null. */
  error?: string;
}

/**
 * One call, validated. On invalid JSON or a schema failure, retry once with the error appended to the prompt;
 * if that fails too, return `data: null` so the caller can fall back. Never throws.
 */
export async function generateValidated<T>(
  client: LlmClient,
  prompt: string,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<ValidatedResult<T>> {
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const fullPrompt =
      attempt === 1
        ? prompt
        : `${prompt}\n\nYour previous answer was rejected: ${lastError}\nReturn only valid JSON that matches the schema.`;
    try {
      const raw = await client.generateJson(fullPrompt, timeoutMs);
      const parsed = schema.safeParse(JSON.parse(unfence(raw)));
      if (parsed.success) return { data: parsed.data, attempts: attempt };
      lastError = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { data: null, attempts: 2, error: lastError };
}
