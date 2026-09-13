# H-005 — Establish Auth Environment and Validation Baseline

## Status

DONE

## Objective

Establish a strict, testable configuration baseline for Auth v1: centrally
validated API configuration at startup, defined Auth environment variable names,
fail-fast on missing/invalid required configuration, clear application vs
infrastructure ownership, and no authentication behaviour.

## Context

The API uses NestJS `ConfigModule` but does not validate environment variables.
Auth v1 will need configuration for tokens, sessions, security parameters, email,
Google OAuth, origins, and cookies. Introducing these incrementally without a
validated contract risks late runtime failures.

## Dependencies

H-001 (verification gate), H-002 (runtime baseline), H-003 (task workflow), and
H-004 (CI) are complete.

## Scope

1. Inspect existing configuration files and references.
2. Add centralized, schema-based environment validation at API startup.
3. Choose the smallest appropriate validation dependency and justify it.
4. Define the Auth environment variable names (without consumers).
5. Define the secrets strategy (direct env vs `*_FILE`) for dev, CI, production.
6. Update `.env.example` files to reflect the contract.
7. Add focused configuration-validation tests.
8. Document the configuration contract and ownership.
9. Correct the H-004 completion metadata (actual baseline commit).
10. Complete this task through the established lifecycle.

## Out of Scope

User/Auth Prisma models, migrations, registration/login/JWT/refresh/password
hashing, mail sending, SMTP credentials, Google OAuth, Google Cloud, CORS
behaviour, Oracle infrastructure, deployment, application features, commit, push.

## Acceptance Criteria

- [x] API environment configuration is centrally validated
- [x] missing/malformed required current configuration fails fast
- [x] validation errors do not expose secrets
- [x] Auth-related environment names are defined/documented
- [x] future Auth settings do not break the current scaffold
- [x] `.env.example` files reflect the intended configuration contract
- [x] configuration validation has focused tests
- [x] configuration ownership is clear
- [x] production secret expectations are documented
- [x] H-004 completion metadata is corrected
- [x] `tasks/TODO.md` reflects actual state
- [x] no Auth feature logic was implemented
- [x] `pnpm verify` passes

## Required Verification

```bash
pnpm verify
git diff --check
git status --short
```

Plus configuration-validation tests and a demonstrated failing-configuration
case.

## Implementation Result

- Added `zod@^4.6.2` as an `apps/api` dependency (zero runtime deps; TypeScript
  schema types). Documented as the single config-validation approach.
- Added `apps/api/src/config/env.validation.ts`: `envSchema` (explicit Zod
  contract), `validateEnv`, `resolveSecretFiles` (supports `<NAME>_FILE`), and
  `formatEnvError` (names/messages only, secret values scrubbed).
- Wired validation into `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`
  in `apps/api/src/app.module.ts`.
- `apps/api/src/main.ts` now reads `PORT` from `ConfigService` instead of
  `process.env`.
- Added `apps/api/test/setup-env.ts` (vitest `setupFiles`) supplying a non-secret
  `DATABASE_URL` so module-import-time validation does not break tests/CI.
- Added focused tests `apps/api/src/config/env.validation.spec.ts`.
- Updated `apps/api/.env.example` with required and reserved Auth variables and
  the `*_FILE` note.
- Added `docs/configuration.md` (contract, required-vs-reserved, secrets
  strategy, ownership); linked from `README.md` and `docs/development.md`;
  resolved the application side of contract field C.4 in `docs/architecture.md`.
- Corrected `tasks/done/H-004-establish-ci-workflow.md` completion metadata to
  commit `7e4801d`.

## Verification Result

- `pnpm verify` → exit 0; API tests 3 files / 16 tests, web 1 test, all builds.
- `git diff --check` → exit 0.
- `git status --short` → only intended files; no generated artifacts.
- Demonstrated fail-fast startup (built `apps/api`):
  - missing `DATABASE_URL` → `Invalid environment configuration: - DATABASE_URL: ...`, exit 1.
  - `PORT=not-a-number` → `- PORT: expected number, received NaN`, exit 1.
  - too-short secret → error names `JWT_ACCESS_SECRET` without printing the value
    (grep count of the secret value in output = 0).
  - valid `DATABASE_URL`/`PORT` → application boots (`Starting Nest application...`,
    `RoutesResolver AppController {/api}`).

## Decisions

- **Library: Zod.** Explicit schema, first-class TypeScript inference, no runtime
  dependencies, easy to unit-test, and reusable for future Auth config; smaller
  and more type-safe than Joi. Only one schema-validation library is introduced.
  If DTO validation is later required, prefer `nestjs-zod` to keep a single
  schema approach rather than adding `class-validator` as well.
- **Secrets:** every secret accepts a direct value or `<NAME>_FILE`; direct value
  wins. This is the application-side answer to contract C.4 and works with
  container secret mounts.
- **Reserved-not-required:** Auth/origins/mail/OAuth variables are optional and
  format-checked only when present, so declaring them does not break the current
  scaffold. Promotion later is a one-line schema change.
- **No production fallbacks:** `DATABASE_URL` is required with no default; no
  Auth secret has a development fallback.
- **Central boundary:** modules must read config via `ConfigService`.

## Follow-ups

- H-006 — Test database strategy.
- When Auth v1 lands, promote `JWT_ACCESS_SECRET` (and other consumed secrets)
  from reserved to required.
- `H-001`–`H-003` task records still show `Commit: not committed`; left untouched
  because this task authorizes correcting only H-004 metadata.
- Docker: `docker/api.Dockerfile` (feasibility draft) copies root `node_modules`
  and `apps/api/dist` but not `apps/api/node_modules`; with any API runtime
  dependency (including the existing Nest packages and now `zod`) the runner
  image may not resolve them. Pre-existing draft issue; resolve when the API
  image is finalized (Docker architecture out of scope here).

## Completion

Completed date: 2026-09-13
Commit: 1677ca958c761964cfa7ed58febfe369ac5e8b36 — "H-007: complete auth readiness harness"
