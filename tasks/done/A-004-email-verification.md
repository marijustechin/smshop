# A-004 — Implement Email Verification

## Status

DONE

## Objective

Implement the credentials email-verification flow: registration issues a hashed
verification token and sends a Lithuanian verification email via `MailService`;
add verify-email and resend-verification endpoints with expired/used/invalid
handling, token rotation, enumeration protection, and real DB tests.

## Context

A-001 added `EmailVerificationToken`; A-002 added registration; A-003 added
provider-independent SMTP. This task wires them into a complete verification
flow. No login/JWT/reset/OAuth/frontend.

## Dependencies

H-000–H-009; A-001; A-002; A-003.

## Scope

1. Create this task and mark it current.
2. Token utility (crypto random + SHA-256 hash) and a named 24h TTL.
3. Lithuanian verification email builder (text + HTML).
4. Registration integration: token created in the User/AuthAccount transaction;
   email sent only after commit.
5. `POST /api/auth/verify-email` and `POST /api/auth/resend-verification`.
6. Unit + real-DB tests with mocked mail transport (no real SMTP).
7. Docs; manual opt-in dev verification email test; lifecycle.

## Out of Scope

Login, JWT, refresh/session, logout, password reset, Google OAuth, frontend,
Customer, 2FA, broad rate limiting, Oracle, commit, push.

## Acceptance Criteria

- [x] registration issues a hashed email-verification token
- [x] verification email is sent via `MailService`
- [x] email content is Lithuanian
- [x] verification link uses `WEB_ORIGIN` and `/patvirtinti-el-pasta`
- [x] raw token is never stored
- [x] token TTL exists
- [x] verification endpoint exists
- [x] valid token verifies User atomically
- [x] expired token is rejected
- [x] consumed token is rejected
- [x] old tokens are invalidated
- [x] resend endpoint exists
- [x] resend prevents account enumeration
- [x] verified users do not receive new verification tokens
- [x] unknown users do not leak existence
- [x] automated tests do not require real SMTP
- [x] documentation is updated
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

- Added `apps/api/src/modules/auth/email-verification/`: `verification-token.ts`
  (`randomBytes(32)` base64url + SHA-256), `email-verification.constants.ts`
  (24h TTL, `/patvirtinti-el-pasta` route), `verification-email.ts` (Lithuanian
  text + HTML), `email-verification.service.ts` (issue/verify/resend).
- Added `dto/verify-email.dto.ts`, `dto/resend-verification.dto.ts`.
- `AuthService.register` now creates the verification token inside the
  User/AuthAccount transaction and sends the email only after commit; the
  response adds `verificationEmailSent`.
- `AuthController` adds `POST /api/auth/verify-email` (200) and
  `POST /api/auth/resend-verification` (202 generic).
- `AuthModule` imports `MailModule`.
- Tests: updated `auth-registration.db-spec.ts`; added
  `auth-email-verification.db-spec.ts`, `auth-app.ts` (mail-stubbed test app),
  `verification-token.spec.ts`, `verification-email.spec.ts`; `setup-env.ts`
  sets `WEB_ORIGIN`.
- Docs: `docs/authentication.md`; TODO M2 checklist updated.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm db:test:reset` / `db:test:migrate` → exit 0.
- `pnpm test:db` → 4 files / 49 tests passed.
- `pnpm verify` → exit 0 (API 9 files / 49 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0.
- `git diff --check` → exit 0; `git status --short` → intended files only.
- Manual real-SMTP end-to-end (temporary harness, deleted): register `201`,
  verification email sent via real SMTP and captured, link shape
  `http://localhost:3000/patvirtinti-el-pasta?token=<redacted>`, verify `200
{verified:true}`, `emailVerifiedAt` set. Raw token never printed.

## Decisions

- **Token:** 32 random bytes `crypto.randomBytes` base64url (high entropy, not
  a UUID); SHA-256 hash persisted, raw never stored. SHA-256 (not Argon2) is
  correct for random secrets.
- **TTL:** 24 hours as a named constant (`EMAIL_VERIFICATION_TTL_HOURS`).
- **Transaction boundary:** User + AuthAccount + hashed token in one
  `$transaction`; email sent after commit. DB failure → no email; email failure
  → committed, resendable account. No distributed transaction.
- **Single active token:** `createActiveToken` consumes prior active tokens;
  successful verification consumes the token and invalidates the rest.
- **`verificationEmailSent`:** registration returns a partial-success contract
  rather than failing when mail is undeliverable.
- **Enumeration vs resend mail failure:** resend always returns the same generic
  `202` and logs delivery failures server-side; the message is conditional. This
  deliberately favours enumeration protection over signalling a transient
  delivery failure (which would leak account existence when unknown emails never
  attempt a send). Flagged for review.
- **Google-only accounts:** resend issues nothing and returns the same generic
  response.

## Follow-ups

- A-005 — Login, access token, refresh session and logout.
- Promote/derive `WEB_ORIGIN` handling if registration must hard-fail without it.
- Verification frontend route (`/patvirtinti-el-pasta`) belongs to A-008.
- Rate limiting / abuse protection remains A-009.
- Docker api/web images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
