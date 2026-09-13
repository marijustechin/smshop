# A-001 — Establish the Authentication Domain Model

## Status

DONE

## Objective

Design and implement the persistence/domain foundation for Auth v1: `User`
identity, `AuthAccount` providers, `AuthSession`, email-verification tokens, and
password-reset tokens. No endpoints, JWT issuance, hashing, email, or OAuth.

## Context

Auth v1 needs a database foundation before any auth behaviour. H-005–H-008
established config validation, test DB infrastructure, CI DB verification, and
the Fastify/Prisma 7/ESM baseline. `User` must stay separate from e-commerce
`Customer`.

## Dependencies

H-000 through H-008 complete.

## Scope

1. Create this task and mark it current.
2. Define and implement `User`, `AuthAccount`, `AuthSession`,
   `EmailVerificationToken`, `PasswordResetToken` in Prisma 7.
3. Define email normalization/uniqueness, provider constraints, ID strategy,
   token hashing orientation, and cascade behaviour.
4. Generate and review a real migration (`add_authentication_domain`).
5. Add real DB-backed schema-invariant tests using the H-006 infrastructure.
6. Document the model in `docs/authentication.md`; update `docs/architecture.md`
   for the identity/customer boundary.
7. Complete the lifecycle; A-002 stays next, unstarted.

## Out of Scope

Auth endpoints/business logic, JWT, refresh issuance, password hashing, email,
verification/reset behaviour, Google OAuth, frontend pages, `Customer`/`Address`/
`Order`/`Cart`, RBAC/roles, Oracle infrastructure, commit, push.

## Acceptance Criteria

- [x] `User` identity model exists
- [x] `User` remains separate from commerce Customer concerns
- [x] email uniqueness/normalization strategy is defined
- [x] credentials and Google providers are modeled
- [x] provider-account uniqueness constraints exist
- [x] password hash storage location is defined
- [x] session/refresh persistence exists
- [x] raw refresh tokens are not intended for DB storage
- [x] email verification token persistence exists
- [x] password reset token persistence exists
- [x] token storage is hash-oriented
- [x] expiration/single-use semantics are representable
- [x] account linking is structurally possible
- [x] cascade/referential behaviour is explicit
- [x] a real Prisma migration exists
- [x] generated SQL was reviewed
- [x] DB-backed schema tests exist
- [x] `docs/authentication.md` documents the model
- [x] no Auth endpoints/business logic were implemented
- [x] no Customer model was introduced
- [x] `pnpm verify` passes
- [x] `pnpm verify:db` passes

## Required Verification

```bash
nvm use
pnpm install --frozen-lockfile
pnpm db:test:up
pnpm db:test:reset
pnpm db:test:migrate
pnpm test:db
pnpm verify
pnpm verify:db
git diff --check
git status --short
```

## Implementation Result

- Added the authentication domain to `packages/db/prisma/schema.prisma`:
  `User`, `AuthAccount`, `AuthSession`, `EmailVerificationToken`,
  `PasswordResetToken`, and the `AuthProvider` enum (`CREDENTIALS`, `GOOGLE`).
- Generated migration
  `packages/db/prisma/migrations/20260913164639_add_authentication_domain/`
  (plus `migration_lock.toml`).
- Added real DB schema-invariant tests in
  `apps/api/test/database/auth-schema.db-spec.ts` (16 tests) using the H-006
  infrastructure; the generated client now exposes the auth delegates.
- Added `docs/authentication.md`; updated `docs/architecture.md` (identity vs
  customer boundary, auth persistence ownership) and `README.md` (doc link).
- Fixed `scripts/test-db.mjs` reset: Prisma 7 removed `--skip-seed`/
  `--skip-generate` and guards `migrate reset` behind interactive consent, so
  reset now drops/recreates the `public` schema via `prisma db execute --stdin`
  and re-runs `migrate deploy` (still behind the fail-closed test-DB guard).
