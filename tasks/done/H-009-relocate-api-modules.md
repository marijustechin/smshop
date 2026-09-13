# H-009 — Relocate API Modules Under `src/modules`

## Status

DONE

## Objective

Bring the NestJS API source tree into alignment with the documented
module-layout convention
(`apps/api/src/modules/<module-name>/`). Structural refactor only; no behaviour
change.

## Context

The API code predates the layout convention added to `AGENTS.md` /
`docs/architecture.md`: `src/auth`, `src/prisma.module.ts`,
`src/prisma.service.ts`, and `src/health.controller.ts` sit directly under
`src/`. `tasks/TODO.md` tracks this as a structural follow-up.

## Dependencies

H-000–H-008; A-001; A-002.

## Scope

1. Create this task and mark it current.
2. Move `src/auth/**` → `src/modules/auth/**`.
3. Move `prisma.module.ts`/`prisma.service.ts` → `src/modules/prisma/`.
4. Move health files → `src/modules/health/`.
5. Review/remove scaffold `app.controller.ts` if it has no real purpose.
6. Update imports; keep `src/config`, `app.module.ts`, `main.ts` in place.
7. Check Docker/build paths; resolve the TODO structural follow-up.

## Out of Scope

Email infrastructure, Auth/registration/password logic, Prisma schema/migrations,
API routes, dependencies, Oracle, commit, push.

## Acceptance Criteria

- [x] Auth lives under `src/modules/auth/`
- [x] Prisma lives under `src/modules/prisma/`
- [x] Health lives under `src/modules/health/`
- [x] `src/config/` remains top-level
- [x] `app.module.ts`/`main.ts` remain at `src/` root
- [x] unused scaffold `app.controller.ts` removed if no real purpose
- [x] imports compile under ESM/NodeNext
- [x] no API behaviour changed
- [x] no dependencies added
- [x] TODO structural follow-up resolved
- [x] `pnpm verify` passes
- [x] `pnpm verify:db` passes

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

- Moved `apps/api/src/auth/**` → `apps/api/src/modules/auth/**` (structure
  preserved: controller, service, module, `dto/`, `password/`, tests).
- Moved `prisma.module.ts` / `prisma.service.ts` →
  `apps/api/src/modules/prisma/`.
- Moved `health.controller.ts` / `health.controller.spec.ts` →
  `apps/api/src/modules/health/` (no `health.module.ts` created).
- Kept `src/config/**`, `app.module.ts`, and `main.ts` at their level.
- Removed scaffold `app.controller.ts` (only served `GET /api` returning
  `{service:'api',status:'ok'}`; no product requirement) and its registration in
  `AppModule`; updated `test/health.e2e-spec.ts` accordingly.
- Updated imports: `app.module.ts` (new module paths, removed `AppController`),
  `health.controller.ts`/`health.controller.spec.ts` →
  `../prisma/prisma.service.js`, `auth.service.ts` →
  `../prisma/prisma.service.js`, `test/health.e2e-spec.ts` and
  `test/database/auth-registration.db-spec.ts` → new `src/modules/...` paths.
- Updated `docs/testing.md` and `docs/authentication.md` test-path references;
  marked the `tasks/TODO.md` structural follow-up resolved.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm verify` → exit 0 (API 5 files / 26 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0 (migration applied, 32 DB tests).
- `git diff --check` → exit 0; `git status --short` → renames + intended edits.
- Production-build smoke (Node 24): `/health/ready` 200, `POST /api/auth/register`
  201, `/api/health/ready` 404. `/api` is now 404 (scaffold root route removed),
  which is the intended behaviour change-free removal of non-required scaffold.
- Build output `apps/api/dist/main.js` + `dist/modules/{auth,health,prisma}`;
  `docker/api.Dockerfile` copies `apps/api/dist` wholesale, so no Docker change
  was required.

## Decisions

- Removed `app.controller.ts`: it was leftover scaffold with no product
  requirement, and `/api` ownership is already exercised by the auth route.
- Did not create `health.module.ts`; `HealthController` stays registered in
  `AppModule`, matching the smallest structural change.
- No API route prefixes, contracts, database behaviour, or Auth logic changed.

## Follow-ups

- A-003 — Email infrastructure is next.
- No Docker change needed; images remain unverified by an actual build
  (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
