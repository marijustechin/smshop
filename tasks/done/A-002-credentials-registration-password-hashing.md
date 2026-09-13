# A-002 — Implement Credentials Registration and Password Hashing

## Status

DONE

## Objective

Implement the first Auth v1 flow: Argon2id password hashing behind a dedicated
boundary and a `POST /api/auth/register` endpoint that atomically creates a
`User` + `CREDENTIALS` `AuthAccount`, with DTO validation and duplicate-email
handling. No login, tokens, email, reset, OAuth, or frontend.

## Context

A-001 established the auth persistence model and migration. H-005 established Zod
config validation; DTO validation was not configured. H-006 provides the real
test database.

## Dependencies

H-000 through H-008; A-001.

## Scope

1. Create this task and mark it current.
2. Add global NestJS DTO validation (Zod-based, consistent with H-005).
3. Add an Argon2id `PasswordHasher` boundary with explicit parameters.
4. Add `AuthModule` (`auth.controller`, `auth.service`, `dto/`, `password/`).
5. Implement transactional registration with unique-constraint-driven duplicate
   handling.
6. Add password-hasher unit tests and real-DB registration API tests.
7. Update `docs/authentication.md`; complete the lifecycle (A-003 next, unstarted).

## Out of Scope

Login, JWT, refresh/session creation, logout, email sending, verification/reset
flows, Google OAuth, frontend pages, Customer, RBAC, Oracle, commit, push.

## Acceptance Criteria

- [x] credentials registration endpoint exists
- [x] registration DTO/input validation exists
- [x] password policy is documented
- [x] passwords use a modern secure hash
- [x] password hashing is isolated behind a focused boundary
- [x] plaintext passwords are never persisted
- [x] User + CREDENTIALS AuthAccount creation is atomic
- [x] normalized email uniqueness is handled correctly
- [x] duplicate registration produces a safe application error
- [x] CREDENTIALS account always receives a password hash
- [x] new credentials email remains unverified
- [x] safe registration response exists
- [x] real DB-backed registration tests exist
- [x] password hashing tests exist
- [x] duplicate/race behaviour is tested where practical
- [x] documentation is updated
- [x] no login/token/email/OAuth functionality was added
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

- Added `apps/api/src/auth/`:
  - `auth.module.ts`, `auth.controller.ts` (`POST /api/auth/register`, 201),
    `auth.service.ts` (transactional registration + `P2002` → `409`).
  - `dto/register.dto.ts` (nestjs-zod `.strict()` schema).
  - `password/password-hasher.ts` (interface + `PASSWORD_HASHER` token),
    `password/argon2-password-hasher.ts` (Argon2id), `password/password-policy.ts`.
- Added global Zod DTO validation via `APP_PIPE` (`ZodValidationPipe`) in
  `app.module.ts`; `PrismaModule` (`@Global`) provides one `PrismaService`.
- Added `@node-rs/argon2@2.2.1` and `nestjs-zod@5.5.0` (Zod already present).
- Tests: `argon2-password-hasher.spec.ts` (6 unit tests) and
  `test/database/auth-registration.db-spec.ts` (12 real-DB HTTP tests).
- Updated `docs/authentication.md` with registration behaviour, password policy,
  hashing, normalization, duplicate semantics, transaction boundary, errors.
- No login/token/session/email/reset/OAuth/RBAC/Customer code was added.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm db:test:up` / `db:test:reset` / `db:test:migrate` → exit 0.
- `pnpm test:db` → 3 files / 32 tests passed (4 H-006 + 16 A-001 + 12 registration).
- `pnpm verify` → exit 0 (API 5 files / 27 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0.
- `git diff --check` → exit 0; `git status --short` → intended files only.
- Runtime smoke test of the production build: `201` with
  `{id, email, emailVerified:false}`, duplicate `409`, invalid `400`.

## Decisions

- **DTO validation:** `nestjs-zod` + existing Zod, matching the H-005 decision to
  keep a single schema-validation library rather than adding
  `class-validator`/`class-transformer`. Unknown fields are rejected (`.strict()`).
- **Hashing:** Argon2id via `@node-rs/argon2` (prebuilt `linux-x64-gnu` for CI and
  `linux-arm64-gnu` for deployment; ESM; no native build step). Parameters
  `m=19456,t=2,p=1` (OWASP baseline). Hidden behind `PasswordHasher`/`PASSWORD_HASHER`.
- **Password policy:** length only, 12–128, no composition rules, no truncation.
- **Normalization:** keep original-cased `email` (trimmed); `emailNormalized` =
  lowercase. DTO trims/validates but does not lowercase; the service derives the
  normalized value so `User.email` preserves the original.
- **Credentials invariant:** `passwordHash` always set for `CREDENTIALS` in
  `AuthService`; a DB `CHECK` constraint is deferred (Prisma does not model it;
  a hand-edited migration would be an untracked schema hack). Application owns it.
- **Duplicate/race:** unique constraint is authoritative; `$transaction` ensures
  atomicity; `P2002` maps to a clean `409` without leaking Prisma internals.

## Follow-ups

- A-003 — Email infrastructure (next).
- Add email verification and password reset flows (A-004/A-006).
- Consider the deferred `CHECK (CREDENTIALS → passwordHash IS NOT NULL)` if a
  future Prisma version supports database constraints.
- Rate limiting / enumeration hardening remains A-009.
- Docker api/web images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
