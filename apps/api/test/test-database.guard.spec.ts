import { describe, expect, it } from 'vitest';
import {
  assertTestDatabaseUrl,
  parseTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from './database/helpers';

const testUrl = 'postgresql://smshop_test:smshop_test@localhost:5433/smshop_test';
const devUrl = 'postgresql://smshop:smshop@localhost:5432/smshop';

describe('test database guard', () => {
  it('parses a database identity', () => {
    expect(parseTestDatabaseUrl(testUrl)).toEqual({
      host: 'localhost',
      port: '5433',
      database: 'smshop_test',
    });
  });

  it('accepts a database whose name ends in _test', () => {
    expect(() => assertTestDatabaseUrl(testUrl, undefined)).not.toThrow();
  });

  it('rejects a missing TEST_DATABASE_URL', () => {
    expect(() => assertTestDatabaseUrl(undefined, undefined)).toThrow(/TEST_DATABASE_URL/);
    expect(() => resolveTestDatabaseUrl({})).toThrow(/TEST_DATABASE_URL/);
  });

  it('rejects a database that is not clearly a test database', () => {
    expect(() => assertTestDatabaseUrl(devUrl, undefined)).toThrow(/_test/);
  });

  it('rejects the development database even if it ends in _test by name', () => {
    const ambiguous = 'postgresql://smshop:smshop@localhost:5432/smshop_test';
    expect(() => assertTestDatabaseUrl(ambiguous, ambiguous)).toThrow(/development database/);
  });
});
