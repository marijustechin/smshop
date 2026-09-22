import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

/**
 * Loads local development environment files for Prisma CLI commands
 * (`prisma migrate …`, `prisma generate`).
 *
 * Process environment variables always win, and the first file that defines a
 * key provides it. The candidates are the files the local setup documents in
 * `docs/development.md`, so a developer who copied any (or all) of them can run
 * migrations without a separate copy:
 *   1. `packages/db/.env` (Prisma-specific),
 *   2. repository-root `.env` (local Compose/connection values),
 *   3. `apps/api/.env` (API runtime config; same local database).
 *
 * In CI and production the database connection comes from the process
 * environment, so no `.env` file is required. Missing files are ignored.
 */
const packageDir = dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: [
    resolve(packageDir, '.env'),
    resolve(packageDir, '../../.env'),
    resolve(packageDir, '../../apps/api/.env'),
  ],
  quiet: true,
});

/**
 * Resolves the datasource URL for Prisma CLI commands (migrations).
 *
 * The accepted infrastructure secret model mounts the database password as a
 * file and expects the connection URL to be built in process. The application
 * runtime does this in `apps/api/src/config/env.validation.ts`; the Prisma CLI
 * is a separate process, so the same resolution is mirrored here:
 *
 *   1. `DATABASE_URL` (or `DATABASE_URL_FILE`) wins when present;
 *   2. otherwise `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER` plus `DB_PASSWORD`
 *      (or `DB_PASSWORD_FILE`) are assembled into a PostgreSQL URL.
 *
 * Returns `undefined` when neither form is configured; `prisma generate` does
 * not require a datasource URL.
 */
function readSecretFile(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }
  try {
    return readFileSync(path, 'utf8').replace(/\r?\n$/, '');
  } catch {
    return undefined;
  }
}

function resolveDatabaseUrl(): string | undefined {
  const direct = process.env['DATABASE_URL'];
  if (direct) {
    return direct;
  }
  const fromFile = readSecretFile(process.env['DATABASE_URL_FILE']);
  if (fromFile) {
    return fromFile;
  }

  const host = process.env['DB_HOST'];
  const name = process.env['DB_NAME'];
  const user = process.env['DB_USER'];
  const password = process.env['DB_PASSWORD'] ?? readSecretFile(process.env['DB_PASSWORD_FILE']);
  if (!host || !name || !user || !password) {
    return undefined;
  }
  const port = process.env['DB_PORT'] ?? '5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
