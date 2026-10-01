#!/usr/bin/env node
// Ownership guard. Enforces Rule 0 in AGENTS.md:
//   - every commit is authored and committed by the repository owner only
//   - no tool / assistant attribution, trailers or branding in commits or files
//   - no tool-specific config folders are committed
//
// Modes:
//   node scripts/guard.mjs staged          pre-commit: staged paths + contents + current identity
//   node scripts/guard.mjs msg <file>      commit-msg: the message being committed
//   node scripts/guard.mjs prepush         pre-push: every commit about to be pushed (reads stdin)
//   node scripts/guard.mjs range <a..b>    any revision range
//   node scripts/guard.mjs all             CI: full history + full tree at HEAD
//
// Patterns are stored encoded so this file never trips its own scan.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const OWNER_NAME = 'Bittu Mandal';
const OWNER_EMAILS = ['209128489+ishowguts@users.noreply.github.com'];
// GitHub's own web-flow committer is allowed only as COMMITTER (merges made in the GitHub UI).
const EXTRA_COMMITTER_EMAILS = ['noreply@github.com'];

const dec = (s) => Buffer.from(s, 'base64').toString('utf8');
const BLOCKED_WORDS = new RegExp(
  dec('KGNsYXVkZXxhbnRocm9waWN8b3BlbmFpfGNoYXQtP2dwdHxcYmdwdFxifFxiZ3B0LT9bMC05b118XGJjb2RleFxifGFudGlncmF2aXR5fGNvcGlsb3R8d2luZHN1cmZ8Y28tYXV0aG9yZWQtYnl8Z2VuZXJhdGVkICh3aXRofGJ5KSAoYW4/ICk/KGFpfGxsbSl8YWktZ2VuZXJhdGVkfHdyaXR0ZW4gYnkgKGFuPyApPyhhaXxsbG0pfFx1ezFGOTE2fSk='),
  'iu',
);
const BLOCKED_PATHS = new RegExp(
  dec('KF58LykoZ2VtaW5pXC5tZHxcLmdlbWluaS98XC5hZ2VudC98XC5hZ2VudHMvfFwuY3Vyc29yL3xcLmN1cnNvcnJ1bGVzfFwud2luZHN1cmZ8XC5haWRlcnxcLmNvbnRpbnVlL3xcLmdpdGh1Yi9jb3BpbG90KQ=='),
  'i',
);
// Any "<Something>-by:" trailer other than the owner's own sign-off is rejected.
const TRAILER = /^[A-Za-z-]+-by:\s*(.*)$/gim;

const SKIP_CONTENT = [/(^|\/)pnpm-lock\.yaml$/, /(^|\/)package-lock\.json$/, /(^|\/)yarn\.lock$/];
const ZERO = /^0+$/;

const problems = [];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const gitBuf = (...args) => execFileSync('git', args, { maxBuffer: 1 << 28 });

function scanText(label, text) {
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(BLOCKED_WORDS);
    if (m) problems.push(`${label}:${i + 1}: blocked term "${m[0]}"`);
  });
}

function scanMessage(label, msg) {
  const body = msg.split(/\r?\n/).filter((l) => !l.startsWith('#')).join('\n');
  scanText(label, body);
  for (const m of body.matchAll(TRAILER)) {
    if (!m[1].includes(OWNER_NAME)) problems.push(`${label}: trailer not allowed: "${m[0].trim()}"`);
  }
}

function scanPath(label, path) {
  if (BLOCKED_PATHS.test(path)) problems.push(`${label}: blocked path "${path}"`);
  if (BLOCKED_WORDS.test(path)) problems.push(`${label}: blocked term in path "${path}"`);
}

function scanBlob(label, path, buf) {
  if (SKIP_CONTENT.some((r) => r.test(path))) return;
  if (buf.subarray(0, 8000).includes(0)) return; // binary
  scanText(`${label}${path}`, buf.toString('utf8'));
}

function checkIdentity(label, an, ae, cn, ce) {
  if (an !== OWNER_NAME || !OWNER_EMAILS.includes(ae))
    problems.push(`${label}: author must be "${OWNER_NAME} <${OWNER_EMAILS[0]}>", got "${an} <${ae}>"`);
  const committerOk =
    (cn === OWNER_NAME && OWNER_EMAILS.includes(ce)) || EXTRA_COMMITTER_EMAILS.includes(ce);
  if (!committerOk) problems.push(`${label}: committer not allowed: "${cn} <${ce}>"`);
}

function checkCommit(sha) {
  const short = sha.slice(0, 8);
  const [an, ae, cn, ce, ...rest] = git('log', '-1', '--format=%an%n%ae%n%cn%n%ce%n%B', sha).split('\n');
  checkIdentity(`commit ${short}`, an, ae, cn, ce);
  scanMessage(`commit ${short} message`, rest.join('\n'));
  const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', '-z', '--root', '--diff-filter=ACMR', sha)
    .split('\0')
    .filter(Boolean);
  for (const f of files) {
    scanPath(`commit ${short}`, f);
    scanBlob(`commit ${short} `, f, gitBuf('show', `${sha}:${f}`));
  }
}

function checkRange(range) {
  const shas = git('rev-list', ...range).split('\n').filter(Boolean);
  shas.forEach(checkCommit);
  return shas.length;
}

function identityFromEnv() {
  const parse = (s) => {
    const m = s.match(/^(.*) <(.*)> \d+ [+-]\d{4}$/);
    return m ? [m[1], m[2]] : ['', ''];
  };
  const [an, ae] = parse(git('var', 'GIT_AUTHOR_IDENT').trim());
  const [cn, ce] = parse(git('var', 'GIT_COMMITTER_IDENT').trim());
  checkIdentity('git identity', an, ae, cn, ce);
}

const [mode, arg] = process.argv.slice(2);
switch (mode) {
  case 'staged': {
    identityFromEnv();
    const files = git('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR').split('\0').filter(Boolean);
    for (const f of files) {
      scanPath('staged', f);
      scanBlob('staged ', f, gitBuf('show', `:${f}`));
    }
    break;
  }
  case 'msg':
    scanMessage('commit message', readFileSync(arg, 'utf8'));
    break;
  case 'prepush': {
    const input = readFileSync(0, 'utf8').trim();
    for (const line of input.split('\n').filter(Boolean)) {
      const [, localSha, , remoteSha] = line.split(' ');
      if (ZERO.test(localSha)) continue; // branch deletion
      checkRange(ZERO.test(remoteSha) ? [localSha, '--not', '--remotes'] : [`${remoteSha}..${localSha}`]);
    }
    break;
  }
  case 'range':
    checkRange([arg]);
    break;
  case 'all': {
    const n = checkRange(['HEAD']);
    for (const f of git('ls-files', '-z').split('\0').filter(Boolean)) {
      scanPath('tree', f);
      scanBlob('tree ', f, gitBuf('show', `HEAD:${f}`));
    }
    console.log(`guard: checked ${n} commits and the HEAD tree`);
    break;
  }
  default:
    console.error('usage: guard.mjs staged | msg <file> | prepush | range <a..b> | all');
    process.exit(2);
}

if (problems.length) {
  console.error('\nOWNERSHIP GUARD FAILED (see Rule 0 in AGENTS.md)\n');
  for (const p of [...new Set(problems)]) console.error('  - ' + p);
  console.error('\nFix the items above. Never bypass this guard with --no-verify.\n');
  process.exit(1);
}
