import { describe, expect, it } from 'vitest';
import { assertPostgresUrl } from 'db';
import { parseEnv } from '../src/env.js';

describe('assertPostgresUrl', () => {
  it('accepts the shapes this project uses', () => {
    expect(assertPostgresUrl('postgres://postgres:postgres@localhost:5432/talentlens')).toBe('localhost');
    expect(
      assertPostgresUrl(
        'postgresql://user.ref:secret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe('aws-0-ap-northeast-1.pooler.supabase.com');
    expect(assertPostgresUrl('postgres://localhost/talentlens')).toBe('localhost');
    expect(assertPostgresUrl('postgres://u:p@host:5432/db?sslmode=require')).toBe('host');
  });

  it('rejects an unencoded reserved character in the password', () => {
    // This is the failure that reached production: the host became the text after the first "@".
    expect(() => assertPostgresUrl('postgres://user:pa@base123@real.host:5432/postgres')).toThrow(/%40/);
    expect(() => assertPostgresUrl('postgres://user:pa/ss@real.host:5432/postgres')).toThrow(/%2F/);
  });

  it('rejects a missing scheme or host', () => {
    expect(() => assertPostgresUrl('mysql://user:pass@host/db')).toThrow(/postgres:\/\//);
    expect(() => assertPostgresUrl('postgres://user:pass@/db')).toThrow(/no host/);
  });

  it('names the variable it was given', () => {
    expect(() => assertPostgresUrl('nonsense', 'DATABASE_URL_TEST')).toThrow(/DATABASE_URL_TEST/);
  });
});

describe('parseEnv', () => {
  it('rejects a database url whose password is not percent-encoded', () => {
    expect(() =>
      parseEnv({ DATABASE_URL: 'postgres://user:pa@base123@real.host:5432/postgres' } as NodeJS.ProcessEnv),
    ).toThrow(/%40/);
  });
});
