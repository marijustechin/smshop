# SITE-002 — Footer chocolate surface

## Status

CURRENT — implementation complete; live verification pending.

## Objective

Refine the existing public footer to a chocolate surface with cream text, without
changing its content, links, layout or placement.

## Context

SITE-001 added the shared footer on a cream surface. This task switches it to the
dark brand surface using existing tokens (`primary` chocolate, `on-primary`
cream), reusing the existing cream logo variant.

## Dependencies

- SITE-001 (shared footer and contact source).

## Scope

- Footer background `bg-primary`, main text `text-on-primary`, borders
  `primary-strong`.
- Cream logo variant `sokolado-meistrai-logo-creme.webp` (existing asset).
- Links: cream text, underline on hover, focus-visible outline in the cream
  token (visible on dark).
- Secondary text at a readable opacity (`text-on-primary/80`).

## Out of Scope

- Global token values; header; contact page; administration layout.
- New branding assets or CSS logo treatments; background photograph/overlay.
- Content, links, responsive layout, spacing and footer placement.

## Acceptance Criteria

- [x] Chocolate background and cream main text via existing tokens.
- [x] Secondary text readable (not excessively faded).
- [x] Cream logo variant used (existing asset).
- [x] Links underline on hover; visible focus indicator on the dark background.
- [x] Borders/separators adapted to the dark surface.
- [x] Content, links, layout, spacing and placement unchanged.
- [x] `pnpm verify` passes.
- [ ] Live verification (mobile, desktop, auth page, catalogue page).

## Required Verification

- `pnpm verify` and the focused footer test.
- Live screenshots: mobile and desktop; a short auth page and a long catalogue
  page; contrast/overflow/hover-focus inspection.

## Implementation Result

Replaced the footer surface with `bg-primary`/`text-on-primary`, borders with
`border-primary-strong`, the logo with the existing cream variant, hover underline
and `focus-visible:outline-on-primary`, and secondary text with
`text-on-primary/80`.

## Verification Result

- `pnpm verify` recorded in the completion report.
- Live verification pending the CD deploy.

## Decisions

- Reused the existing `sokolado-meistrai-logo-creme.webp` asset (no generated/
  overwritten assets, no CSS treatment).
- Left global tokens unchanged; used only semantic tokens.

## Follow-ups

- None.

## State Reconciliation

Filled on completion. Updated the footer component and its test, `tasks/TODO.md`
and this record; global tokens, header, contact page, administration layout and
the deployment contract are unaffected.

## Completion

Completed date: pending live verification
Commit: (Git history)
