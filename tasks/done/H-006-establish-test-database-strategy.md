# H-006 — Establish the Test Database Strategy

## Status

DONE

## Objective

Establish a reliable, isolated PostgreSQL strategy for database-backed
integration and API e2e tests, so Auth v1 can test real database behaviour
without touching the development database or another run's state.

## Context

The API has Prisma + PostgreSQL and a mocked e2e test suite, but no defined
database-backed test database or lifecycle. Auth v1 needs real database tests
for unique constraints, relations, tokens, sessions, transactions, and
invalidation.

## Dependencies

H-001 (verification gate), H-002 (runtime), H-003 (task workflow), H-004 (CI),
and H-005 (config validation) are complete.

## Scope

1. Inspect existing database/test/CI infrastructure.
2. Define a test-only database boundary (`TEST_DATABASE_URL`).
3. Add safeguards so destructive test utilities fail closed on non-test DBs.
4. Implement a repeatable test database lifecycle (start, migrate, test, reset).
5. Add a minimal real database integration test.
6. Add clear root/workspace scripts (unit vs DB vs full verification).
7. Decide explicitly how DB tests relate to `pnpm verify`.
8. Add the smallest PostgreSQL service to CI if DB tests run there.
9. Extend the H-005 config contract and docs only as necessary.
10. Correct H-001–H-003 commit metadata.
11. Complete this task through the lifecycle.

## Out of Scope

Auth models, registration/login/JWT/refresh/password hashing, email, OAuth,
product/domain decisions, Oracle deployment/backup, commit, push.

## Acceptance Criteria

- [x] isolated test database strategy exists
- [x] development and test DBs cannot be confused silently
- [x] destructive test DB operations have safeguards
- [x] migrations apply to the test DB repeatably
- [x] a minimal real database integration test passes
- [x] database cleanup/isolation is deterministic
- [x] developer commands are clear
- [x] CI supports database tests if required
- [x] test configuration is documented
- [x] H-001–H-003 commit metadata corrected if inaccurate
- [x] `pnpm verify` behaviour regarding DB tests is explicitly defined
- [x] no Auth functionality implemented
- [x] the full agreed verification gate passes

## Required Verification

```bash
pnpm verify
git diff --check
git status --short
```

Plus the database lifecycle: start, migrate, run DB test, reset.

## Implementation Result

- `docker-compose.yml`: added an isolated `db-test` service under the `test`
  profile (port `5433`, own `pgtestdata` volume, health check). Not started by
  `pnpm db:up`.
- `scripts/test-db.mjs`: single lifecycle helper with subcommands
  `up|down|migrate|reset|test|check` and a fail-closed guard (database name must
  end `_test`; must not match the `DATABASE_URL` target).
- `apps/api/test/database/helpers.ts`: `assertTestDatabaseUrl`,
  `resolveTestDatabaseUrl`, `createTestPrismaClient` (datasource override), and
  catalog-driven `truncateAll` excluding `_prisma_migrations`.
- `apps/api/test/database/database.db-spec.ts`: minimal real DB test (test DB
  identity, Prisma operation, migration state, deterministic truncate).
- `apps/api/test/test-database.guard.spec.ts`: guard unit tests (no DB).
- `apps/api/vitest.config.mts`: excludes `test/database/**`; added
  `apps/api/vitest.db.config.mts` for DB specs; `"test:db"` API script.
- `apps/api/tsconfig.build.json`: exclude `vitest.db.config.mts` from `nest build`.
- Root scripts: `test:db`, `db:test:up|down|migrate|reset|check`, `verify:db`,
  `verify:ci`.
- CI: added an ephemeral PostgreSQL 18 service (`smshop_test`, health check) and
  `TEST_DATABASE_URL`; the verify step now runs `pnpm verify:ci`.
- `.env.example`: documented `TEST_DATABASE_URL` and `TEST_POSTGRES_*`.
- Docs: `docs/testing.md`, `docs/development.md`, `docs/configuration.md`, `README.md`,
  and an `AGENTS.md` note that persistence changes must pass `pnpm verify:db`.
- Corrected H-001–H-003 `Commit:` metadata to `7e4801d`.

## Verification Result

- `pnpm db:test:up` → test DB healthy on `localhost:5433`.
- `pnpm db:test:check` → "Test database target is valid: smshop_test at localhost:5433".
- `pnpm db:test:migrate` → `prisma migrate deploy` exit 0 (`_prisma_migrations`
  created; no pending migrations since no models exist yet).
- `pnpm test:db` → 1 file / 4 tests passed against real PostgreSQL.
- `pnpm db:test:reset` → "Database reset successful".
- `pnpm db:test:down` → container and volume removed.
- Guard: `TEST_DATABASE_URL=postgresql://smshop:smshop@localhost:5432/smshop pnpm db:test:check`
  → "Refusing to run against \"smshop\": test database names must end with \"_test\".",
  exit 1.
- `pnpm verify` → exit 0 (API 4 files / 21 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0 (migrate + verify + 4 DB tests).
- `git diff --check` → exit 0; `git status --short` → only intended files, no
  generated artifacts.

## Decisions

- **Strategy:** a dedicated Compose `db-test` service (profile `test`, port
  `5433`, own volume) rather than a second database on the dev server. Fully
  isolated, cannot collide with development, and no dynamic DB creation code.
- **Boundary:** `TEST_DATABASE_URL`, name must end `_test`, must not match the
  `DATABASE_URL` target. Guard fails closed and is implemented both in the script
  and the test helper.
- **Migrations:** `prisma migrate deploy` (real migration state); no `db push`.
  Tested empirically that it exits 0 and creates `_prisma_migrations` even with
  an empty migration set.
- **Isolation:** truncate all application tables with `RESTART IDENTITY CASCADE`,
  excluding `_prisma_migrations`; table names read from `pg_tables`, so Auth
  models are covered automatically. Simpler and Prisma-friendly versus
  transaction rollback.
- **`pnpm verify` vs DB tests:** `pnpm verify` stays deterministic and
  service-free and excludes DB tests. `pnpm verify:db` (local) and `pnpm
verify:ci` (CI) add migrations + DB tests. Documented explicitly.
- **CI:** ephemeral PostgreSQL service with isolated credentials and no
  production secrets.

## Follow-ups

- H-007 — Integrate infrastructure workstream into project roadmap.
- When Auth models arrive, add real migrations; the DB lifecycle and guard need
  no changes (truncate discovers new tables).
- H-005 added `zod`; H-006 adds no new dependency. `docker/api.Dockerfile`
  (feasibility draft) may not resolve API runtime deps in the runner image;
  pre-existing, Docker architecture out of scope.
- Commit state: H-000–H-004 are committed at `7e4801d`; H-005–H-007 are
  committed at `1677ca9` (see `H-007`).

## Completion

Completed date: 2026-09-13
Commit: 1677ca958c761964cfa7ed58febfe369ac5e8b36 — "H-007: complete auth readiness harness"
