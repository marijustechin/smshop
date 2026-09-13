import { createPrismaClient, type PrismaClient } from '@smshop/db';

export interface DatabaseIdentity {
  host: string;
  port: string;
  database: string;
}

export function parseTestDatabaseUrl(url: string): DatabaseIdentity {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
  };
}

/**
 * Fail-closed guard for anything that reads or mutates the test database.
 * The database name must end in `_test` and must not match the configured
 * development DATABASE_URL target.
 */
export function assertTestDatabaseUrl(
  url: string | undefined,
  devUrl: string | undefined = process.env.DATABASE_URL,
): DatabaseIdentity {
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required for database-backed tests.');
  }

  const identity = parseTestDatabaseUrl(url);
  if (!identity.database) {
    throw new Error('TEST_DATABASE_URL must include a database name.');
  }
  if (!identity.database.endsWith('_test')) {
    throw new Error(
      `Refusing to use "${identity.database}": test database names must end with "_test".`,
    );
  }

  if (devUrl) {
    const dev = parseTestDatabaseUrl(devUrl);
    if (
      dev.host === identity.host &&
      dev.port === identity.port &&
      dev.database === identity.database
    ) {
      throw new Error('Refusing to use the development database as the test database.');
    }
  }

  return identity;
}

/** Resolves and validates the test database URL, or throws (never defaults). */
export function resolveTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const url = env.TEST_DATABASE_URL;
  assertTestDatabaseUrl(url, env.DATABASE_URL);
  return url as string;
}

export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient(resolveTestDatabaseUrl());
}

/**
 * Deterministic isolation: truncate every application table (never the Prisma
 * migrations table) with RESTART IDENTITY and CASCADE. Table names are read
 * from the PostgreSQL catalog, so newly added Auth models are covered
 * automatically.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );

  if (rows.length === 0) {
    return;
  }

  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
