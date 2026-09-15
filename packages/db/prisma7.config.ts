import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

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
