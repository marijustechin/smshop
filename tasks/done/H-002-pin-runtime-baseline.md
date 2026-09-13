# H-002 — Pin the Runtime Baseline

## Status

DONE

## Objective

Make the documented Node.js 24 LTS runtime baseline explicit and
machine-readable so local development, CI, Docker builds, and agent runs do not
silently drift across unsupported Node versions.

## Context

The audit (H-000) found the documentation stated Node.js 24.x LTS, but the
repository had no `engines.node`, no `.nvmrc`, and no machine-readable runtime
guard; the host was running Node 26.8.2.

## Dependencies

None.

## Scope

- Add root `engines.node` reflecting Node 24.x LTS.
- Add root `.nvmrc` matching the intended major.
- Confirm pnpm `12.3.4` compatibility with Node 24.
- Ensure runtime documentation is consistent.

## Out of Scope

Dependency or framework upgrades, pnpm version changes, CI, Docker architecture,
authentication, task lifecycle directories, `AGENTS.md` redesign, schema changes.

## Acceptance Criteria

- [x] root `package.json` declares the supported Node.js runtime
- [x] `.nvmrc` exists and matches the intended major
- [x] documentation consistently describes Node 24.x LTS
- [x] pnpm compatibility with Node 24 checked
- [x] `pnpm verify` passes
- [x] no unrelated changes

## Required Verification

```bash
node --version
pnpm --version
pnpm verify
git diff --check
git status --short
```

## Implementation Result

- `package.json`: added `"engines": { "node": ">=24 <25" }`.
- `.nvmrc` (new): `24`.
- `docs/development.md`: recorded the machine-readable pins and the rule not to
  widen the baseline to match a local host.
- `README.md`: noted that `nvm use` reads the root `.nvmrc`.

## Verification Result

- `pnpm verify` → exit 0 under the pinned Node **v24.20.0** (nvm) and under the
  host Node v26.8.2.
- `pnpm install --frozen-lockfile --dry-run` → exit 0; lockfile unchanged.
- `git diff --check` → exit 0.
- Host default runtime observed as `v26.8.2`; `pnpm` `12.3.4`.

## Decisions

- Constraint `>=24 <25` deliberately does not support Node 26; the host drift is
  not treated as a new baseline.
- Engine enforcement (`engine-strict` / preflight) intentionally deferred so the
  gate does not fail on the current Node 26 host; the pin remains detectable via
  `.nvmrc` and `engines`.

## Compatibility

pnpm `12.3.4` is compatible with Node 24: `pnpm-lock.yaml` declares the pnpm
package with `engines: { node: '>=18.*' }`, and pnpm 12.3.4 ran successfully
under Node v24.20.0.

## Environment Mismatch

Host default runtime is Node `v26.8.2`, outside the supported baseline.
`pnpm config get engine-strict` is `undefined`, so engines are currently not
enforced at runtime.

## Follow-ups

- Enforce the baseline via `engine-strict` and/or CI `setup-node` with
  `node-version-file: .nvmrc` once CI exists.
- Switch the developer host default toolchain to Node 24 (environment, not
  repository scope).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
