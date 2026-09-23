# ADM-001 — Roles and admin dashboard foundation

## Status

DONE — implemented, verified, manually smoke-tested, and committed.

## Objective

Implement the first secure administration vertical slice: user roles
(`user` / `editor` / `admin`), server-enforced role-based authorization, a
documented first-admin bootstrap, admin-only user-management endpoints, and a
minimal protected admin dashboard shell whose first section is Users.

## Context

Authentication v1 (M2) is complete and working. The roadmap milestone
**M13 — Admin / Store Management** lists an "Access control" area (define admin
identity model, define admin authorization, protect administration routes) but
no admin capability exists yet; `docs/architecture.md` explicitly records that
"authorization/roles are a separate concern and are not modeled yet". The
product owner needs practical account administration during testing (list users,
change role, delete a test account, re-register the same email). This task is the
human-authorized first slice of that area and introduces the `ADM-*` task prefix.

## Dependencies

- M2 Authentication v1 complete (A-001–A-012).
- Prisma migration tooling and the isolated test database (`pnpm verify:db`).
- Shared-contract decision: none exists and `packages/contracts` must not be
  created without a concrete need; existing DTO/`nestjs-zod` +
  per-app TypeScript type convention is used.

## Scope

1. Data model: `Role` enum (`USER`, `EDITOR`, `ADMIN`) and a `User.role` column
   defaulting to `USER`, with a safe, reversible migration that leaves existing
   users working.
2. Idempotent first-admin bootstrap through `AUTH_INITIAL_ADMIN_EMAIL`: promote
   only an already-existing, email-verified user whose address exactly matches;
   never create a user; never log sensitive values; removable after first use.
3. Admin API module (`apps/api/src/modules/admin/`): `GET /api/admin/users`
   (paginated, safe fields only), `PATCH /api/admin/users/:id/role`,
   `DELETE /api/admin/users/:id`, all `admin`-only, with the required safeguards.
4. Server-enforced role guard + `@Roles` decorator; `role` added to the public
   `auth/me` / login user payload so the client can gate for UX (never as the
   only enforcement).
5. Web admin area (Lithuanian slugs, no locale prefixes): `/administravimas`
   redirects to `/administravimas/naudotojai`; a protected shell with navigation
   and an active item; the Users section with role change, delete confirmation,
   and visible loading / success / empty / error states.
6. Tests: role migration/default behaviour, admin access, `user`/`editor` 403,
   self-delete and self-role-change protection, last-admin protection, delete
   then re-register with the same email, web access gating (guest / non-admin /
   admin), and one user-management UI flow with mocked API responses.
7. Documentation: `.env.example`, configuration, development/bootstrap steps,
   and the frontend route/authorization notes.

## Out of Scope

- Content management, catalogue, orders, analytics, a full CMS, or unrelated
  product features.
- Any additional role capabilities for `editor` beyond its definition.
- Multi-admin ownership transfer, audit log, invitations, admin sessions UI.
- Any new UI library or dependency; any change to existing auth/session/cookie/
  Google/Turnstile/i18n behaviour.
- Committing or pushing.

## Acceptance Criteria

- [ ] Migration adds `role` with `USER` default; existing users remain valid.
- [ ] `GET /api/admin/users` returns only safe fields (id, email, verification
      state, role, created time, last-session indicator) with pagination.
- [ ] `PATCH /api/admin/users/:id/role` changes another user's role.
- [ ] `DELETE /api/admin/users/:id` deletes a user; the email can be registered
      again afterwards (auth records cascade).
- [ ] Unauthenticated → 401; `user` and `editor` → 403; invalid role → 400.
- [ ] Self-delete and self-role-change blocked; last active admin cannot be
      deleted or demoted; unknown user → 404.
- [ ] Bootstrap promotes only an existing verified exact-match email and is
      idempotent.
- [ ] Guests are redirected to login with `returnTo`; non-admins get an
      access-denied state; admins see the dashboard shell and Users section.
- [ ] Targeted tests listed in Scope pass; `pnpm verify` passes and
      `pnpm verify:db` passes (or a documented reason is reported).

## Required Verification

- `pnpm verify` (format, lint, typecheck, test, build).
- `pnpm verify:db` (isolated PostgreSQL: migrate + gate + database-backed tests).
- `git diff --check`; `git status --short`.

## Implementation Result

- **Data model:** `Role` enum (`USER`/`EDITOR`/`ADMIN`) and `User.role`
  (`NOT NULL DEFAULT 'USER'`). Migration
  `packages/db/prisma/migrations/20260923153611_add_user_roles/` generated and
  applied via `prisma migrate dev`; additive and safe for existing users.
