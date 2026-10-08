# SITE-001 — Public footer and contact page

## Status

CURRENT — implementation complete; live deployment verification pending.

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
- Public layout renders the footer; drawer gains `Kontaktai`.

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
- [x] Page title/description/canonical metadata; noindex preserved.
- [x] Focused tests pass; `pnpm verify` passes.
- [ ] Live deployment verified (staging CD).

## Required Verification

- `pnpm verify`.
- Focused: footer, contact page, layout placement, header drawer.
- Live: `/kontaktai`, footer, drawer, tel/mailto after CD deploy.

## Implementation Result

Added the shared contact source, footer widget, contact page, footer in the public
layout and the `Kontaktai` drawer entry; updated the header tests for the new
drawer item.

## Verification Result

- `vitest` focused suites: 34 passed (footer, contact page, layout, header,
  placement).
- Full `pnpm verify` recorded in the completion report.
- Live verification pending the CD deploy.

## Decisions

- New `SITE-*` prefix.
- Footer uses the cream surface with chocolate text (consistent with the header).
- Store hours quoted as published per store; department hours shown without
  inventing weekdays.

## Follow-ups / source ambiguities

- Department hours (`8:00–18:00`) are published without weekdays; shown verbatim.
- Store hours are only on individual store pages (not the contact page); values
  were transferred from those pages.
- `Vydūno g. 4` is marked "uždaryta nuo 2026-05-20" without stating permanent
  closure; retained and labelled "Uždaryta" (not presented as operating).
- The source's legal pages (D.U.K., privatumo, e-parduotuvės taisyklės) do not
  exist in this application; not linked (no unfinished links).
- Bank details and additional departmental phones were intentionally excluded.

## State Reconciliation

Filled on completion. Updated `shared/config/contact.ts`, footer/contact
implementation, `docs/task-workflow.md` (new prefix), `tasks/TODO.md`, this
record. Application runtime unrelated areas, server configuration and the
deployment contract are unaffected.

## Completion

Completed date: pending live verification
Commit: (Git history)
