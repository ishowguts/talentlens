// Connection string validation. A malformed URL otherwise surfaces as a DNS failure for a nonsense hostname,
// which is slow to diagnose: node-postgres can split the URL at the first "@", so an unencoded "@" inside a
// password turns the text right after it into the host.

const SCHEME = /^postgres(?:ql)?:\/\//;

/** Throw a readable error when `value` is not a usable Postgres URL. Returns the host for logging. */
export function assertPostgresUrl(value: string, varName = 'DATABASE_URL'): string {
  if (!SCHEME.test(value)) {
    throw new Error(`${varName} must start with postgres:// or postgresql://`);
  }

  const body = value.replace(SCHEME, '');
  const lastAt = body.lastIndexOf('@');
  const credentials = lastAt === -1 ? '' : body.slice(0, lastAt);
  const hostPart = body.slice(lastAt + 1);

  if (credentials.includes('@') || credentials.includes('/')) {
    throw new Error(
      `${varName} has an unencoded "@" or "/" in its user name or password. Percent-encode every reserved ` +
        'character in the password: @ becomes %40, / becomes %2F, # becomes %23, : becomes %3A, ? becomes %3F. ' +
        'Left as they are, the URL is split in the wrong place and the connection goes to the wrong host.',
    );
  }

  const host = hostPart.split('/')[0]?.split('?')[0]?.replace(/:\d+$/, '') ?? '';
  if (!host) {
    throw new Error(`${varName} has no host: expected postgres://user:password@host:port/database`);
  }
  return host;
}
