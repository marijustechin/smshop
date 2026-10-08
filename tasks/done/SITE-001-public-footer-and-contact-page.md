# SITE-001 — Public footer and contact page

## Status

DONE — implemented, verified and deployed live on 2026-10-08.

## Objective

Add a shared public footer and a first usable `/kontaktai` page for Šokolado
meistrai, with contact information in one shared application source.

## Context

The public site had a header but no footer and no contact page. Contact values
were transferred from `https://www.sokoladomeistrai.lt/kontaktai/` and the
individual store pages. New prefix `SITE-*` (public site content) recorded in
`docs/task-workflow.md`.

## Dependencies

- Existing design tokens, `Container`/`Section`, `SiteHeader`, public layout.

## Scope

- `shared/config/contact.ts` — single shared contact source (footer + page).
- `widgets/site-footer/` — shared footer.
- `app/(public)/kontaktai/page.tsx` — contact page with metadata.
- Public layout renders the footer (sticky to the viewport bottom); drawer gains
  `Kontaktai`.

## Out of Scope

- Auth, Turnstile, catalogue, ratings/tags, product layout, admin UI, deployment.
- Contact form/upload/backend; embedded maps; bank details; legal pages.

## Acceptance Criteria

- [x] Footer on every public page (incl. auth); administration layout unchanged.
- [x] Footer: logo, description, phone/email (`tel:`/`mailto:`), Tortai,
      Kontaktai, Parduotuvės (`/kontaktai#pardotuves`), legal name/code/year.
- [x] `/kontaktai`: intro, administration/orders/online-shop groups, stores with
      published hours, map links, quieter company section.
- [x] Closed stores labelled; temporarily closed store retained and labelled.
- [x] Kontaktai in the public drawer with existing active-state behaviour.
- [x] Page title/description/canonical metadata; noindex preserved (staging
      `X-Robots-Tag` and Next.js defaults are untouched).
- [x] Focused tests pass; `pnpm verify` passes.
- [x] Live deployment verified (staging CD).

## Required Verification

- `pnpm verify` (format, lint, typecheck, tests, build) — passed.
- Focused suites (footer, contact page, layout placement, header drawer) — passed.
- Live `/kontaktai`, footer, navigation after CD deploy — verified.

## Implementation Result

Added the shared contact source, the footer widget, the contact page, the footer
in the public layout (`min-h-dvh` flex wrapper with `main` `flex-1`, so the footer
sits at the viewport bottom) and the `Kontaktai` drawer entry; updated the header
tests for the new drawer item. `docs/task-workflow.md` gained the `SITE-*` prefix.

## Verification Result

- `pnpm verify` exit 0: web 232 tests, api 116 tests, `/kontaktai` built as a
  static route.
- Focused: 34 passed across the footer, contact page, public layout, header and
  placement suites.
- CD: run `37856115184` (source `4929fd9`) — all jobs success; `Deploy staging`
  executed the key-install, manifest, stage/release/status and health steps.
- Applied release `ci-4929fd9babe7` (previous `ci-89e9145c6575`); web
  `…@sha256:e159924b…`, api `…@sha256:d775abdd…`; evidence
  `20261008T230247Z-ci-4929fd9babe7` `finalStatus: success`.
- Live: `/health/ready`, `/kontaktai`, `/` all `200`; footer and contact groups
  present in the served HTML; desktop and mobile screenshots confirm readable
  wrapping (emails/addresses) with no overflow.

## Decisions

- New `SITE-*` prefix.
- Footer uses the cream surface with chocolate text and hover (consistent with
  the header).
- Sticky-footer pattern (`min-h-dvh` + `main flex-1`) so the footer is visible at
  the viewport bottom.
- Store hours quoted as published per store; department hours (`8:00–18:00`)
  shown without inventing weekdays.

## Follow-ups / source ambiguities

- Department hours are published without weekdays; shown verbatim.
- Store hours are only on individual store pages (not the contact page); values
  were transferred from those pages.
- `Vydūno g. 4` is marked "uždaryta nuo 2026-05-20" without stating permanent
  closure; retained and labelled "Uždaryta" (not presented as operating).
- The source's legal pages (D.U.K., privatumo, e-parduotuvės taisyklės) do not
  exist in this application; not linked (no unfinished links).
- Bank details and additional departmental phones were intentionally excluded.
- `Parduotuvės` reuses the contact-page stores section (no dedicated stores page
  exists).

## State Reconciliation

Updated `shared/config/contact.ts`, the footer/contact implementation and tests,
`docs/task-workflow.md` (new prefix), `tasks/TODO.md` and this record. The
staging deployment record (applied state, evidence, release ids) is authoritative
in `sm-oracle-infra`; `README.md`, `docs/architecture.md`,
`docs/configuration.md` and `docs/deployment.md` are unaffected (no build,
runtime-interface or architecture change). No secrets or server changes.

## Completion

Completed date: 2026-10-08
Commit: `89e9145` (footer + contact page) and `4929fd9` (footer pinned to the
viewport bottom); deployed as `ci-4929fd9babe7`.