- No Auth endpoints, services, JWT, hashing, email, OAuth, Customer, or RBAC code
  was added.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm db:test:reset` → drops/recreates schema, applies the migration, exit 0.
- `pnpm db:test:migrate` → exit 0 (1 migration, no pending).
- `pnpm test:db` → 2 files / 20 tests passed (4 H-006 + 16 A-001) on real
  PostgreSQL.
- `pnpm verify` → exit 0 (API 4 files / 21 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0 (reset-state migrate + verify + 20 DB tests).
- `git diff --check` → exit 0; `git status --short` → intended files only.
- Catalog review confirmed 5 tables (`users`, `auth_accounts`, `auth_sessions`,
  `email_verification_tokens`, `password_reset_tokens`), enum `AuthProvider`
  (`CREDENTIALS`, `GOOGLE`), 6 unique indexes, 4 cascade FKs, and the intended
  non-unique indexes (see Migration below).

## Decisions

- **ID strategy:** UUID v7 (`@default(uuid(7))`) on every auth model —
  time-ordered, non-guessable, single consistent strategy.
- **Email normalization:** `trim` + `lowercase` into `emailNormalized`, enforced
  unique by a stored column (not hidden DB behavior). Original `email` preserved.
  No Gmail dot/plus rewriting.
- **Provider:** `AuthProvider` enum. `providerAccountId` is the Google OIDC
  `sub` for Google; the normalized email for CREDENTIALS.
- **Password hash:** nullable `AuthAccount.passwordHash`, set only for
  CREDENTIALS; never on `User`; no plaintext/reversible/hint storage.
- **Provider uniqueness:** `UNIQUE (provider, providerAccountId)` and
  `UNIQUE (userId, provider)`.
- **Session/refresh:** `refreshTokenHash` unique (hash only); `expiresAt`,
  `lastUsedAt`, `revokedAt`; indexes on `userId` and `expiresAt`. Supports
  single-active-session invalidation as later business logic, not a DB
  constraint.
- **Tokens:** hashed `tokenHash` (unique), `expiresAt`, `consumedAt` for
  single-use; separate verification and reset tables.
- **Cascade:** all auth child records `ON DELETE CASCADE` from `User`.
- **Not modeled:** `userAgent`/`ipAddress` (no current requirement), Customer,
  addresses, orders, cart, roles/permissions.
- **Reset script:** implemented via schema drop + `migrate deploy` because
  Prisma 7's `migrate reset` cannot run non-interactively.

## Migration

- **Name:** `20260913164639_add_authentication_domain`.
- **Tables (5):** `users`, `auth_accounts`, `auth_sessions`,
  `email_verification_tokens`, `password_reset_tokens`.
- **Enum (1):** `AuthProvider` = `CREDENTIALS`, `GOOGLE`.
- **Unique constraints/indexes (6):** `users.emailNormalized`;
  `auth_accounts(provider, providerAccountId)`; `auth_accounts(userId, provider)`;
  `auth_sessions.refreshTokenHash`; `email_verification_tokens.tokenHash`;
  `password_reset_tokens.tokenHash`.
- **Foreign keys (4):** each child `userId` → `users(id)`
  `ON DELETE CASCADE ON UPDATE CASCADE`.
- **Indexes (4 non-unique):** `auth_sessions.userId`, `auth_sessions.expiresAt`,
  `email_verification_tokens.userId`, `password_reset_tokens.userId`.
- **SQL review findings:** generated SQL matched intent; `id` columns are `TEXT`
  with no DB default (UUID v7 is client-generated), so raw SQL inserts must
  supply `id`. No redundant indexes (the `(userId, provider)` unique index also
  serves `userId` prefix lookups, so no extra `auth_accounts.userId` index).

## Follow-ups

- A-002 — Credentials registration and password hashing.
- Provider-account linking must never auto-link on an untrusted email claim;
  linking on a provider-verified email is a future explicit decision (schema is
  ready).
- Consider session `userAgent`/`ipAddress` only if a concrete requirement appears.
- `docker/api.Dockerfile`/web image still unverified by an actual build
  (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
