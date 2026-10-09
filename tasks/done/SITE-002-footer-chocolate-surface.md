# SITE-002 — Footer chocolate surface

## Status

DONE — implemented, verified and deployed live on 2026-10-09.

## Objective

Refine the existing public footer to a chocolate surface with cream text, without
changing its content, links, layout or placement.

## Context

SITE-001 added the shared footer on a cream surface. This task switches it to the
dark brand surface using existing tokens (`primary` chocolate, `on-primary`
cream) and the existing cream logo variant.

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
- [x] Live verification (mobile, desktop, auth page, catalogue page).

## Required Verification

- `pnpm verify` and the focused footer test.
- Live screenshots: mobile and desktop; a short auth page and a long catalogue
  page; contrast/overflow/hover-focus inspection.

## Implementation Result

Replaced the footer surface with `bg-primary`/`text-on-primary`, the top border
and column separators with `border-primary-strong`, the logo with the existing
cream variant, hover underline plus `focus-visible:outline-on-primary`, and
secondary text with `text-on-primary/80`. Content, links, grid, spacing and
placement were unchanged.

## Verification Result

- `pnpm verify` exit 0 (web 232 tests, api 116 tests); focused footer suite 3/3.
- CD run `37887977340` (source `31caaa3`): all jobs success; `Deploy staging`
  executed the key-install, manifest, stage/release/status and health steps.
- Applied release `ci-31caaa357c2a` (previous `ci-4929fd9babe7`); web
  `…@sha256:793881fb…`, api `…@sha256:9846f11f…`; evidence
  `20261009T052921Z-ci-31caaa357c2a` `finalStatus: success`.
- Live: `/health/ready`, `/`, `/tortai`, `/kontaktai`, `/prisijungti` all `200`.
- Screenshots (desktop home, long catalogue page, short auth page, and mobile)
  confirm the chocolate surface, cream logo, readable cream/`80%` text and no
  horizontal overflow; hover underline and focus outline are verified via the
  component classes (pseudo-classes are not screenshot-capturable).

## Decisions

- Reused the existing `sokolado-meistrai-logo-creme.webp` asset (no generated or
  overwritten assets, no CSS treatment).
- Left global tokens unchanged; used only semantic tokens.

## Follow-ups

- None.

## State Reconciliation

Updated the footer component and its test, `tasks/TODO.md` and this record.
Global design tokens, the header, the contact page, the administration layout and
the deployment contract are unaffected (a footer colour refinement changes no
architecture, configuration or interface). The staging deployment record is
authoritative in `sm-oracle-infra`.

## Completion

Completed date: 2026-10-09
Commit: `31caaa3`; deployed as `ci-31caaa357c2a`.
