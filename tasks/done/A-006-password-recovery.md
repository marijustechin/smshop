# A-006 — Implement Password Recovery

## Status

DONE

## Objective

Implement secure credentials password recovery: enumeration-safe forgot-password,
hashed single-use reset tokens with 1h TTL and rotation, a Lithuanian reset
email via `MailService`, a reset endpoint that re-hashes the password and revokes
all active sessions, plus real DB-backed tests. Also remove the unused
`baseUrl` from `apps/api/tsconfig.json`.

## Context

A-001–A-005 provide the auth persistence, `PasswordResetToken`, Argon2 hashing,
SMTP mail, verified-email requirement, and server-side sessions. This task adds
the reset flow reusing established patterns.

## Dependencies

H-000–H-009; A-001; A-002; A-003; A-004; A-005.

## Scope

1. Create this task and mark it current.
2. Remove obsolete `apps/api/tsconfig.json` `baseUrl`.
3. Shared secure-token primitive; reset token utility + constants + email.
4. `POST /api/auth/forgot-password` (enumeration-safe 202) and
   `POST /api/auth/reset-password` (re-hash + session revocation).
5. Unit + real-DB/API tests (forgot, reset, rotation, replay, session
   revocation, edge cases, email content).
6. Docs; manual verification; lifecycle.

## Out of Scope

Google OAuth, frontend, RBAC, Customer, 2FA, password history, remember-me,
multiple sessions, device management, broad rate limiting, Oracle, commit, push.

## Acceptance Criteria

- [x] forgot-password endpoint exists
- [x] forgot-password is enumeration-safe
- [x] only eligible credentials accounts receive reset tokens
- [x] reset token uses secure random entropy
- [x] raw token is never persisted
- [x] reset token is hashed with SHA-256
- [x] reset token has explicit TTL
- [x] repeated requests rotate old tokens
- [x] reset email is Lithuanian
- [x] reset link uses `WEB_ORIGIN` + `/atkurti-slaptazodi`
- [x] reset-password endpoint exists
- [x] valid token updates credentials password
- [x] expired token rejected
- [x] consumed token rejected
- [x] old password stops working
- [x] all active AuthSession rows are revoked after reset
- [x] user must login again after reset
- [x] automated tests do not use real SMTP
- [x] `apps/api/tsconfig.json` no longer contains unused deprecated `baseUrl`
- [x] no `ignoreDeprecations` workaround added
- [x] documentation updated
- [x] `pnpm verify` passes
- [x] `pnpm verify:db` passes

## Required Verification

```bash
nvm use
pnpm install --frozen-lockfile
pnpm db:test:reset
pnpm db:test:migrate
pnpm test:db
pnpm verify
pnpm verify:db
git diff --check
git status --short
grep -R '"baseUrl"' apps/api/tsconfig.json tsconfig*.json
grep -R 'ignoreDeprecations' .
```

## Implementation Result

- Removed the unused, deprecated `baseUrl` from `apps/api/tsconfig.json`
  (no `paths` aliases; typecheck/build pass under NodeNext).
- Added `apps/api/src/modules/auth/tokens/secure-token.ts` (shared
  `generateSecureToken`/`hashSecureToken`, `SECURE_TOKEN_BYTES`); refactored
  `verification-token.ts` to use it.
- Added `apps/api/src/modules/auth/password-reset/`: `password-reset.constants.ts`
  (1h TTL, `/atkurti-slaptazodi`), `password-reset-token.ts`,
  `password-reset-email.ts` (Lithuanian), `password-reset.service.ts`
  (`forgotPassword`/`resetPassword` + token rotation).
- Added `dto/forgot-password.dto.ts`, `dto/reset-password.dto.ts`; wired
  `POST /api/auth/forgot-password` (202) and `POST /api/auth/reset-password`
  (200) into `AuthController`; registered `PasswordResetService` in `AuthModule`.
- Tests: `secure-token.spec.ts`, `password-reset-token.spec.ts`,
  `password-reset-email.spec.ts`, `auth-password-reset.db-spec.ts` (12 DB/API).
- Docs: `docs/authentication.md`; `tasks/TODO.md`.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm db:test:reset` / `db:test:migrate` → exit 0.
- `pnpm test:db` → 6 files / 75 tests passed.
- `pnpm verify` → exit 0 (API 13 files / 67 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0.
- `git diff --check` → exit 0.
- `grep '"baseUrl"' apps/api/tsconfig.json tsconfig*.json` → none;
  `grep -R ignoreDeprecations .` → none.
- Manual real-SMTP flow (temporary harness, deleted): login 200, forgot 202 with
  real email accepted, link `http://localhost:3000/atkurti-slaptazodi?...`,
  reset 200, active sessions 0, old refresh 401, old password 401, new password 200. No secrets printed.

## Decisions

- **Eligibility:** reset issued only for a verified `CREDENTIALS` account with a
  password hash. Unverified accounts use the verification flow; Google-only
  accounts never receive a reset token.
- **Token:** shared `randomBytes(32)` base64url + SHA-256 hash; 1h TTL named
  constant; rotation consumes prior active tokens; single-use via `consumedAt`.
- **Enumeration:** all valid emails return the same 202 generic message,
  including on SMTP failure (logged internally).
- **Transaction:** token issuance/rotation and the reset mutations are
  transactional; email is sent only after commit.
- **Session revocation:** reset atomically revokes all active `AuthSession` rows.
  Access JWTs remain stateless until `JWT_ACCESS_TTL` expiry (documented).
- **baseUrl cleanup:** safe to remove — no `paths` aliases and all imports are
  relative/NodeNext-resolved; no `ignoreDeprecations` suppression added.
- Token utility refactor kept minimal (shared crypto primitive only).

## Follow-ups

- A-007 — Google authentication and safe account linking.
- A-009 rate limiting (forgot/reset abuse).
- A-008 reset/forgot frontend routes (`/pamirsau-slaptazodi`,
  `/atkurti-slaptazodi`).
- Docker images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
