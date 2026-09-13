# A-005 — Implement Login, Access Tokens, Refresh Sessions and Logout

## Status

DONE

## Objective

Implement credentials login plus the authenticated session lifecycle: short-lived
access JWT, opaque refresh token in an httpOnly cookie, server-side `AuthSession`,
single active session, refresh rotation, logout, and `/api/auth/me`. Real
DB-backed tests. No password reset, Google OAuth, frontend, RBAC, or 2FA.

## Context

A-001–A-004 provide the auth persistence, credentials registration/hashing, SMTP,
and email verification. `AuthSession` already exists. This task adds the
login/session flow using the reserved `JWT_*` config.

## Dependencies

H-000–H-009; A-001; A-002; A-003; A-004.

## Scope

1. Create this task and mark it current.
2. Session/token services: access JWT sign/verify, refresh gen/hash, `AuthSession`
   lifecycle.
3. Endpoints: `POST /api/auth/login`, `POST /api/auth/refresh`,
   `POST /api/auth/logout`, `GET /api/auth/me` (guarded).
4. Fastify cookie support + explicit CORS with credentials.
5. Env/config changes (promote JWT settings, rename session TTL, defaults).
6. Unit + real-DB/API tests (login, single session, refresh, logout, guard).
7. Docs; manual lifecycle verification; lifecycle.

## Out of Scope

Password recovery, Google OAuth, frontend, RBAC, Customer, 2FA, remember-me,
multiple sessions, device management, broad rate limiting, Oracle, commit, push.

## Acceptance Criteria

- [x] credentials login exists
- [x] unknown/wrong credentials are enumeration-safe
- [x] unverified credentials accounts cannot login
- [x] short-lived access JWT exists
- [x] access token claims are minimal
- [x] refresh token is opaque/random
- [x] raw refresh token is never persisted
- [x] refresh token is stored only in httpOnly cookie
- [x] AuthSession is created server-side
- [x] single-active-session behaviour works
- [x] refresh rotation works
- [x] old refresh token becomes unusable
- [x] session expiry/revocation works
- [x] logout revokes session and clears cookie
- [x] `/api/auth/me` is protected
- [x] CORS/cookie behaviour is configured correctly
- [x] CSRF decision is documented
- [x] DB/API tests cover the lifecycle
- [x] documentation is updated
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

- Added `apps/api/src/modules/auth/session/`:
  - `auth-tokens.ts` — refresh generate/hash, `parseDurationMs`.
  - `access-token.service.ts` — JWT sign/verify (`sub`, `sid`).
  - `auth-session.service.ts` — login/refresh/logout/me.
  - `access-token.guard.ts`, `current-identity.decorator.ts`.
  - `refresh-cookie.service.ts` — httpOnly cookie set/clear.
- Added `dto/login.dto.ts`; extended `AuthController` with login/refresh/logout/me;
  `AuthModule` imports `JwtModule.registerAsync` + providers.
- Added `apps/api/src/app.setup.ts` (shared Fastify cookie + CORS + prefix),
  used by `main.ts` and the test harness.
- Env: `JWT_ACCESS_SECRET` + `WEB_ORIGIN` required; `JWT_ACCESS_TTL` (15m) and
  `AUTH_SESSION_TTL` (7d, controls the session and refresh cookie) defaults; no
  refresh signing secret (refresh tokens are opaque).
- Deps: `@nestjs/jwt@11.0.2`, `@fastify/cookie@11.1.2`, `fastify@5.11.3`.
- Tests: `auth-session.db-spec.ts` (14 DB/API tests), `auth-tokens.spec.ts`
  (unit); updated `auth-app.ts`, `setup-env.ts`, `env.validation.spec.ts`.
- Docs: `docs/authentication.md`, `docs/configuration.md`, `.env.example`,
  CI env, `tasks/TODO.md`.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm db:test:reset` / `db:test:migrate` → exit 0.
- `pnpm test:db` → 5 files / 63 tests passed.
- `pnpm verify` → exit 0 (API 10 files / 58 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0.
- `git diff --check` → exit 0; `git status --short` → intended files only.
- Manual lifecycle (temporary harness, deleted): login 200, cookie set, `/me`
  200, refresh rotated, old refresh 401, new refresh 200, logout 204, refresh
  after logout 401.

## Decisions

- **Access JWT** (`@nestjs/jwt`): claims `sub`+`sid` only; TTL `15m`; stateless
  during its lifetime (no per-request DB session lookup).
- **Refresh token:** opaque `randomBytes(32)` base64url, SHA-256 hash stored; no
  refresh signing secret exists.
- **Single active session:** login revokes prior active sessions and creates one.
- **Rotation:** atomic conditional update; old token unusable after refresh.
- **Replay:** old token rejected; enhanced replay-triggered revocation deferred
  (single-hash model).
- **Cookie:** `smshop_refresh_token`, HttpOnly, SameSite=Lax, Path=/api/auth,
  Max-Age=refresh TTL, Secure only in production.
- **CORS:** explicit `WEB_ORIGIN` + `credentials: true` (no wildcard).
- **CSRF:** httpOnly SameSite=Lax + explicit origin is sufficient for the
  same-site topology; no CSRF token added, documented.
- **Enumeration:** identical 401 for unknown/wrong; dummy-hash verify for missing
  accounts; distinct 403 `EMAIL_NOT_VERIFIED` only after a valid password.

## Follow-ups

- A-006 — Password recovery.
- Enhanced refresh-replay revocation if the model gains token history.
- A-008 frontend session restoration/`/paskyra`; A-009 rate limiting.
- Local `.env` now needs `WEB_ORIGIN` and `JWT_ACCESS_SECRET` (documented in
  `.env.example`).
- Docker images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