- **Authorization:** wire roles `user`/`editor`/`admin` mapped in
  `apps/api/src/modules/auth/roles/user-role.ts`. `RolesGuard` runs after
  `AccessTokenGuard`, loads the role from the database per request, and attaches
  the user for `@CurrentUser()`. `role` was added to the public `auth/me`/login
  payload (additive) for client UX.
- **Admin API:** `apps/api/src/modules/admin/` with `AdminUsersController`,
  `AdminUsersService`, `authorization/` (guard, `@Roles`, `@CurrentUser`),
  `dto/` (`nestjs-zod`), and `bootstrap/`. Wired in `app.module.ts`.
- **First admin:** `InitialAdminBootstrapService` (`OnModuleInit`) promotes an
  existing, email-verified, exact-match account when `AUTH_INITIAL_ADMIN_EMAIL`
  is set; idempotent, never creates a user, never logs the address.
- **Web:** `entities/user` gained `UserRole`/`AuthUser.role`; `features/admin`
  (types, API wrappers, `UsersManager`, `UserActions`, error messages);
  `widgets/admin` (access gate + shell `AdminArea`, `AdminUsersView`);
  routes `app/administravimas/{layout,page}.tsx` and
  `app/administravimas/naudotojai/page.tsx`. `/administravimas` redirects to the
  Users section. Loading/empty/error/success states and inline delete
  confirmation are in the UI.
- **Docs:** `.env.example`, `configuration.md`, `development.md`,
  `authentication.md` (authorization/roles section), `frontend-authentication.md`,
  `architecture.md`, `task-workflow.md` (`ADM-*` prefix), `tasks/TODO.md`.

## Verification Result

Executed from `smshop/` with Node 24 (`nvm use 24`):

- `pnpm verify` — **passed** (Prettier check, ESLint, typecheck, unit/component
  tests, `next build`; routes `/administravimas` and
  `/administravimas/naudotojai` build as static).
- `pnpm verify:db` — **passed**: isolated test DB (`smshop-test`, port 5433) up,
  both migrations applied, `pnpm verify` re-run, then database-backed tests
  **9 files / 143 tests passed**, including `admin-users.db-spec.ts` (22 tests:
  role default/migration, admin list/role-change/delete, user & editor 403,
  self-protection, last-admin, delete-then-re-register, bootstrap).
- `git diff --check` — clean; `git status --short` — see report.
- Manual human smoke test (reported by the requester): an admin can see and
  manage users; non-admins cannot access administration; an admin can change
  another user's role; an admin cannot delete themselves or change their own
  role. The configured initial administrator (`AUTH_INITIAL_ADMIN_EMAIL`) was
  exercised locally; the variable is not committed as a configuration value.

## Decisions

- **Task identity:** recorded as `ADM-001` under the existing `ADM-*` prefix
  (M13 Access control); the corrected task did not supply an ID.
- **Target repository:** `sokoladomeistrai.lt` resolves to the `smshop`
  application repo (the `sokoladas` root is a coordination layer only).
- **Wire casing:** lowercase wire roles vs uppercase Prisma enum, mapped once.
- **Fresh role lookup:** the role is read from the database on each protected
  request rather than embedded in the access JWT, so demotion/deletion applies
  immediately and a stolen token cannot retain admin rights.
- **Status codes:** 401 unauthenticated; 403 insufficient role and self-action
  (`CANNOT_DELETE_SELF`, `CANNOT_CHANGE_OWN_ROLE`); 400 invalid role; 404 unknown
  user; 409 `LAST_ADMIN`.
- **“Active admin”** means an existing user with role `ADMIN` (there is no
  disabled/active flag in the model).
- **Last-admin invariant** is enforced in one serializable transaction. It is not
  reachable through HTTP while self-deletion/demotion is blocked; it is
  deliberately kept as defense-in-depth and verified at the service level.
- **No `packages/contracts`:** the repo has no shared-contract package and
  `AGENTS.md` forbids creating one without a concrete need; `nestjs-zod` DTOs in
  the API plus a small mirrored web type follow the existing convention.
- **FSD-lite boundaries:** admin data/UI live in `features/admin`; the auth
  wiring (which needs `useAuth`) lives in `widgets/admin`, because same-layer
  cross-feature imports are ESLint-forbidden.
- **Routes:** Lithuanian slugs consistent with the storefront
  (`/administravimas`, `/administravimas/naudotojai`); no locale prefixes exist
  in this app.

## Follow-ups

- M13 “Security audit” remains open (rate limiting/audit for admin actions,
  session/device review).
- `editor` has no capabilities yet; define them in a later, separately approved
  task.
- No admin audit log, invitations, or multi-admin ownership transfer.
- Admin user list has no search/filter; add only when real volume requires it.
- The corrected task mentioned a “publication path”; no such concept exists in
  the `smshop` documents (noted as a likely wording carry-over from another
  project, not actionable here).

## Completion

Completed date: 2026-09-23
Commit: `feat(admin): add roles and user management dashboard`
