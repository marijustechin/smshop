# SITE-003 — Administrator-managed public contacts, cities and stores

## Status

DONE — implemented, tested and deployed to staging on 2026-10-09. The
authenticated admin-form visual inspection remains with the owner (see
Verification Result → Not performed).

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
- [x] Staging CI/CD deployed the change and both migrations ran; existing
      catalogue/media/users were preserved.
- [x] The public read endpoint serves live database state without a redeploy: a
      temporary, directly-applied edit was observed through
      `GET /api/public/contacts` and then restored. This was an **API-level**
      observation; the rendered footer/`/kontaktai` DOM was not observed between
      the edit and the restore, so no rendered-refresh claim is made.
- [ ] Authenticated admin-form visual inspection (desktop and mobile) — **not
      performed by the agent**: no staging administrator credentials were
      available and no authentication bypass was created. The owner will inspect
      `/administravimas/kontaktai` with their existing administrator account.
      Automated web tests and DB tests exercise behaviour but are **not** visual
      verification.
- [x] State reconciliation performed: the owning task record, `tasks/TODO.md` and
      the applicable current-state documentation are reconciled; documents left
      unchanged are stated with a reason (see `docs/task-workflow.md`).

## Required Verification

- `pnpm verify` (format, lint, typecheck, unit/web tests, build).
- `pnpm verify:db` / `pnpm test:db` (DB-backed API tests).
- `git diff --check` and `git status --short`.
- Focused suites: `apps/api/test/database/contacts.db-spec.ts`,
  `apps/web/src/features/contacts/**`, `apps/web/src/widgets/site-footer/**`,
  `apps/web/src/app/(public)/kontaktai/page.test.tsx`.
- Live: `GET /api/public/contacts`; rendered `/kontaktai` and footer screenshots;
  existing catalogue/media/users preserved; a temporary edit observed through the
  public endpoint without a redeploy (then restored). Authenticated admin-form
  visual inspection is an owner action (see "Not performed").

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

**Repository implementation (local gates)**

- `pnpm verify` exit 0: web 242 tests (was 232), api 116 tests; the build
  produced the `/administravimas/kontaktai` route and a static `/kontaktai`
  shell.
- `pnpm test:db` exit 0: 14 DB spec files, 203 tests, including the new
  `contacts.db-spec.ts` (12 tests: public boundary, admin authorization, city
  duplication/deletion protection, store validation/status/hours, contact-group
  propagation, repeat-safe import).
- `pnpm check:workflow` and `pnpm test:workflow` (15 fixture tests) pass.
- `prisma migrate deploy` applied both new migrations cleanly to a fresh test
  database.

**Deployment (staging) — implementation vs installed state**

- CI run `37891255674` (commit `e94150c`) completed **success**.
- Installed state `/opt/sokoladas-staging/state/applied.json`: applied release
  `ci-e94150c92e67`, previous `ci-31caaa357c2a`, `appliedAt`
  2026-10-09T06:11:51Z, source commit `e94150c`.
- Deployment evidence `20261009T061012Z-ci-e94150c92e67`: `migration.log` shows
  `prisma migrate deploy` applying `20261009054700_add_contacts_cities_stores`
  and `20261009054701_seed_contacts` ("All migrations have been successfully
  applied"); the health step reports OK.
- Live `GET /health/ready` 200; `/`, `/tortai`, `/kontaktai`,
  `/administravimas/kontaktai` and `/prisijungti` all 200.

**Data preservation (staging)**

- `GET /api/public/contacts` returns the 3 seeded groups and both ordered cities
  (Vilnius, Kaunas); 7 visible stores (8 seeded − 1 hidden `Vydūno`), with the
  `MADA` store as `TEMPORARILY_CLOSED` and its notice
  "Laikinai uždaryta – vyksta rekonstrukcija".
- Existing data intact: users 4, catalogue products 5, categories 1, tags 9,
  shop products 0; the media volume holds 5 files.

**Public rendered visual check**

- Headless Chromium screenshots of `/kontaktai` (desktop 1440 and mobile 390) and
  the home footer confirm the contact groups, city-grouped stores, compact weekly
  hours (`I–V 9:00–19:00; VI–VII 10:00–18:00`), the `Laikinai uždaryta` closure
  badge + notice, the company section, and the chocolate footer showing the
  persisted administration phone/email. No horizontal overflow at mobile width.

**No-redeploy observation (API-level, not rendered UI)**

- A temporary edit was applied **directly to `contact_groups`** on staging (not
  through the admin API/UI) and observed immediately through
  `GET /api/public/contacts`, then restored to the original value. This proves
  the public **endpoint** serves live database state without a redeploy. The
  rendered footer/`/kontaktai` page was **not** observed between the edit and the
  restore, so no claim is made that the rendered page refreshed live; the
  rendered pages were separately screenshotted after deployment and show the
  persisted values.

**Not performed**

- Authenticated admin-form visual inspection (desktop and mobile). The agent had
  no staging administrator credentials and did not create a preview route,
  account or authentication bypass. The owner will inspect
  `/administravimas/kontaktai` with their existing administrator account.
  Automated web tests and the DB-backed spec exercise admin behaviour but are
  **not** visual UI verification.

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
- Verification method: the no-redeploy property was observed at the public **API**
  boundary only, by a temporary directly-applied edit. The authenticated admin
  UI/API write path is covered by the DB-backed spec; the admin UI was not
  visually inspected by the agent (no staging credentials, no bypass).

## Follow-ups

- Contact form using the group emails as topic recipients (the next task).
- Multiple opening intervals per day if the business requires them.
- Optional backfill of a `tasks/done/` record for the earlier catalogue/media
  work remains outstanding (pre-existing; not caused by this task).

## State Reconciliation

Updated: this task record (moved to `tasks/done/`), `tasks/TODO.md` (current task
cleared; SITE-003 recorded; M13 "Store & contact information" added; current
released commit updated), `docs/architecture.md` (public contacts domain and the
new API modules), `docs/configuration.md` (business contacts are database-managed,
not environment configuration), and `docs/deployment.md` (forward-only migration
plus the repeat-safe `seed_contacts` import).

The infrastructure-owned deployment contract is unaffected: SITE-003 adds no new
environment variable, secret, port, mount or interface field — only tables,
endpoints and UI inside the existing contract (migrations already run via
`prisma migrate deploy`). `README.md`, `docs/authentication.md` and
`docs/development.md` are unaffected because nothing changed in onboarding,
authentication or the local development stack. Staging installed state remains
authoritative in `sm-oracle-infra`.

## Completion

Completed date: 2026-10-09
Commit: `e94150c` (implementation); documentation recorded in the follow-up
`SITE-003` docs commit. Deployed as `ci-e94150c92e67`.
