# A-010 — Authentication v1 Milestone Verification

## Status

DONE

## Objective

Final end-to-end milestone gate for Authentication v1: prove the complete
A-001–A-009 slice works coherently across credentials registration, email
verification, login, session bootstrap/refresh/logout, password recovery, Google
authentication, Turnstile, rate limiting, frontend protected-route behaviour, and
security/configuration/documentation consistency. No new capabilities; fix only
concrete defects.

## Context

A-001–A-009 delivered the full auth slice. This task is verification only.

## Dependencies

H-000–H-009; A-001–A-009.

## Scope

1. Create this task and mark it current.
2. Clean-baseline confirmation and full automated verification (fresh DB).
3. End-to-end scenario verification across backend and frontend.
4. Security audits (browser storage, DB storage, logging, secrets).
5. Configuration/documentation/proxy-follow-up/invariant audit.
6. Mark Authentication v1 COMPLETE and complete the lifecycle.

## Out of Scope

Roles, ADMIN/EDITOR, Customer, account-linking UI, 2FA, device/session
management, other social providers, remember-me, catalog/shop features. Oracle
infrastructure changes.

## Acceptance Criteria

- [x] all automated verification passes
- [x] fresh DB/migrations work
- [x] credentials registration works
- [x] real verification flow works
- [x] credentials login works
- [x] session restore works
- [x] refresh rotation works
- [x] single-session invariant works
- [x] logout works
- [x] password recovery works
- [x] password reset revokes sessions
- [x] Google authentication works
- [x] safe Google collision policy verified
- [x] Turnstile enforcement works
- [x] rate limiting works
- [x] frontend bootstrap failure semantics correct
- [x] `returnTo` is safe
- [x] browser token storage correct
- [x] DB contains no raw secrets/tokens
- [x] logging audit passes
- [x] config audit passes
- [x] docs match implementation
- [x] production proxy follow-up remains tracked
- [x] repository secret audit passes
- [x] all final auth invariants confirmed
- [x] Authentication v1 marked COMPLETE

## Required Verification

```bash
nvm use
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:db
git diff --check
git status --short
```

## Implementation Result

Verification-only. No application code changes and no defects found. Added the
production proxy-trust follow-up to `tasks/TODO.md` and marked Authentication v1
COMPLETE.

- Clean baseline `HEAD == origin/main == dfc6e61` (only this task file + TODO
  changed during the audit).
- Fresh test DB reset applied the migration from scratch; all suites green.
- A comprehensive API E2E harness (real PostgreSQL, real app, controlled
  mail/Google/Turnstile boundaries, real in-memory limiter) ran **44/44 checks**
  across registration, verification, login, refresh rotation, single-session,
  logout, forgot/reset + session revocation, Google new-user + collision,
  Turnstile, and rate limiting.
- Browser audits (Chromium/CDP): storage, cookie flags, bootstrap outage
  semantics, unauthenticated redirect.
- DB, logging, config, and secret audits all clean.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm verify` → exit 0 (API 18 files / 99 tests, web 11 files / 70 tests, builds).
- `pnpm verify:db` → exit 0 (8 DB files / 107 tests).
- `pnpm verify:ci` (local, test DB) → exit 0.
- `git diff --check` → exit 0; tracked `.env` files are `.env.example` only.
- E2E harness: 44 PASS / 0 FAIL (temporary file deleted).
- Browser: localStorage `[]`, sessionStorage `[]`, IndexedDB only Next.js
  `__next_debug_channel`, `document.cookie` empty, refresh cookie httpOnly/Lax/
  `/api/auth`; API outage → `/paskyra` shows retry UI and does not redirect;
  unauthenticated → `/prisijungti?returnTo=/paskyra`.
- DB: application tables are hash-only (Argon2 password hashes, 64-hex token
  hashes, Google `sub` without `@`); no raw secret/token columns.
- Config: no `JWT_REFRESH` config, no `baseUrl`, no `ignoreDeprecations`.

## Decisions

- No defects found; no code changes. The 4 initial E2E FAILs were harness
  sequencing (counting revoked session rows; rate-limit interference), fixed in
  the harness and confirmed green.
- Production `trustProxy` configuration remains a tracked infrastructure
  follow-up (documented in `docs/authentication.md` and `tasks/TODO.md`).

## Follow-ups

- Infrastructure: configure Fastify `trustProxy` for known proxy hops before launch.
- Next milestone (M3+) decided separately; no A-011 auth task started.
- Docker images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-14
Commit: not committed (pending explicit request)
