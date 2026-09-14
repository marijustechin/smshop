# A-009 — Authentication Security Hardening

## Status

DONE

## Objective

Harden the completed auth system against automated abuse: Cloudflare Turnstile on
the four public abuse-sensitive endpoints, endpoint-specific rate limiting, safe
fail-closed semantics, frontend Turnstile integration, security tests, and an
audit of logging/secrets/error exposure. No changes to identity/session design.

## Context

A-001–A-008 completed the auth system. A-009 adds abuse controls. Turnstile
credentials exist locally (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).

## Dependencies

H-000–H-009; A-001–A-008.

## Scope

1. Create this task and mark it current.
2. Env contract: `TURNSTILE_SECRET_KEY` (backend secret, `_FILE` support),
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public frontend).
3. Backend `TurnstileVerifier` boundary + Cloudflare Siteverify implementation.
4. Guard `register`, `login`, `forgot-password`, `resend-verification`.
5. Endpoint-specific rate limiting (in-memory, injectable) + 429.
6. Frontend Turnstile widget on the affected forms; Lithuanian error mapping.
7. Backend + frontend tests (no Cloudflare network); docs; audit; lifecycle.

## Out of Scope

RBAC/admin/editor, Customer, account-linking UI, 2FA, device/session management,
Redis, token redesign, Google OAuth redesign, general CSP/header infra,
deploy/Oracle, commit, push.

## Acceptance Criteria

- [x] `TurnstileVerifier` + Cloudflare Siteverify exist
- [x] register/login/forgot-password/resend-verification require Turnstile
- [x] other auth routes are not unnecessarily gated
- [x] secret stays backend-only; frontend uses only the public site key
- [x] failed challenge blocks business logic (before Argon2/DB/mail)
- [x] provider failure fails closed
- [x] endpoint-specific rate limiting exists; excess → 429
- [x] enumeration protections still hold
- [x] A-008 refresh/session semantics intact; Google OAuth intact
- [x] automated tests make no Cloudflare calls
- [x] manual Turnstile browser flow succeeds
- [x] docs updated; `pnpm verify`/`pnpm verify:db` pass

## Required Verification

```bash
nvm use
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:db
git diff --check
git status --short
git ls-files | grep -E '(^|/)\.env($|\.)'
```

## Implementation Result

- Added `apps/api/src/modules/auth/security/`:
  - `turnstile/` — `TurnstileVerifier` boundary + token, `CloudflareTurnstileVerifier`
    (Siteverify, injectable fetch, fail-closed, no secret/token logging),
    `TurnstileGuard`, exceptions (`TURNSTILE_REQUIRED`/`TURNSTILE_FAILED`).
  - `rate-limit/` — `RateLimiter` + `InMemoryRateLimiter` (injectable clock),
    `@RateLimit(...)` decorator + `RateLimitGuard`, `RateLimitExceededException`
    (429 + `Retry-After`).
  - `security.module.ts` wiring both providers.
- `AuthController`: `@RateLimit` + `@UseGuards` on register/login/forgot/resend
  (Turnstile) and modest limits on verify-email/reset-password; other routes
  untouched.
- DTOs: optional `turnstileToken` on the four protected requests.
- Env: `TURNSTILE_SECRET_KEY` (secret, `_FILE` support, optional → disabled).
- Frontend: `components/turnstile.tsx` (`TurnstileWidget` + `useTurnstileGate`);
  forms on login/registracija/forgot + login resend gate on and send the token,
  remounting after each attempt; `messages.ts` maps 429 + Turnstile codes.
- Docs: `docs/authentication.md`, `docs/configuration.md`,
  `docs/frontend-authentication.md`; `.env.example` (api + web).

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm verify` → exit 0 (API 18 files / 99 tests, web 11 files / 70 tests,
  builds). `pnpm verify:db` → exit 0 (8 DB files / 107 tests).
- `git diff --check` → exit 0; tracked `.env` files are `.env.example` only.
- Security/logging audit: no `console.*` in app source; logger calls are
  sanitized warnings with no tokens/bodies; no backend secret referenced in web
  source; no `.env`/secret files tracked.
- Manual browser (Chromium/CDP, isolated test DB): with the real local site key
  the widget fails `110200 domain not allowed` on `localhost`, so the end-to-end
  flow was verified with Cloudflare's official always-pass **test keys**
  (documented local approach): register `→` success, login `→` `/paskyra`,
  logout `→` `/prisijungti`, forgot `→` generic message; all with the widget
  challenge completed and the backend enforcing Turnstile. With the real secret,
  a tokenless `POST /api/auth/login` returned `403 TURNSTILE_REQUIRED`. No
  secrets/tokens printed; test DB reset afterward.

## Decisions

- **Turnstile boundary:** provider-neutral `TurnstileVerifier`; Cloudflare
  Siteverify server-side; widget result never trusted alone. Guard runs before
  validation/business logic. Fail closed on failure/outage once configured; the
  feature is disabled when no secret is set (dev/CI). Enforced only on the four
  abuse-sensitive endpoints.
- **Rate limiting:** small injectable in-memory fixed-window limiter + guard
  rather than a dependency, because the DB test harness needs deterministic
  control and the task asks for a controllable store; suitable for the
  single-instance deployment (horizontal scaling would need a shared store).
  Policies: login 5/min; register/forgot/resend 5,3,3/10min; verify/reset
  20/10min; refresh/logout/me unlimited.
- **Client identity:** key on `request.ip`; `trustProxy` left default `false` so
  `X-Forwarded-For` is not trusted (unspoofable). Production proxy trust is an
  explicit infra follow-up.
- **Enumeration:** Turnstile/rate-limit errors are account-independent, so
  login/forgot/resend privacy is preserved.
- **Test keys for manual local use:** the real site key is domain-restricted, so
  the widget cannot run on `localhost`; Cloudflare's always-pass test keys are
  used for local end-to-end verification (never committed).

## Follow-ups

- **Infrastructure:** configure Fastify `trustProxy` for the known production
  proxy hops in `sm-oracle-infra` so rate limits apply per real client IP.
- A-010 — Authentication v1 milestone verification.
- Horizontal scaling would require a shared rate-limit store.
- Docker images still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-14
Commit: not committed (pending explicit request)
