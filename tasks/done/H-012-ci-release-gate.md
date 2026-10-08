# H-012 — CI release gate (publish images only after checks pass)

## Status

DONE

## Objective

Publish release images to GHCR only after all required checks pass for the exact
source commit, and resolve the H-011 baseline follow-ups.

## Context

The independent `images.yml` workflow published images on every push to `main`
without waiting for `verify`/`workflow` (e.g. run `37820224896` published while
`CI` `37820225252` ran separately). This task merges publication into a single
application workflow gated by `needs`. See `docs/deployment.md` and
`docs/task-workflow.md`.

## Dependencies

- H-011 workflow checks.

## Scope

- Merge image build/publish + release manifest into `.github/workflows/ci.yml`,
  connected to `workflow`/`verify` via `needs`.
- Restrict publication to trusted events; grant `packages:write` only to the
  publication job; build the exact `github.sha`.
- Remove `.github/workflows/images.yml`; update the build-config test.
- Checker baseline policy: explicit non-zero unavailable baseline fails; zero
  baseline checks the tip only; local mode covers the tip plus the working tree.

## Out of Scope

- Deploying images or changing the live server.
- Renaming checks relied upon by branch protection (job names preserved).

## Acceptance Criteria

- [x] Single application workflow with `build` `needs: [workflow, verify]`.
- [x] Preserved image repositories, SHA tags, revision labels, digests, arm64,
      and the Turnstile build argument.
- [x] Publication only on trusted events; PR/untrusted cannot publish or receive
      `packages:write`.
- [x] `images.yml` removed; build-config test updated with gate assertions.
- [x] Baseline policy implemented and covered by focused tests.
- [x] State reconciliation performed.

## Required Verification

- `node --test scripts/ci/check-workflow.test.mjs` (15 tests).
- `pnpm --filter @smshop/web exec vitest run src/test/build-config.test.ts`.
- Actual GitHub CI runs after push.

## Implementation Result

Single `.github/workflows/ci.yml`: `workflow` + `verify` jobs, then `build`
(`needs: [workflow, verify]`, `if` push/workflow_dispatch, `packages: write` only
here, checks out `${{ github.sha }}`) and `release` (`needs: [build]`).
`images.yml` deleted. Checker: `resolveRange` now fails on an explicit non-zero
unavailable baseline, treats a zero baseline as tip-only, and adds a local mode
covering the tip plus the working tree; tests extended to 15.

## Verification Result

- `node --test`: 15 passed. `vitest build-config.test.ts`: 7 passed.
- Local `check:workflow` passes; explicit unavailable baseline exits 1.
- Actual GitHub runs and produced digests are recorded in the completion report.

## Decisions

- Removed the separate workflow rather than adding a second gate, so no path can
  bypass the required checks. Job names (`Build web`/`Build api`/`Release
manifest`, `Verify`, `Workflow checks`) are preserved for branch protection.

## Follow-ups

- Confirm branch protection still lists the intended required checks (job names
  unchanged; the workflow name changed from `Images` to `CI`).

## State Reconciliation

Updated `.github/workflows/ci.yml`, removed `.github/workflows/images.yml`,
updated `apps/web/src/test/build-config.test.ts`, `scripts/ci/check-workflow.mjs`
(+ tests), `docs/deployment.md`, `docs/task-workflow.md`, `tasks/TODO.md` and this
record; `sm-oracle-infra` checker copy + CHANGELOG and root `AGENTS.md`
`checks/`/task record. Application code (non-test), deployment scripts, server
configuration and data are unaffected because this changes CI wiring and checker
logic only; `docs/architecture.md` and `docs/configuration.md` unaffected.

## Completion

Completed date: 2026-10-08
Commit: (recorded in Git history and the completion report)
