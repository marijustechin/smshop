#!/usr/bin/env node
/**
 * Test database lifecycle helper.
 *
 * Centralises the isolated test database boundary so scripts never need to know
 * the raw Docker/Prisma commands. Every command that reads or writes a database
 * passes through the same fail-closed guard.
 *
 * Usage: node scripts/test-db.mjs <up|down|migrate|reset|test|check>
 */
import { spawnSync } from 'node:child_process';

const DEFAULT_TEST_DATABASE_URL = 'postgresql://smshop_test:smshop_test@localhost:5433/smshop_test';

const COMPOSE_TEST_ARGS = ['compose', '--profile', 'test'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function databaseIdentity(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
  };
}

/**
 * Fail closed unless the target is unambiguously a test database:
 *  - TEST_DATABASE_URL must be set explicitly or fall back to the documented
 *    Compose test default;
 *  - the database name must end in `_test`;
 *  - it must not point at the configured development DATABASE_URL target.
 */
function resolveTestDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const { database } = databaseIdentity(url);

  if (!database) {
    throw new Error(`Refusing to use TEST_DATABASE_URL without a database name: ${url}`);
  }
  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run against "${database}": test database names must end with "_test".`,
    );
  }

  const devUrl = process.env.DATABASE_URL;
  if (devUrl) {
    const dev = databaseIdentity(devUrl);
    const test = databaseIdentity(url);
    if (dev.host === test.host && dev.port === test.port && dev.database === test.database) {
      throw new Error('Refusing to run: TEST_DATABASE_URL points at the development database.');
    }
  }

  return url;
}

function withTestDatabaseUrl(url, env = {}) {
  return { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url, ...env };
}

/** The test runner must not see DATABASE_URL pointed at the test database. */
function withOnlyTestDatabaseUrl(url) {
  return { ...process.env, TEST_DATABASE_URL: url };
}

function main() {
  const command = process.argv[2];

  switch (command) {
    case 'up':
      console.log('Starting isolated test database (docker compose profile "test")...');
      run('docker', [...COMPOSE_TEST_ARGS, 'up', '-d', '--wait', 'db-test']);
      break;

    case 'down':
      console.log('Stopping isolated test database and removing its volume...');
      run('docker', [...COMPOSE_TEST_ARGS, 'down', '-v', '--remove-orphans']);
      break;

    case 'migrate': {
      const url = resolveTestDatabaseUrl();
      const { host, port, database } = databaseIdentity(url);
      console.log(`Applying migrations to test database ${database} at ${host}:${port}...`);
      run('pnpm', ['--filter', '@smshop/db', 'exec', 'prisma', 'migrate', 'deploy'], {
        env: withTestDatabaseUrl(url),
      });
      break;
    }

    case 'reset': {
      const url = resolveTestDatabaseUrl();
      const { host, port, database } = databaseIdentity(url);
      console.log(`Resetting test database ${database} at ${host}:${port}...`);
      run(
        'pnpm',
        [
          '--filter',
          '@smshop/db',
          'exec',
          'prisma',
          'migrate',
          'reset',
          '--force',
          '--skip-seed',
          '--skip-generate',
        ],
        { env: withTestDatabaseUrl(url) },
      );
      break;
    }

    case 'test': {
      const url = resolveTestDatabaseUrl();
      run('pnpm', ['--filter', '@smshop/api', 'test:db'], {
        env: withOnlyTestDatabaseUrl(url),
      });
      break;
    }

    case 'check': {
      const url = resolveTestDatabaseUrl();
      const { host, port, database } = databaseIdentity(url);
      console.log(`Test database target is valid: ${database} at ${host}:${port}`);
      break;
    }

    default:
      console.error('Usage: node scripts/test-db.mjs <up|down|migrate|reset|test|check>');
      process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
