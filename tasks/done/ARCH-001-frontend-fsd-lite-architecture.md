# ARCH-001 — Frontend FSD-lite architecture

## Status

**DONE — 2026-09-22.** The `apps/web` frontend was reorganized into a pragmatic
five-layer FSD-lite structure (`app`/`widgets`/`features`/`entities`/`shared`)
with enforced import boundaries. Source structure only: no route, API-contract,
auth-behaviour, cookie/session, Turnstile, Google, or error-message changes.

## Goal

Establish maintainable frontend module boundaries before catalogue/product work,
without changing observable behaviour, by moving generic infrastructure into
`shared`, the auth implementation into `features/auth`, and the user-domain model
into `entities/user`, and by enforcing the dependency direction with the existing
ESLint setup.

## Context

The accepted ARCH-000/ARCH-001 analysis approved FSD-lite with Next.js App Router
as the routing/composition layer. Current tree before the refactor mixed generic
UI, auth logic, and route files under `app/`, `components/`, and `lib/`.
Authoritative references: `docs/architecture.md` (frontend source layout),
`docs/frontend-authentication.md`, `docs/authentication.md`.

## Dependencies

- ARCH-000 (documentation/technical-debt reconciliation) — complete.
- No backend, database, deployment, or product dependency.

## Scope

1. Extract `shared/` (`ui`, `api`, `config`, `lib`) and its selective barrels.
2. Move the auth implementation into `features/auth` (`ui`, `model`, `api`) with
   a public `index.ts`.
3. Extract `AuthUser` into `entities/user`.
4. Minimal `app` composition/import cleanup (routes unchanged; `account-client`
   intentionally left in `app/paskyra`).
5. Enforce layer boundaries with ESLint `no-restricted-imports` only.
6. Document the decision in `docs/architecture.md` and update `tasks/TODO.md`.

## Out of scope

- Classic FSD `pages/` and `processes/` layers.
- Any behavior, route/URL, API-contract, auth, cookie, Turnstile, or Google
  change.
- Backend/API, database, deployment, or product/catalogue work.
- New runtime dependencies or FSD-specific tooling.
- Moving `app/paskyra/account-client.tsx` (deferred until the account/customer
  domain is designed).

## Acceptance criteria

- `shared/` contains domain-agnostic ui/api/config/lib and imports nothing higher.
- `features/auth` encapsulates auth UI/model/api; `entities/user` owns `AuthUser`.
- `app/` keeps routes/layout/route handlers and composes features/shared.
- Import direction enforced by ESLint; long-lived `@/*` alias unchanged.
- `pnpm verify` and `pnpm verify:db` pass; routes and auth behaviour unchanged.

## Verification

- `pnpm verify`, `pnpm verify:db`.
- Route list comparison (`next build` output).
- Manual/light smoke of all routes; auth smoke for password visibility, Google
  capability gating, and Turnstile.
- Boundary probe: deliberate cross-layer imports rejected by ESLint.

## Risks / rollback considerations

- Move-only commits are individually revertible and behavior-identical.
- Test mocks use module paths; they were updated to the new module locations and
  the suite passes.
- No deploy/runtime impact: `next build`/standalone output and `web.Dockerfile`
  are unaffected.

## Discoveries / follow-ups

- `app/paskyra/account-client.tsx` remains in `app/` pending the account/customer
  domain (as approved).
- `widgets/` layer is intentionally empty until real composition blocks exist
  (no decoration directories).
- Cross-slice enforcement relies on relative within-slice imports plus alias bans;
  a slice-aware rule was not added (no FSD-specific tooling).

## Completion record

- Status: DONE (2026-09-22).
- Implementation result:
  - `shared/ui` (button, input, card, alert, label, form-field, password-field,
    turnstile, `page-shell` renamed from `auth-shell`), `shared/api/client.ts`,
    `shared/config/api.ts`, `shared/lib/cn.ts`, `shared/lib/return-to.ts`.
  - `features/auth/{ui,model,api}` with `index.ts` public API; all forms,
    `GoogleAuthButton`, `AuthProvider`/`useAuth`, auth types/messages, and the
    auth API client; `'use client'` boundaries preserved.
  - `entities/user/model/types.ts` (`AuthUser`) + `entities/user/index.ts`.
  - `app/` route files updated to compose `@/features/auth`; `account-client`
    kept in `app/paskyra`.
  - Selective barrels: `shared/ui`, `shared/api`, `shared/lib`, `entities/user`,
    `features/auth`; no global barrel.
  - ESLint `no-restricted-imports` layer boundaries in `eslint.config.mjs`.
  - Documentation in `docs/architecture.md`; `tasks/TODO.md` updated.
- Verification result: `pnpm verify` passed at every step; final `pnpm verify:db`
  passed (121 DB-backed tests). Route list unchanged; boundary probes rejected.
- Decisions: enforce cross-layer direction with existing ESLint only; within a
  slice use relative imports and reserve `@/*` for cross-slice imports; skip
  `pages/`/`processes/`.
- Follow-ups: catalogue/product domains will add `entities/*`, `features/*`, and
  `widgets/*` per `docs/architecture.md`; account/customer domain decides where
  the account client moves.
- Commits: `ced34d4` (extract shared frontend layer), `3697108` (move auth into
  feature layer), `e44a4c6` (extract user entity), `4c87e1d` (enforce frontend
  layer boundaries); the documentation and this record are committed together.
- Completed date: 2026-09-22.
