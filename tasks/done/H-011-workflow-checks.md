# H-011 — Mechanical workflow checks (commit, task-record, links)

## Status

DONE

## Objective

Enforce three mechanical workflow checks — commit-message task IDs, required
sections in completed task records, and local documentation links — with no new
dependencies, in CI and as documented local commands.

## Context

The completion rules (task workflow, templates, state reconciliation) are
documented but not mechanically enforced, so drift is only caught by review. This
task adds small Node-builtin checkers and wires them into CI. It enforces
structure, not the factual accuracy of state reconciliation.
See `docs/task-workflow.md` and the root `AGENTS.md`.

## Dependencies

- The state-reconciliation completion rule (previous harness task).
- Node.js 24 (already the pinned runtime); no new dependencies.

## Scope

- `scripts/ci/check-workflow.mjs`: `commits`, `tasks`, `links`, `all`
  subcommands (identical copy in `sm-oracle-infra`).
- `scripts/ci/check-workflow.test.mjs`: fixture tests (`node --test`).
- `package.json` scripts `check:workflow`, `test:workflow`.
- `.github/workflows/ci.yml`: a `workflow` job over the push/PR range.
- Documentation: `docs/task-workflow.md` (commit convention + checks), `README.md`
  scripts table.

## Out of Scope

- Any change to application code, deployment, or server configuration.
- Factual state-reconciliation validation (only structure is checked).
- Bulk-rewriting historical task records.

## Acceptance Criteria

- [x] Commit subjects require a task ID in two explicit formats, with exact
      merge/revert/bot exceptions and explicit baseline handling.
- [x] New/changed `tasks/done/*.md` are checked for the required sections,
      including acceptance/verification and state reconciliation.
- [x] Local Markdown links and anchors are checked: changed docs enforced,
      pre-existing findings reported separately, cross-repository links explicit.
- [x] CI and documented local commands run the checks; fixture tests pass.
- [x] State reconciliation performed (see below).

## Required Verification

- `node --test scripts/ci/check-workflow.test.mjs` (13 tests).
- `pnpm check:workflow` and `git diff --check`.
- `node scripts/ci/check-workflow.mjs links --all` (report pre-existing findings).

## Implementation Result

Added `scripts/ci/check-workflow.mjs` (dependency-free) and its fixture tests, the
`check:workflow`/`test:workflow` scripts, and a `workflow` CI job running over
`--base <before|pr-base> --head <sha>` with a full-history checkout. Policy,
accepted formats, exceptions and parser scope are documented in
`docs/task-workflow.md`; the root `checks/run-workflow-checks.sh` runs both
repositories and the cross-repository link validation.

## Verification Result

- `node --test scripts/ci/check-workflow.test.mjs`: 13 passed, 0 failed.
- `node scripts/ci/check-workflow.mjs links --all`: no broken local links.
- The commit/`docs` history that predates the rule fails by design; enforcement is
  limited to the checked range, so historical commits are never revalidated.

## Decisions

- Enforcement is range-scoped, never whole-history; a missing baseline validates
  the tip and says so rather than passing silently.
- Shell out to `git`; no dependencies. The checker copy is duplicated in both
  repositories and kept byte-identical (verified by the root command).

## Follow-ups

- Pre-existing task records lack the `State Reconciliation` section; they are
  reported (not rewritten) and backfill remains a separate follow-up.

## State Reconciliation

Filled on completion. Updated `docs/task-workflow.md`, `README.md`,
`package.json`, `.github/workflows/ci.yml`, `scripts/ci/`, `tasks/TODO.md` and
this record. `docs/architecture.md`, `docs/configuration.md`,
`docs/deployment.md` and the infrastructure deployment contract are unaffected —
this task changes tooling and workflow instructions only, not architecture,
configuration or the deployment interface.

## Completion

Completed date: 2026-10-08
Commit: (recorded in Git history and the deployment/CI report)
