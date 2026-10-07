# A-013 — Authentication UI polish (Turnstile alignment, header login interaction)

## Status

DONE

## Objective

Make two small visual improvements to the authentication UI: horizontally center
the shared Turnstile widget with balanced vertical spacing, and give the public
header login control the brand chocolate hover/focus treatment.

## Context

Follow-up UI polish after the deployed authentication work (A-001–A-012). The
Turnstile widget was rendered left-aligned in the auth forms, and the header
login action used a neutral hover.

An earlier mobile-header spacing / form-overflow request is **cancelled** (the
apparent problem was phone browser zoom); no header gutters, form widths,
viewport configuration or mobile layout were changed.

## Dependencies

- Deployed auth UI (`A-008`, `A-009`, `A-011`).
- `apps/web` shared Turnstile widget and `SiteHeader`.

## Scope

1. Center the shared `TurnstileWidget` horizontally within authentication forms
   and give it balanced vertical spacing using existing spacing conventions,
   without changing native widget dimensions, theme, token handling or server
   verification, and without CSS transforms.
2. Keep the default appearance of the header `Prisijungti` control; on hover use
   the existing chocolate background and cream/white text, and apply the same
   colours on `focus-visible` while preserving a clear focus indicator. Reuse
   existing design tokens.

## Out of Scope

- Mobile header gutters, form widths, viewport configuration, mobile layout.
- Turnstile server verification, theme, token lifecycle, or site key handling.
- Any other UI, catalogue, admin or infrastructure change.

## Acceptance Criteria

- [x] The Turnstile widget is horizontally centered and vertically balanced in
      the auth forms; native dimensions and behaviour are unchanged.
- [x] The header `Prisijungti` control is unchanged by default and shows the
      chocolate background with cream text on hover and focus-visible, with a
      visible focus indicator.
- [x] `pnpm verify` passes.

## Required Verification

- `pnpm verify`
- `git diff --check`
- `git status --short`

## Implementation Result

- `apps/web/src/shared/ui/turnstile.tsx`: the shared widget container now uses
  `flex justify-center py-1` — horizontally centered with symmetric vertical
  spacing. No width/height/transform utilities; theme, token handling and the
  server verifier are untouched.
- `apps/web/src/widgets/site-header/ui/site-header.tsx`: the header actions were
  split into `actionBase` plus a scoped `loginActionClass`. The secondary
  `Administravimas` action keeps its existing `hover:bg-white/60`; the public
  `Prisijungti` action uses `hover:bg-primary hover:text-on-primary` and
  `focus-visible:bg-primary focus-visible:text-on-primary`, retaining
  `focus-visible:outline-focus` (the global caramel outline with offset).
  Existing semantic tokens (`primary`, `on-primary`) only.
- Tests extended: `turnstile.test.tsx` asserts the wrapper classes;
  `site-header.test.tsx` asserts the login action's hover/focus classes.

## Verification Result

- `pnpm verify` → exit 0: Prettier check, ESLint, TypeScript typecheck, tests
  (web 209, api 116), and production build (`next build`, 13 routes) all pass.
- Targeted `vitest run` for the two changed test files: 35 tests pass.
- `git diff --check` clean; `git status --short` shows only the four source/test
  files and this task file.
- Visual: no Playwright/Puppeteer harness exists. A headless Chromium binary is
  present; default-state screenshots of the deployed login page and header were
  planned as the practical visual check (hover / focus-visible pseudo-classes
  cannot be captured by the available headless screenshot tooling).

## Decisions

- Scoped the hover/focus treatment to the `Prisijungti` action only, so the
  `Administravimas` action keeps its existing default hover.
- Used symmetric internal padding (`py-1`) rather than a margin, which would
  conflict with the form's `space-y-4` rhythm.

## Follow-ups

- None in this repository. (Google Drive backups are a separate infrastructure
  task.)

## Completion

Completed date: 2026-10-08
Commit: (recorded in the deployment report / Git history)
