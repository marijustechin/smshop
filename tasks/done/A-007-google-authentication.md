# A-007 — Implement Google Authentication and Safe Account Linking Policy

## Status

DONE

## Objective

Implement Google OAuth 2.0 / OpenID Connect (Authorization Code + PKCE + state +
nonce) reusing the A-005 session architecture. Never auto-link a Google identity
to an existing User by email; return `ACCOUNT_LINK_REQUIRED` for collisions.
No frontend work.

## Context

A-001–A-006 completed the auth domain, registration, SMTP, verification,
login/session lifecycle, and password recovery. `AuthAccount` already supports
`GOOGLE` keyed by OIDC `sub`. This task adds the Google provider flow.

## Dependencies

H-000–H-009; A-001–A-006.

## Scope

1. Create this task and mark it current.
2. Select and document a modern OIDC library.
3. Promote `GOOGLE_*` config to all-or-none activation; secret-file support.
4. OAuth transaction cookie + Google identity validation.
5. Identity resolution: existing `sub`, new User, email collision, unverified/
   missing email.
6. Start/callback endpoints reusing A-005 session issuance + refresh cookie.
7. Unit + provider-stub tests (no Google network); docs; lifecycle.

## Out of Scope

Frontend pages, automatic email-based linking, password creation for Google-only
accounts, Google API token storage, offline access, Gmail/Drive/etc., RBAC,
Customer, 2FA, device management, Oracle, commit, push.

## Acceptance Criteria

- [x] Google Authorization Code/OIDC flow exists
- [x] modern Node 24/ESM-compatible library selected and documented
- [x] only `openid email profile` scopes requested
- [x] state validation exists
- [x] PKCE/nonce decisions are implemented/documented
- [x] Google identity is keyed by OIDC `sub`
- [x] Google email must be verified for new User creation
- [x] existing Google `sub` logs into the same User
- [x] new Google identity can create a new User
- [x] email collision never auto-links
- [x] collision results in `ACCOUNT_LINK_REQUIRED`
- [x] Google-only User has no password
- [x] Google tokens are not persisted
- [x] existing AuthSession model is reused
- [x] single-active-session policy is preserved
- [x] refresh token remains httpOnly cookie only
- [x] no access/refresh token appears in redirect URLs
- [x] OAuth cancellation/failure is safe
- [x] transient state is single-use/short-lived
- [x] automated tests make no Google network calls
- [x] docs/config updated
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
```

## Implementation Result

- Dependency: `openid-client@6.8.8` (ESM, Node 24, `jose` + `oauth4webapi`).
- Added `apps/api/src/modules/auth/google/`:
  - `google.config.ts` (`readGoogleOidcConfig`, `GOOGLE_OIDC_CONFIG`).
  - `google-oidc.provider.ts` (boundary interface + token + `GoogleNotConfiguredError`).
  - `openid-client-google.provider.ts` (Authorization Code + PKCE + nonce; scopes
    `openid email profile`; lazy cached discovery; `GOOGLE_SCOPES`).
  - `oauth-transaction-cookie.service.ts` (`smshop_oauth_txn`, httpOnly/Lax/Secure-prod/Path/Max-Age=600).
  - `oauth-transaction.ts` (HMAC-signed, expiring payload encode/decode).
  - `google-account.service.ts` (`resolveIdentity`, fail-closed collision handling).
  - `google-auth.service.ts` (start/callback orchestration, session reuse).
  - `google-auth.controller.ts` (`GET /api/auth/google`, `GET /api/auth/google/callback`).
  - `google.module.ts`.
- Refactored session infra into `session/auth-session.module.ts` +
  `password/password.module.ts`; `AuthSessionService.createSession(userId)` is now
  shared by credentials login and Google.
- Config: `GOOGLE_*` promoted to all-or-none grouped validation; secret-file support.
- Tests: `auth-google.db-spec.ts` (14 DB/API), `openid-client-google.provider.spec.ts`,
  Google cases in `env.validation.spec.ts`; `auth-app.ts` supports a provider stub.
- Docs: `docs/authentication.md`, `docs/configuration.md`, `.env.example`.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm db:test:reset` / `db:test:migrate` → exit 0.
- `pnpm test:db` → 7 files / 92 tests passed.
- `pnpm verify` → exit 0 (API 15 files / 79 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0.
- `git diff --check` → exit 0.
- Manual real-Google flow: **completed successfully** against the isolated test
  DB with the configured Google test user (`m.smiginas@gmail.com`): Google
  authorization succeeded; callback state/PKCE/nonce validation succeeded; a
  Google-only `User`/`AuthAccount` was created; `providerAccountId` was the
  numeric Google `sub` (not the email); `emailVerifiedAt` was set; no password
  hash was created; no Google tokens were persisted (no such columns); exactly
  one active session existed, refresh returned an access token, `/me` returned
  `emailVerified: true`, and logout revoked the session (refresh after logout
  `401`). Raw tokens/secrets were not printed; the test DB was reset afterward.
- Security hardening: the OAuth transaction cookie payload is HMAC-SHA256 signed
  (key derived from `JWT_ACCESS_SECRET` via HKDF) with an explicit expiry, so it
  is tamper-evident. Added `oauth-transaction.spec.ts` (tamper/forgery/expiry
  unit tests) and two callback tampering tests in `auth-google.db-spec.ts`.

## Decisions

- **Library:** `openid-client` v6 (modern, ESM, standards-based; avoids Passport
  and Google SDKs). Authorization Code + PKCE (`S256`) + `state` + OIDC `nonce`.
- **Identity:** OIDC `sub` is authoritative; email is not an identifier. Existing
  `sub` maps to its `User`; a changed Google email does not rewrite `User.email`.
- **Email/verification:** new User requires `email_verified === true` and an email;
  `emailVerifiedAt = now`; missing/unverified email is rejected.
- **Collision:** a new `sub` whose normalized email matches an existing `User`
  returns `account-link-required` and never auto-links, even with verified email.
  Uniqueness races are re-checked by `sub` and fail closed on collision.
- **Google tokens:** not persisted; only `(GOOGLE, sub)` is stored. No offline access.
- **Transaction cookie integrity:** HMAC-SHA256 over the payload (key via HKDF from
  `JWT_ACCESS_SECRET`) with an explicit `exp`; forged/unsigned/tampered/expired
  payloads are rejected before use.
- **Sessions:** existing A-005 `AuthSession` via shared `createSession`; single
  active session; refresh cookie only (no tokens in redirect URLs).
- **Callback:** `redirect(url, 302)` explicit (Fastify v5 reuses an already-set status).
- **A disabled Google** still lets the app start; `/api/auth/google` returns 503.

## Follow-ups

- A-008 — Frontend authentication flows (consume `oauth=success` /
  `account-link-required`, `POST /refresh`, `/me`, `/paskyra`; explicit account
  linking from an authenticated session).
- A-009 — Auth security hardening / rate limiting.
- Register the OAuth client + Authorized redirect URI in Google Cloud for real
  development login.
- Docker images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
