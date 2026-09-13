# Testing

Status: **foundation implemented.** Vitest is configured for `apps/web` and
`apps/api` with a small number of readiness tests. `packages/db` has no test
framework yet because it has no testable code (only a Prisma client
re-export/singleton); add Vitest there when it gains logic.

## Framework decisions (accepted)

- **Unit and integration tests:** Vitest.
- **API HTTP integration:** Supertest with Vitest.
- **Browser E2E:** Playwright, added later when real user flows exist — not
  installed now merely to satisfy an empty test layer.

## Scope

| Layer           | Target                                      | Tool               |
| --------------- | ------------------------------------------- | ------------------ |
| API unit        | controllers/services (e.g. readiness logic) | Vitest             |
| API integration | routes + mocked data layer over HTTP        | Supertest + Vitest |
| Web unit        | route handlers / components                 | Vitest             |
| Web E2E         | catalog, cart, checkout flows               | Playwright (later) |
| Contract        | `/api` route ownership; health endpoints    | Vitest / Supertest |

## Testing requirements

- New business logic (services, domain rules, validation, calculations)
  requires unit tests covering its meaningful branches.
- New or changed API behaviour requires an HTTP-level integration/e2e test
  (Supertest) exercising the route, its success path, and its documented error
  paths.
- Bug fixes should normally include a regression test that fails before the fix
  and passes after it, unless the task file records why a test is impractical.
- Web route handlers and components with logic require Vitest tests.
- Browser E2E (Playwright) is required only once real user flows exist; it is not
  installed merely to satisfy an empty layer.
- No arbitrary coverage percentage is enforced. Tests are judged by whether they
  protect required behaviour.
- `pnpm verify` is the final project-wide gate; a task is not complete until it
  passes. A task may skip the full gate only if the task file documents a
  legitimate reason and reports it.

## Current foundation tests

- `apps/web/src/app/health/ready/route.test.ts` — `GET /health/ready` returns 200.
- `apps/api/src/health.controller.spec.ts` — readiness logic: DB query success →
  ok; failure → `ServiceUnavailableException`.
- `apps/api/test/health.e2e-spec.ts` — over HTTP (Supertest): `/health/ready`
  200/503, `/api` 200, `/api/health/ready` 404 (readiness is not under `/api`).

Run them with `pnpm test`. The full project verification gate, which also runs
lint, typecheck, and the production build, is `pnpm verify` (see
`docs/development.md`).

## Acceptance expectations

These are accepted facts and must hold before a release:

- Migrations run via `prisma migrate deploy` and exit 0 on success, non-zero on
  failure.
- API readiness (`/health/ready`) returns 200 only after an authenticated DB
  query, else 503.
- Frontend readiness (`/health/ready`) returns 200 with no DB/API dependency.
- Application processes handle SIGTERM and shut down gracefully.
- Secrets are read from files (exact names open — contract C.4, coordinated
  with `sm-oracle-infra`).

Health-check cadence (interval, timeout, retries, start_period) is owned by
`sm-oracle-infra` and is not an application testing concern.

## Test data and isolation

- Integration tests use a dedicated test database, never production data.
- No production access or secrets in any test or CI job.

## Database-backed tests

Database-backed tests run against an isolated PostgreSQL database that is
separate from development, using the real Prisma migration state.

- **Boundary:** the connection comes from `TEST_DATABASE_URL`. The database name
  must end with `_test`, and it must not match the development `DATABASE_URL`
  target. `scripts/test-db.mjs` and `apps/api/test/database/helpers.ts` enforce
  this and **fail closed** on any other target.
- **Service:** a dedicated Compose service `db-test` (profile `test`, port
  `5433`, its own volume) so the development database can never be touched. It is
  not started by `pnpm db:up`.
- **Migrations:** `prisma migrate deploy` is applied to the test database; tests
  also assert the `_prisma_migrations` state exists. No `prisma db push`.
- **Isolation:** `truncateAll` truncates every application table (excluding
  `_prisma_migrations`) with `RESTART IDENTITY CASCADE` before each test; table
  names are read from the catalog so new models are covered automatically.
- **Minimal proof:** `apps/api/test/database/database.db-spec.ts` asserts the
  connection is the test database, Prisma operates, migration state is present,
  and truncation succeeds.

Commands:

| Command                | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `pnpm db:test:up`      | start the isolated test database (Compose profile `test`) |
| `pnpm db:test:migrate` | apply migrations to the test database                     |
| `pnpm test:db`         | run database-backed integration tests                     |
| `pnpm db:test:reset`   | reset the test database and re-apply migrations           |
| `pnpm db:test:down`    | stop the test database and remove its volume              |
| `pnpm verify:db`       | start test DB → migrate → `pnpm verify` → DB tests        |

`pnpm verify` deliberately stays service-free and deterministic, so it does not
include database-backed tests. Database-affecting work must also pass
`pnpm verify:db` locally and the DB-backed CI gate.

## CI (implemented)

- `.github/workflows/ci.yml` runs on pushes and pull requests to `main`.
- It sets up Node.js 24 from `.nvmrc` and the pinned pnpm version from
  `package.json`, installs with `pnpm install --frozen-lockfile`, then runs
  `pnpm verify:ci`.
- `pnpm verify:ci` applies migrations to the CI PostgreSQL service, runs
  `pnpm verify`, then runs the database-backed tests. CI provides an ephemeral
  PostgreSQL 18 service (`smshop_test` / `smshop_test`, isolated credentials,
  deterministic name, health check); no production secrets are used.
- CI does not duplicate the gate internals: it calls the same root scripts used
  locally.
- The workflow is verification-only with `contents: read` permissions; it uses no
  services, secrets, or deployment steps.

## Environment note

The accepted local development model is PostgreSQL 18 via Docker Compose. The
Docker failure on the current Intel macOS host is an environment-specific
verification blocker, not a reason to change the development architecture.
PostgreSQL Compose startup and Docker image builds remain unverified until a
working Docker environment is available.
