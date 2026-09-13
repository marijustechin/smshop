# H-003 — Establish the Persistent Task Workflow

## Status

DONE

## Objective

Establish the repository-backed task workflow as the persistent source of truth
for agentic development: task directories, a canonical task format, lifecycle
rules, naming conventions, and commit convention. Repair the documentation drift
found in the H-000 audit.

## Context

H-000 found that the task lifecycle was described in `tasks/TODO.md` but not
physically implemented (`tasks/current/` and `tasks/done/` did not exist, only a
`tasks/current.md` audit file). It also found that `AGENTS.md` and `README.md`
referenced a deleted `docs/product-requirements.md`, and that `AGENTS.md` gated
product work on that missing file.

## Dependencies

H-001 (verification gate) and H-002 (runtime baseline) are complete.

## Scope

1. Create `tasks/current/`, `tasks/done/`, and `tasks/template.md`.
2. Add a dedicated workflow document (`docs/task-workflow.md`).
3. Preserve the old `tasks/current.md` by migrating it to a completed audit
   record in `tasks/done/`.
4. Bootstrap completed records for H-001 and H-002.
5. Create and complete this H-003 task through the new lifecycle.
6. Repair the missing product-requirements references and resolve the
   product-work gate contradiction.
7. Make change-discipline rules explicit in `AGENTS.md`.
8. Strengthen testing expectations in `docs/testing.md`.
9. Document a commit convention.
10. Update `tasks/TODO.md` to reflect actual state.

## Out of Scope

Authentication, Prisma schema/migrations, dependency installation, CI, SMTP,
OAuth, Docker architecture, application behaviour, speculative product
decisions, commit/push.

## Acceptance Criteria

- [x] `tasks/current/` exists
- [x] `tasks/done/` exists
- [x] `tasks/template.md` exists
- [x] the lifecycle is documented
- [x] task naming conventions are documented
- [x] H-001 history exists in `tasks/done/`
- [x] H-002 history exists in `tasks/done/`
- [x] H-003 has gone through the new lifecycle
- [x] `tasks/TODO.md` reflects real project state
- [x] broken product-requirements references are fixed
- [x] the product-work gate contradiction is resolved
- [x] change-discipline rules are explicit
- [x] testing expectations are sufficiently explicit
- [x] commit convention is documented
- [x] no product/application functionality was changed
- [x] `pnpm verify` passes

## Required Verification

```bash
pnpm verify
git diff --check
git status --short
```

Plus: no active Harness documentation may depend on `docs/product-requirements.md`
(unless intentionally restored), and all links introduced by this task must
resolve.

## Implementation Result

- Created `tasks/current/`, `tasks/done/`, and `tasks/template.md`.
- Added `docs/task-workflow.md` defining the source-of-truth chain, directory
  structure, task format, naming convention (`H-*`, `A-*`, `CAT-*`, `CART-*`,
  `CHK-*`), lifecycle rules, change discipline, and commit convention.
- Migrated the old `tasks/current.md` audit specification to
  `tasks/done/H-000-repository-readiness-audit.md` (content preserved; status
  header added), rather than deleting it.
- Bootstrapped `tasks/done/H-001-establish-verification-gate.md` and
  `tasks/done/H-002-pin-runtime-baseline.md` from repository state and the
  existing completion reports.
- Created this task at `tasks/current/H-003-establish-task-workflow.md` and
  completed it through the new lifecycle.
- `AGENTS.md`: added a "Tasks and change discipline" section; rewrote
  "Documentation discipline" to match the new workflow; fixed the Verification
  section so product work is gated on the authoritative
  `docs/product-requirements-organized.md` (with `docs/product-requirements-notes.md`
  as supporting notes) instead of the deleted `docs/product-requirements.md`.
- `README.md`: fixed the requirements links, the broken root `TODO.md` link, and
  added the task-workflow and requirements-notes references.
- `docs/testing.md`: added a "Testing requirements" section (when unit,
  integration/e2e, and regression tests are required; no arbitrary coverage
  percentage; `pnpm verify` is the final gate).
- `tasks/TODO.md`: added a "Current State" section, marked H-000–H-003 complete,
  listed H-004–H-006 as planned, and corrected `TODO.md` references.
- `docs/development.md`, `docs/architecture.md`: corrected stale `TODO.md`
  references to `tasks/TODO.md`.

## Verification Result

- `pnpm verify` → exit 0 (format, lint, typecheck, 3 test files / 7 tests,
  production build of db, api, web).
- `git diff --check` → exit 0.
- `git status --short` → only intended documentation/task files; no application
  source changes.
- No active Harness documentation references `docs/product-requirements.md`
  (only the historical task records mention it as the drift that was fixed).
- All links introduced (`docs/task-workflow.md`, `tasks/TODO.md`,
  `tasks/template.md`, requirements documents) resolve.

## Decisions

- Kept `tasks/TODO.md` as the single roadmap/state document (no relocation).
- Placed the detailed lifecycle in a dedicated `docs/task-workflow.md` and kept
  `AGENTS.md` to enforceable constraints plus a short summary, avoiding a large
  manual.
- Preserved the pre-lifecycle audit file as `H-000` in `tasks/done/` instead of
  deleting it.
- The authoritative product-requirements source is
  `docs/product-requirements-organized.md`; `docs/product-requirements-notes.md`
  is supporting notes. The old filename is not restored.

## Follow-ups

- H-004 — Establish CI workflow (run `pnpm verify`, use `.nvmrc`).
- H-005 — Establish Auth environment & validation baseline.
- H-006 — Establish test database strategy.
- H-002 follow-up: enforce the Node 24 baseline via `engine-strict` and/or CI
  `setup-node` with `node-version-file: .nvmrc`.

## Completion

Completed date: 2026-09-13
Commit: 7e4801d07fe56dd4d86b0cc8ae815dd8ec7f2734 — "H-004: establish project harness baseline"
