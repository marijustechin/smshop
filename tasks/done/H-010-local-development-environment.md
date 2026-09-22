# H-010 — Self-explanatory local development environment

## Status

**DONE (implemented and verified locally; committed).**

## Goal

Make a fresh local checkout self-explanatory to run: document the minimum API
environment, make the committed examples complete, and fail fast (with actionable
guidance) when the API environment is incomplete instead of losing the error in
interleaved `pnpm dev` output.

## Context

Running `pnpm dev` starts the frontend, but the API exits during startup
environment validation because `WEB_ORIGIN` and `JWT_ACCESS_SECRET` are missing.
`apps/api/.env.example` already contains them, but a local `apps/api/.env` created
before those variables were introduced (or created by hand) does not. The API
validates its environment at startup and exits; because `pnpm dev` runs web and
API in parallel, the web server keeps running and the failure is easy to miss.

Relevant: `apps/api/.env.example`, `apps/api/src/config/env.validation.ts`,
`apps/api/src/app.module.ts` (`ConfigModule.forRoot`, no `envFilePath`), root
`README.md`, `docs/development.md`, `docs/configuration.md`.

## In scope

- Make `apps/api/.env.example` clearly complete for local development.
- Document the minimum local API environment, expected values
  (`WEB_ORIGIN=http://localhost:3101`, API `PORT=3100`), JWT secret generation,
  database configuration, and the exact startup sequence.
- Use distinct local development ports (web `3101`, API `3100`) while
  production/container ports remain `3000`/`3001` (owned by infrastructure).
- Add a small preflight to `pnpm dev` that reports missing/invalid API env and
  fails before web starts.
- Add an automated guard that the committed `apps/api/.env.example` keeps
  passing the real environment validation.
- Correct docs that imply `pnpm dev` works from a fresh clone without env setup.

## Out of scope

- Weakening production validation or adding fallback secrets to application code.
- Making production variables optional.
- Committing any real `.env`.
- Adding new tooling/dependencies.

## Verification

- `pnpm verify`.
- New `.env.example` validation test.
- Preflight fails on an incomplete env and passes on the example.
- Fresh setup exercised per the documented steps (`db:up`, migrate, `pnpm dev`).

## Completion record

- Files: `apps/api/.env.example` (comments + JWT generation guidance),
  `scripts/check-dev-env.mjs` (new preflight), root `package.json`
  (`check:dev-env` + `dev` wiring), `apps/api/src/config/env.validation.spec.ts`
  (example-validity test), `README.md`, `docs/development.md`,
  `docs/configuration.md`.
- Preflight: `pnpm dev` now runs `pnpm check:dev-env` first and stops before
  building or starting either server when `apps/api/.env` is missing
  `WEB_ORIGIN`/`JWT_ACCESS_SECRET`/database config; it prints names only, never
  values. Verified: fails on the developer's stale `.env` (names exactly
  `WEB_ORIGIN`, `JWT_ACCESS_SECRET`); passes on `apps/api/.env.example`.
- Guard: `env.validation.spec.ts` reads the committed `apps/api/.env.example`
  and runs the real `validateEnv`, so the example cannot drift from the schema.
- Verification: `pnpm verify` exit 0 (API 106 unit tests, web 80 tests). Fresh
  setup exercised from the examples: `db:up` → `prisma:migrate:deploy` (migration
  applied) → API `/health/ready` 200 and `/api/auth/capabilities`
  `{"google":false}` → web `/health/ready` 200. Local env files were restored /
  removed afterward; the running developer web server was not touched.
- Production validation unchanged; no fallback secrets added; no production
  variable made optional; no `.env` committed.

### Local development ports (web 3101 / API 3100)

- Local-only ports moved to web `3101` and API `3100` so a local dev server
  cannot collide with a container. Production/container ports stay `3000`/`3001`.
- Updated: `apps/api/.env.example` (`PORT=3100`, `WEB_ORIGIN`, `API_ORIGIN`,
  Google callback example), `apps/web/package.json` (`next dev -p 3101`),
  `apps/web/.env.example`, `apps/web/src/lib/api/config.ts` (dev fallback),
  `scripts/check-dev-env.mjs` (expects `WEB_ORIGIN=3101` and `PORT=3100`),
  API test env (`test/setup-env.ts`, `test/database/auth-app.ts`,
  `auth-google.db-spec.ts`), `env.validation.spec.ts`, web tests, CI `WEB_ORIGIN`,
  and the docs (`README.md`, `docs/development.md`, `docs/configuration.md`,
  `docs/frontend-authentication.md`).
- Deliberately **not** changed (production/container): `docker/api.Dockerfile`
  `EXPOSE 3001`, `docker/web.Dockerfile` `PORT=3000`/`EXPOSE 3000`,
  `env.validation.ts` `PORT` schema default `3001`, `docs/architecture.md`,
  `docs/deployment.md`, the accepted runtime-contract section, and all
  `sm-oracle-infra` Compose/Nginx/contract references.
- Re-verified after the port change: `pnpm verify:db` exit 0 (format, lint,
  typecheck, 106 API unit + 80 web tests, build, 109 DB-backed tests). Full
  `pnpm dev` from the committed examples starts web on `3101` and API on `3100`:
  `http://localhost:3101/` → 200, `http://localhost:3101/health/ready` → 200,
  `http://localhost:3100/health/ready` → 200,
  `http://localhost:3100/api/auth/capabilities` → `{"google":false}`.
- Note: to run `pnpm dev`, an orphaned `next dev -p 3000` + `nest start --watch`
  from the earlier broken local session had to be stopped (Next.js allows only
  one dev server per project, so it blocked a second one). Those local processes
  were not recoverable and are easily restarted; no repository or database data
  was involved.

### Migration env-file follow-up (2026-09-18)

- Reported: `pnpm prisma:migrate:deploy` failed with "The datasource.url
  property is required…" because the Prisma CLI only loaded `packages/db/.env`,
  which had not been copied, even though `apps/api/.env` existed.
- Fix: `packages/db/prisma7.config.ts` now loads local env candidates in order —
  `packages/db/.env`, the repository-root `.env`, then `apps/api/.env` — with the
  process environment always winning and the first file defining a key providing
  it. `prisma generate` still works with no env file (no datasource URL is
  required for generation).
- Verified: with only `apps/api/.env` present, `pnpm prisma:migrate:deploy`
  applied the migration successfully (`20260913164639_add_authentication_domain`);
  `pnpm verify` exit 0.
- Docs: `docs/development.md` and `docs/configuration.md` record the resolution
  order and that copying `apps/api/.env` alone is enough for local migrations.
