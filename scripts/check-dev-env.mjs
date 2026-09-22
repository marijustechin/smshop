#!/usr/bin/env node
/**
 * Local-development preflight for `pnpm dev`.
 *
 * The API validates its environment at startup and exits when required values
 * are missing. Because `pnpm dev` runs web and api in parallel, that failure can
 * scroll past while the web dev server keeps running. This check fails fast
 * *before* either server starts and prints only variable names and guidance —
 * never values.
 *
 * Usage: `node scripts/check-dev-env.mjs [env-file]` (default: apps/api/.env).
 * This only reads configuration; it does not duplicate the API's full
 * validation (see apps/api/src/config/env.validation.ts, which remains the
 * authority and still runs at API startup).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const exampleFile = 'apps/api/.env.example';
const docs = 'docs/development.md';
const apiEnvFile = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(repoRoot, 'apps', 'api', '.env');

/** Minimal KEY=value reader; ignores comments/blank lines and strips quotes. */
function parseEnvFile(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (key === '') continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fromFile = existsSync(apiEnvFile)
  ? parseEnvFile(readFileSync(apiEnvFile, 'utf8'))
  : undefined;

/** A value is set if it is a non-empty process env var or file entry. */
function valueOf(key) {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.trim() !== '') return fromProcess;
  const fromEnvFile = fromFile?.[key];
  if (typeof fromEnvFile === 'string' && fromEnvFile.trim() !== '') return fromEnvFile;
  return undefined;
}

// The frontend reads NEXT_PUBLIC_* from apps/web at dev/build time. Next.js
// prefers `.env.local`; `.env` is the fallback the example documents.
const webEnvFile = ['apps/web/.env.local', 'apps/web/.env']
  .map((relative) => join(repoRoot, relative))
  .find((path) => existsSync(path));
const webFromFile = webEnvFile ? parseEnvFile(readFileSync(webEnvFile, 'utf8')) : undefined;

function webValueOf(key) {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.trim() !== '') return fromProcess;
  const fromEnvFile = webFromFile?.[key];
  if (typeof fromEnvFile === 'string' && fromEnvFile.trim() !== '') return fromEnvFile;
  return undefined;
}

/** Cloudflare's official test credentials start with [123]x0000. */
function isCloudflareTestKey(value) {
  return /^[123]x0{4}/.test(value ?? '');
}

// Documented local-only ports: web 3101, API 3100. Production/container ports
// remain 3000/3001 and are configured by infrastructure Compose, not these files.
const LOCAL_WEB_ORIGIN = 'http://localhost:3101';
const LOCAL_API_PORT = '3100';

const problems = [];

const webOrigin = valueOf('WEB_ORIGIN');
if (!webOrigin) {
  problems.push(`WEB_ORIGIN (expected ${LOCAL_WEB_ORIGIN})`);
} else if (webOrigin.replace(/\/+$/, '') !== LOCAL_WEB_ORIGIN) {
  problems.push(`WEB_ORIGIN (expected ${LOCAL_WEB_ORIGIN})`);
}

const port = valueOf('PORT');
if (port !== LOCAL_API_PORT) {
  problems.push(`PORT (expected ${LOCAL_API_PORT})`);
}

const directSecret = valueOf('JWT_ACCESS_SECRET');
if (directSecret) {
  if (directSecret.length < 32) {
    problems.push('JWT_ACCESS_SECRET (must be at least 32 characters)');
  }
} else if (!valueOf('JWT_ACCESS_SECRET_FILE')) {
  problems.push('JWT_ACCESS_SECRET (at least 32 characters)');
}

const hasDatabase =
  valueOf('DATABASE_URL') ||
  valueOf('DATABASE_URL_FILE') ||
  (valueOf('DB_HOST') &&
    valueOf('DB_NAME') &&
    valueOf('DB_USER') &&
    (valueOf('DB_PASSWORD') || valueOf('DB_PASSWORD_FILE')));
if (!hasDatabase) {
  problems.push('DATABASE_URL (or the DB_HOST/DB_NAME/DB_USER/DB_PASSWORD group)');
}

// Turnstile must be configured consistently: if the API enforces it, the
// frontend needs a site key or the widget never renders and registration fails
// with 403 TURNSTILE_REQUIRED. Test/non-test keys must also match, because the
// always-pass test secret only accepts test-sitekey (dummy) tokens and real
// secrets reject them.
const turnstileSecret = valueOf('TURNSTILE_SECRET_KEY');
const turnstileSecretSet = Boolean(turnstileSecret || valueOf('TURNSTILE_SECRET_KEY_FILE'));
const turnstileSiteKey = webValueOf('NEXT_PUBLIC_TURNSTILE_SITE_KEY');

if (turnstileSecretSet && !turnstileSiteKey) {
  problems.push(
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY (required in apps/web/.env.local when TURNSTILE_SECRET_KEY is set)',
  );
} else if (
  turnstileSecret &&
  turnstileSiteKey &&
  isCloudflareTestKey(turnstileSecret) !== isCloudflareTestKey(turnstileSiteKey)
) {
  problems.push(
    'Turnstile test/non-test key mismatch (use the official always-pass TEST pair for local dev)',
  );
}

if (problems.length === 0) {
  process.exit(0);
}

const lines = [];
if (fromFile === undefined) {
  lines.push(`Local development is not configured: apps/api/.env is missing.`);
} else {
  lines.push('The API environment is incomplete (apps/api/.env).');
}
lines.push('');
lines.push('Required for `pnpm dev`:');
for (const problem of problems) lines.push(`  - ${problem}`);
lines.push('');
lines.push('Fix: add the missing values, or re-copy the committed examples:');
lines.push(`  cp ${exampleFile} apps/api/.env`);
lines.push('  cp apps/web/.env.example apps/web/.env.local');
lines.push(
  "Local Turnstile uses Cloudflare's official always-pass TEST keys (test-only; never staging/production).",
);
lines.push('Generate a local access secret with:');
lines.push(
  "  node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\"",
);
lines.push('');
lines.push(`See ${docs} and docs/configuration.md. Never commit .env files.`);

console.error(lines.join('\n'));
process.exit(1);
