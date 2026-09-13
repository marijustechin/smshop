# A-008 — Implement Frontend Authentication Flows

## Status

DONE

## Objective

Implement the Lithuanian-only frontend authentication experience on the existing
Next.js App Router backend: routes, credentials login, registration,
email-verification handling, forgot/reset password, Google login entry and OAuth
outcomes, memory-only access token with coordinated session bootstrap, protected
`/paskyra`, logout, and safe `returnTo`. Storefront stays public. No RBAC,
Customer, checkout, or Turnstile.

## Context

A-001–A-007 delivered the backend auth API. The web app is a bare Next.js
scaffold; this task bootstraps the minimal UI/form stack (Tailwind, shadcn-style
primitives, React Hook Form, Zod) and builds the auth slice.

## Dependencies

H-000–H-009; A-001–A-007.

## Scope

1. Create this task and mark it current.
2. Bootstrap Tailwind + minimal UI primitives + RHF/Zod + jsdom test setup.
3. API client with configurable origin + credentials; memory-only token.
4. Auth provider: bootstrap, coordinated refresh, login/logout.
5. Routes: `/prisijungti`, `/registracija`, `/patvirtinti-el-pasta`,
   `/pamirsau-slaptazodi`, `/atkurti-slaptazodi`, protected `/paskyra`; root stays public.
6. `returnTo` safety; OAuth query handling; query cleanup.
7. Frontend tests; docs; manual browser verification; lifecycle.

## Out of Scope

Admin/Editor/RBAC, Customer/addresses/orders/checkout, catalog, Turnstile, rate
limiting, account-linking UI, multi-session/device management, access-token
persistence, backend changes, Oracle, commit, push.

## Acceptance Criteria

- [x] `/` remains public
- [x] `/prisijungti`, `/registracija`, `/patvirtinti-el-pasta`,
      `/pamirsau-slaptazodi`, `/atkurti-slaptazodi` exist
- [x] `/paskyra` exists and is protected
- [x] credentials login works
- [x] Google login browser flow works
- [x] registration works (resend verification)
- [x] email verification works
- [x] forgot/reset password work
- [x] session bootstrap works after refresh
- [x] access token is memory-only
- [x] refresh token is never read by JS
- [x] token refresh is coordinated
- [x] logout works
- [x] `returnTo` is local-path safe
- [x] OAuth frontend outcomes handled
- [x] Lithuanian UX throughout
- [x] no roles/RBAC
- [x] frontend tests pass
- [x] `pnpm verify` passes

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

- Bootstrapped the frontend UI/form stack (the app was a bare scaffold): Tailwind
  v4 (`@tailwindcss/postcss`, `globals.css` tokens), minimal shadcn-style
  primitives (`button`, `input`, `label`, `card`, `alert`), React Hook Form +
  Zod, and jsdom + Testing Library.
- API layer: `src/lib/api/config.ts` (single configurable origin),
  `src/lib/api/client.ts` (`fetch` + credentials, `ApiError`).
- Auth core: `auth-context.tsx` (memory-only access token in a ref, bootstrap,
  single-flight refresh, `authedRequest` one-retry, login/logout),
  `return-to.ts` (open-redirect-safe), `messages.ts` (Lithuanian mapping),
  `api.ts` (typed endpoints).
- Routes: `/prisijungti`, `/registracija`, `/patvirtinti-el-pasta`,
  `/pamirsau-slaptazodi`, `/atkurti-slaptazodi`, protected `/paskyra`; root `/`
  stays public with dev links. `layout.tsx` is `lang="lt"` and wraps `AuthProvider`.
- Verification/reset pages consume `?token=`, dedupe (single-flight per token),
  and strip the token from the URL.
- Tests: 55 frontend tests across auth state, `returnTo`, error mapping, and all
  forms/pages/OAuth outcomes.
- Docs: `docs/frontend-authentication.md`; `apps/web/.env.example`; README link.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm verify` → exit 0 (API 15 files / 79 tests, web 9 files / 55 tests, builds).
- `pnpm verify:db` → exit 0.
- `git diff --check` → exit 0.
- Manual browser verification (real frontend + API + test DB, Chromium/CDP):
  unverified-login prompt, verification-link success, login → `/paskyra`,
  email/verified display, browser-refresh session restore, `oauth=success`
  handoff, `account-link-required`/`failed` copy, logout, protected redirect,
  forgot generic message, registration confirmation, reset success, login with new
  password, distinct and unsafe `returnTo`. Real verification/reset tokens were
  captured via a temporary harness (deleted) using the production code path with
  a stubbed transport; no tokens/secrets printed. Test DB reset afterward.

## Decisions

- **State:** access token in a `useRef` (memory only); refresh token only in the
  backend httpOnly cookie. No `localStorage`/`sessionStorage`/JS cookies.
- **Status semantics:** `unknown` | `authenticated` | `unauthenticated` | `error`.
  Only a confirmed `401` marks `unauthenticated`; transient/network/`5xx`
  failures mark `error` (recoverable) and never clear a potentially valid
  session. `/paskyra` shows a retry on `error` and only redirects on confirmed
  `unauthenticated`.
- **Bootstrap/refresh:** one provider runs bootstrap once; `refreshAccessToken`
  is single-flight so concurrent 401s share one refresh (rotation-safe);
  `authedRequest` retries once then clears on confirmed `401`, propagating
  transient failures without logging the user out.
- **`returnTo`:** relative-only, rejects absolute/protocol-relative/backslash/
  control chars.
- **OAuth:** real navigation link to the backend start route; `oauth=success`
  bootstraps and redirects; outcome params are non-sensitive and intentionally
  left in the URL (sensitive token params are stripped on their pages).
- **UI stack bootstrapped** because it did not exist; only needed primitives
  added, no shadcn catalog, no Axios, no Google JS SDK, no Turnstile.

## Follow-ups

- A-009 — Authentication security hardening (Turnstile, rate limiting).
- A-008 note: real Google consent was verified in A-007; here the frontend
  `oauth=success` handoff was verified with a real session cookie (no re-consent).
- Local dev requires `NEXT_PUBLIC_API_BASE_URL` (documented in
  `apps/web/.env.example`).
- Docker web image still unverified by an actual build (pre-existing).

## Completion

Completed date: 2026-09-14
Commit: not committed (pending explicit request)
