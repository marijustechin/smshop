# H-001 — Establish the Project Verification Gate

## Status

DONE

## Objective

Provide one authoritative project-wide verification command, `pnpm verify`, that
defines the minimum technical gate for completing implementation tasks.

## Context

The repository audit (H-000) found separate root scripts for formatting, lint,
typecheck, tests, and build, but no single authoritative verification command.

## Dependencies

None.

## Scope

- Add a root `verify` script reusing existing scripts in a fail-fast order:
  `format:check → lint → typecheck → test → build`.
- Confirm each stage works from the repository root and propagates failures.
- Document `pnpm verify` as the authoritative gate.
- Investigate the reported `pnpm-lock.yaml` structural anomaly.

## Out of Scope

Authentication, schema/migrations, CI, task lifecycle directories, `AGENTS.md`
redesign, product requirements, SMTP/OAuth, Docker architecture.

## Acceptance Criteria

- [x] root `pnpm verify` exists and runs the agreed stages
- [x] failures propagate correctly
- [x] succeeds on the current scaffold
- [x] documentation identifies it as the main verification gate
- [x] lockfile anomaly investigated and reported
- [x] no unrelated source changes

## Required Verification

```bash
pnpm verify
git diff --check
git status --short
```

## Implementation Result

- Added root script:
  `"verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build"`.
- Updated `README.md`, `docs/development.md`, and `docs/testing.md` to document
  the gate; updated the `AGENTS.md` verification bullet to require it.
- Fixed a pre-existing Prettier violation in
  `docs/product-requirements-organized.md` (missing blank lines before
  headings/lists) because it blocked `format:check`.

## Verification Result

- `pnpm verify` → exit 0 (3 test files, 7 tests passed; db/api/web builds ok).
- Failure propagation confirmed with a temporary badly-formatted probe file:
  `pnpm verify` → exit 1, stopped at the format stage; probe removed.
- `git diff --check` → exit 0; `git status --short` → only intended files.

## Decisions

- The gate chains existing scripts with `&&` (fail-fast, no new task runner).

## Lockfile Finding

`pnpm-lock.yaml` intentionally contains **two YAML documents** (separators at
lines 1 and 101): document 0 holds the pnpm 12 self-managed package-manager
block (`configDependencies`/`packageManagerDependencies`, `@pnpm/exe.*`);
document 1 holds the real workspace `importers`, `packages`, and `snapshots`. It
is valid for the pinned pnpm `12.3.4`: both
`pnpm install --frozen-lockfile --dry-run` and a real
`pnpm install --frozen-lockfile` exited `0` without rewriting the lockfile. No
regeneration was required.

## Follow-ups

- Run `pnpm verify` in CI once CI exists (later task) to prevent formatting
  regressions.
- `README.md` referenced the deleted `docs/product-requirements.md`; handled by
  H-003.

## Completion

Completed date: 2026-09-13
Commit: 7e4801d07fe56dd4d86b0cc8ae815dd8ec7f2734 — "H-004: establish project harness baseline"
