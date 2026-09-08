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

## Current foundation tests

- `apps/web/src/app/health/ready/route.test.ts` — `GET /health/ready` returns 200.
- `apps/api/src/health.controller.spec.ts` — readiness logic: DB query success →
  ok; failure → `ServiceUnavailableException`.
- `apps/api/test/health.e2e-spec.ts` — over HTTP (Supertest): `/health/ready`
  200/503, `/api` 200, `/api/health/ready` 404 (readiness is not under `/api`).

Run them with `pnpm test`.

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

## CI (later — not implemented)

- Lint, typecheck, and the test suite run in GitHub Actions before the image
  build. No GitHub Actions implementation during the scaffolding stage.

## Environment note

The accepted local development model is PostgreSQL 18 via Docker Compose. The
Docker failure on the current Intel macOS host is an environment-specific
verification blocker, not a reason to change the development architecture.
PostgreSQL Compose startup and Docker image builds remain unverified until a
working Docker environment is available.
