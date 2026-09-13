# H-007 — Integrate the Infrastructure Workstream into the Project Roadmap

## Status

DONE

## Objective

Integrate the existing Oracle production-infrastructure workstream into the
`smShop` roadmap as a visible but separate workstream, without mixing
infrastructure implementation into the application repository.

## Context

Application development (`smShop`) and production infrastructure
(`sm-oracle-infra`) are intentionally separated. The Oracle workstream already
exists and has real progress (host access, HTTP bootstrap preparation, runbooks).
It must be represented as active work rather than a generic future milestone.

## Dependencies

H-000–H-006 are complete. No application or infrastructure behaviour changes are
required.

## Scope

1. Create this task and mark it current.
2. Add the `OPS-*` task prefix to `docs/task-workflow.md`.
3. Add a dedicated Infrastructure / Oracle workstream to `tasks/TODO.md` with
   OPS-000–OPS-007 and evidence-based statuses.
4. Document repository ownership boundaries and the cross-repository deployment
   contract.
5. Link application milestones to infrastructure dependencies without blocking
   current Auth development.
6. Correct the factual commit state of H-000–H-006.
7. Identify A-001 as the next application task.
8. Complete this task through the lifecycle.

## Out of Scope

Accessing Oracle, modifying `sm-oracle-infra`, firewall/Nginx/ACME/DNS changes,
deployments, Auth implementation, Prisma schema/migrations, dependency
installation, application behaviour, commit, push.

## Acceptance Criteria

- [x] `OPS-*` prefix is documented
- [x] infrastructure is visible as a dedicated roadmap workstream
- [x] existing Oracle progress is represented accurately
- [x] completed vs partial vs planned infrastructure work is distinguished
- [x] `smShop` vs `sm-oracle-infra` ownership is explicit
- [x] deployment-contract responsibilities are documented
- [x] application work is not unnecessarily blocked by production infrastructure
- [x] H-000–H-004 vs H-005/H-006 commit state is represented accurately
- [x] A-001 is identified as the next application task
- [x] no infrastructure or application behaviour changed
- [x] `pnpm verify` passes

## Required Verification

```bash
pnpm verify
git diff --check
git status --short
```

Plus link resolution and confirmation that no infrastructure implementation
files were introduced.

## Implementation Result

- `docs/task-workflow.md`: added the `OPS-*` prefix (production
  infrastructure/operations), noting it is owned/implemented in
  `sm-oracle-infra` and that OPS history is not recorded in `tasks/done/` here.
- `tasks/TODO.md`:
  - Reworked **Current State** to show M1 complete, A-001 as the next
    application task, the parallel OPS workstream, the accurate commit state,
    and the application-vs-infrastructure independence.
  - Added a dedicated **Infrastructure / Oracle Workstream** section with
    OPS-000–OPS-007 and evidence-based statuses (`DONE`/`PARTIAL`/`PLANNED`),
    plus the infrastructure ↔ application dependency notes and the external
    repository reference.
  - Added H-007 to the Harness task list and annotated M2's first item as A-001.
  - Added a pointer in M19 to the OPS workstream (no duplicated history).
- `docs/architecture.md`: expanded the ownership boundary with the full
  `smShop` vs `sm-oracle-infra` responsibility sets, and stated that
  infrastructure implementation is not duplicated here.
- `docs/deployment.md`: added a **Cross-repository deployment contract** section
  declaring the application side (runtime, entrypoints, routing, health, env,
  secrets, DB/migrations, shutdown, persistence) and marking remaining open
  fields (C.1, C.3–C.7).
- `tasks/done/H-006-...md`: corrected the commit-state follow-up (H-000–H-004
  committed at `7e4801d`; H-005/H-006 uncommitted).

No infrastructure or application behaviour changed; no OPS history files were
created.

## Verification Result

- `pnpm verify` → exit 0 (format, lint, typecheck, API 4 files / 21 tests, web 1
  test, builds).
- `git diff --check` → exit 0.
- `git status --short` → documentation/task files only; no infrastructure
  implementation files introduced; no `tasks/done/OPS-*` files.
- README and in-doc references resolve; the only unresolved paths are
  intentionally external (`sm-oracle-infra/...`) or pre-existing future
  (`prisma.config.ts`).

## Decisions

- Track infrastructure status as `OPS-*` in `tasks/TODO.md` only; keep detailed
  runbooks/history in `sm-oracle-infra` and create no OPS files in
  `smShop/tasks/done/`.
- Represent infrastructure as a dedicated top-level workstream, separate from
  application milestones, with statuses backed only by known evidence
  (OPS-000 `DONE`; OPS-001 and OPS-003 `PARTIAL`; OPS-002, OPS-004–OPS-007
  `PLANNED`).
- The authoritative deployment contract stays in `sm-oracle-infra`; `smShop`
  holds only the application-side declaration.
- Auth development is explicitly not blocked by production infrastructure.

## Follow-ups

- `OPS-001` must not be marked `DONE` until live HTTP bootstrap execution is
  confirmed in `sm-oracle-infra`.
- `OPS-003`: complete infrastructure-side alignment with the application
  deployment contract (resolve C.1, C.3–C.7).
- The next application task is **A-001 — Authentication domain model** (not
  started).
- H-005, H-006, and H-007 changes are committed at `1677ca9` ("H-007: complete
  auth readiness harness").

## Completion

Completed date: 2026-09-13
Commit: 1677ca958c761964cfa7ed58febfe369ac5e8b36 — "H-007: complete auth readiness harness"
