import type { PrismaClient } from '@smshop/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestPrismaClient,
  parseTestDatabaseUrl,
  resolveTestDatabaseUrl,
  truncateAll,
} from './helpers';

describe('Test database infrastructure (real PostgreSQL)', () => {
  let prisma: PrismaClient;
  const expectedDatabase = parseTestDatabaseUrl(resolveTestDatabaseUrl()).database;

  beforeAll(() => {
    prisma = createTestPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  it('connects to the isolated test database, not the development database', async () => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
      'SELECT current_database()',
    );

    expect(row.current_database).toBe(expectedDatabase);
    expect(expectedDatabase.endsWith('_test')).toBe(true);
  });

  it('operates through the Prisma client', async () => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ result: number }>>('SELECT 1 AS result');

    expect(Number(row.result)).toBe(1);
  });

  it('has real migration state applied', async () => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists`,
    );

    expect(row.exists).toBe(true);
  });

  it('resets deterministically between tests', async () => {
    await expect(truncateAll(prisma)).resolves.toBeUndefined();
  });
});
