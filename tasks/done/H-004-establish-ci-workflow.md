# H-004 — Establish CI Verification Workflow

## Status

DONE

## Objective

Add a minimal GitHub Actions workflow that runs the authoritative `pnpm verify`
gate on a clean Node.js 24 environment, so verification no longer exists only
locally.

## Context

H-001 established `pnpm verify`; H-002 pinned Node 24 (`.nvmrc`,
`engines.node`); H-003 established the task lifecycle. The remaining Harness gap
is that verification is local-only.

## Dependencies

H-001 (verification gate), H-002 (runtime baseline), H-003 (task workflow) are
complete.

## Scope

1. Create this task file and mark it current in `tasks/TODO.md`.
2. Add `.github/workflows/ci.yml` running on pushes and pull requests to `main`.
3. Use Node 24 via the repository `.nvmrc` and the pinned pnpm version from
   `package.json`.
4. Install deterministically with `pnpm install --frozen-lockfile`.
5. Run `pnpm verify` (no duplicated lint/test/build steps).
6. Keep permissions minimal; add no services, secrets, or deployment.
7. Document that CI runs `pnpm verify` on Node 24.
8. Complete this task through the lifecycle.

## Out of Scope

Authentication, Prisma schema/migrations, test database, SMTP, OAuth,
deployment workflows, Oracle infrastructure, Docker automation, production
secrets, Harness redesign, application behaviour, commit/push.

## Acceptance Criteria

- [x] GitHub Actions verification workflow exists
- [x] targets the actual repository branch (`main`)
- [x] runs for pushes and pull requests
- [x] CI uses Node.js 24
- [x] CI uses the repository's pinned pnpm version
- [x] dependencies installed with a frozen lockfile
- [x] CI executes `pnpm verify`
- [x] verification logic is not duplicated in the workflow
- [x] no unnecessary external services
- [x] workflow permissions are minimal
- [x] relevant documentation updated
- [x] H-004 follows the established task lifecycle
- [x] `tasks/TODO.md` reflects the resulting state
- [x] local `pnpm verify` still passes

## Required Verification

```bash
pnpm verify
git diff --check
git status --short
```

Plus inspection/validation of the workflow YAML.

## Implementation Result

- Created `.github/workflows/ci.yml` (name `CI`) triggered on pushes and pull
  requests targeting `main` (the actual branch, confirmed from Git).
- Steps: `actions/checkout@v4` → `pnpm/action-setup@v4` (installs the pinned
  pnpm from `package.json` `packageManager`) → `actions/setup-node@v4`
  (`node-version-file: .nvmrc`, `cache: pnpm`) → `pnpm install --frozen-lockfile`
  → `pnpm verify`.
- Workflow permissions limited to `contents: read`; no services, secrets, or
  deployment steps.
- `docs/development.md`: noted that CI runs the same gate on Node 24.
- `docs/testing.md`: replaced the stale "CI (later — not implemented)" section
  with the implemented CI description.

## Verification Result

- `pnpm verify` → exit 0 (format, lint, typecheck, 3 test files / 7 tests,
  production build).
- `git diff --check` → exit 0.
- `git status --short` → only intended doc/task/.github changes; no application
  source changes.
- Workflow YAML parsed successfully with PyYAML; structure confirmed (triggers,
  jobs, steps). `actionlint` was not installed (no new tooling added).
- Tests and build do not require PostgreSQL: `PrismaService` is overridden with a
  mock in `apps/api/test/health.e2e-spec.ts`; `prisma generate` needs no DB. No
  CI service containers added.

## Decisions

- `engine-strict=true` was **deferred**, not added. Reason: the current developer
  host default is Node 26 (documented drift from H-002), so a root `.npmrc`
  `engine-strict=true` would make local `pnpm install` fail on the host and
  unnecessarily break the documented local workflow. CI enforces Node 24
  concretely via `actions/setup-node` with `node-version-file: .nvmrc`, which is
  sufficient runtime enforcement for now. Revisit when the host default is Node 24.
- CI calls `pnpm verify` directly rather than duplicating lint/test/build steps,
  keeping the root script the single source of truth.
- pnpm setup uses the `packageManager` field via `pnpm/action-setup@v4`; the
  version is not duplicated in the workflow.
- `cache: pnpm` on `actions/setup-node` provides straightforward caching; no
  custom cache logic.

## Follow-ups

- H-005 — Establish Auth environment & validation baseline.
- H-006 — Test database strategy (add a PostgreSQL service to CI only when tests
  require it).
- H-002/H-004 follow-up: add `engine-strict=true` (root `.npmrc`) once the
  developer host defaults to Node 24.
- Remote verification: the workflow has not run on GitHub (no commit/push
  authorized); confirm green after it is committed and pushed.

## Completion

Completed date: 2026-09-13
Commit: 7e4801d07fe56dd4d86b0cc8ae815dd8ec7f2734 — "H-004: establish project harness baseline"
