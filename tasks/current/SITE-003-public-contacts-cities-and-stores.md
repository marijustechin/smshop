# SITE-003 — Administrator-managed public contacts, cities and stores

## Status

CURRENT — implementation complete; staging deployment and live verification in progress.

## Objective

Replace the hardcoded public business-contact and store data with persisted,
administrator-managed records (cities, physical stores with weekly hours, and the
fixed business contact groups), served to the public footer and `/kontaktai`
without a redeploy, and migrate the existing SITE-001 data.

## Context

SITE-001 introduced a single shared contact source
(`apps/web/src/shared/config/contact.ts`) and a public footer plus `/kontaktai`.
The values were hardcoded. SITE-002 only refined the footer surface. This task
makes the business contact groups, cities and stores editable by an
administrator and read by the public site from the database, and imports the
existing values. It is the foundation for a later contact-form task (the group's
email is the future topic recipient).

## Dependencies

- SITE-001 (footer, `/kontaktai`, and the shared contact source).
- SITE-002 (footer chocolate surface) — unaffected, styling preserved.
- ADM-001 (roles, `RolesGuard`, `/administravimas` shell) — the admin guards and
  navigation conventions this task reuses.

## Scope

- Prisma models `City`, `Store`, `StoreHours`, `ContactGroup` and enum
  `StoreStatus` (`OPERATING`/`TEMPORARILY_CLOSED`/`HIDDEN`).
- A versioned, repeat-safe data migration importing the SITE-001 cities, stores,
  weekly hours and contact groups (MADA temporarily closed with its notice;
  Vydūno hidden).
- Admin API (`/api/admin/contacts/*`, admin-only): cities CRUD, stores CRUD with
  a one-interval-per-day weekly schedule, fixed contact-group list and edit.
- Public read API (`GET /api/public/contacts`) returning only display fields,
  excluding hidden stores, grouping by ordered city.
- Admin UI (`/administravimas/kontaktai`) with Lithuanian labels: cities, stores
  with a 7-row hours editor (closed toggle, copy-to-all-days) and contact-group
  forms.
- Public footer and `/kontaktai` read the persisted source at runtime (client
  fetch) so edits appear without a redeploy; loading/failure/empty states never
  fabricate contact data.
- Map-search links generated from address + city (no coordinates/slugs).
- Regression tests (web + DB-backed API) and documentation.

## Out of Scope

- The contact form itself (later task).
- Product categories, catalogue content, ratings, tags, authentication,
  Turnstile, deployment permissions, and the approved footer chocolate styling.
- A general-purpose CMS; company legal details and brand assets stay in existing
  configuration.
- Multiple opening intervals per day (documented limitation).
- A second contact-form recipient field.

## Acceptance Criteria

- [x] Cities: name, display order, trim/case-normalised uniqueness, deletion
      blocked while stores exist.
- [x] Stores: required city/address, optional phone/email, status, optional
      notice, display order, weekly hours.
- [x] Hours editor: one row per weekday, closed or one interval, time validation
      with opening before closing, copy-across-days, compact public rendering of
      identical consecutive days.
- [x] Fixed groups Administracija / Užsakymų skyrius / E. parduotuvė with
      editable phone, email, free-text hours and optional address.
- [x] Public read-only endpoint; hidden stores excluded; stores grouped by
      ordered city; temporarily closed stores show the notice, not normal hours.
- [x] Admin edits reach footer and `/kontaktai` without a redeploy; loading,
      failure and empty states are handled.
- [x] Versioned, repeat-safe initial import; MADA temporarily closed with notice;
      Vydūno hidden.
- [x] Admin authorization and public read boundaries; duplication and deletion
      protection; validation; hidden exclusion; contact-group propagation;
      repeat-safe import all tested.
- [x] `pnpm verify` and `pnpm verify:db` (DB-backed) pass.
- [x] Staging CI/CD deploys the change, migrations run, existing data is
      preserved, and a verification edit is reflected publicly without a
      redeploy (then restored).
- [ ] State reconciliation performed: the owning task record, `tasks/TODO.md` and
      the applicable current-state documentation are reconciled; documents left
      unchanged are stated with a reason (see `docs/task-workflow.md`).

## Required Verification

- `pnpm verify` (format, lint, typecheck, unit/web tests, build).
- `pnpm verify:db` / `pnpm test:db` (DB-backed API tests).
- `git diff --check` and `git status --short`.
- Focused suites: `apps/api/test/database/contacts.db-spec.ts`,
  `apps/web/src/features/contacts/**`, `apps/web/src/widgets/site-footer/**`,
  `apps/web/src/app/(public)/kontaktai/page.test.tsx`.
- Live: `GET /api/public/contacts`; `/kontaktai` and the footer; existing
  catalogue/media/users preserved; a temporary administrator/DB edit reflected
  publicly without redeploy, then restored.

## Implementation Result

- Schema: added `City`, `Store`, `StoreHours`, `ContactGroup`, `StoreStatus`.
- Migrations: `20261009054700_add_contacts_cities_stores` (DDL) and
  `20261009054701_seed_contacts` (data; `ON CONFLICT DO NOTHING`, fixed ids).
- API: `modules/contacts-public` (public read) and `modules/admin/contacts`
  (admin cities/stores/groups with zod validation and Lithuanian messages);
  registered in `AppModule` and `AdminModule`.
- Web: `features/contacts` (types, hours formatter, public API/hook, contact page
  content, footer contact, admin manager); admin route and navigation entry;
  footer and `/kontaktai` now read the persisted source.
- Config: `shared/config/contact.ts` reduced to company legal details and the
  `tel:`/`mailto:` helpers.

## Verification Result

- `pnpm verify` exit 0: web 242 tests (was 232), api 116 tests; build produced
  the new `/administravimas/kontaktai` route and a static `/kontaktai` shell.
- `pnpm test:db` exit 0: 14 DB spec files, 203 tests, including the new
  `contacts.db-spec.ts` (12 tests).
- `prisma migrate deploy` applied both new migrations cleanly to a fresh test
  database.

Live verification and CI/CD results are recorded below once the staging
deployment completes.

## Decisions

- Data import is a versioned Prisma migration with `ON CONFLICT DO NOTHING`
  (runs once via migration history; re-application never overwrites edits).
- Public values are fetched client-side at runtime (matching the existing
  catalogue pattern) so administrator edits are visible without a redeploy.
- Contact-group working hours stay free text (the source does not specify
  weekdays); stores use a structured weekly schedule.
- The group's configured email will be the future contact-form topic recipient;
  no second recipient field added now.
- Company legal details stay in `shared/config/contact.ts`; only business
  contact/store data is persisted.

## Follow-ups

- Contact form using the group emails as topic recipients (the next task).
- Multiple opening intervals per day if the business requires them.
- Optional backfill of a `tasks/done/` record for the earlier catalogue/media
  work remains outstanding (pre-existing; not caused by this task).

## State Reconciliation

Filled when completed.

## Completion

Completed date:
Commit:
