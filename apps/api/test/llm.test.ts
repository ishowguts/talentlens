import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLlmClient, generateValidated, type LlmClient } from '../src/services/llm.js';

const schema = z.object({ ok: z.boolean() });

function scripted(...responses: Array<string | Error>): LlmClient {
  const queue = [...responses];
  return {
    model: 'test-model',
    generateJson: vi.fn(async () => {
      const next = queue.shift();
      if (next === undefined) throw new Error('scripted: no response left');
      if (next instanceof Error) throw next;
      return next;
    }),
  };
}

describe('createLlmClient', () => {
  it('is null without a key or a model, so callers use their fallback', () => {
    expect(createLlmClient(undefined, 'some-model')).toBeNull();
    expect(createLlmClient('some-key', undefined)).toBeNull();
  });

  it('is a client when both are set', () => {
    expect(createLlmClient('some-key', 'some-model')?.model).toBe('some-model');
  });
});

describe('generateValidated', () => {
  it('returns the parsed value on the first attempt', async () => {
    const llm = scripted('{"ok":true}');

    const result = await generateValidated(llm, 'prompt', schema, 1_000);

    expect(result.data).toEqual({ ok: true });
    expect(result.attempts).toBe(1);
  });

  it('strips a markdown code fence', async () => {
    const llm = scripted('```json\n{"ok":false}\n```');

    expect((await generateValidated(llm, 'prompt', schema, 1_000)).data).toEqual({ ok: false });
  });

  it('retries once with the validation error and succeeds', async () => {
    const llm = scripted('{"ok":"yes"}', '{"ok":true}');

    const result = await generateValidated(llm, 'prompt', schema, 1_000);

    expect(result.data).toEqual({ ok: true });
    expect(result.attempts).toBe(2);
    const secondPrompt = vi.mocked(llm.generateJson).mock.calls[1]?.[0] ?? '';
    expect(secondPrompt).toContain('previous answer was rejected');
    expect(secondPrompt).toContain('ok:');
  });

  it('gives up after two failures instead of throwing', async () => {
    const llm = scripted('not json', '{"nope":1}');

    const result = await generateValidated(llm, 'prompt', schema, 1_000);

    expect(result.data).toBeNull();
    expect(result.attempts).toBe(2);
    expect(result.error).toBeTruthy();
  });

  it('treats a transport failure as a failed attempt', async () => {
    const llm = scripted(new Error('llm: timed out after 1000ms'), new Error('still down'));

    const result = await generateValidated(llm, 'prompt', schema, 1_000);

    expect(result.data).toBeNull();
    expect(result.error).toContain('still down');
  });
});
