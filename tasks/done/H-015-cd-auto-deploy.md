# H-015 — Automatic staging deployment (CD)

## Status

DONE — verified by a real workflow run on 2026-10-08.

## Objective

Deploy verified `main` releases to Oracle staging automatically through the
existing restricted `deploy` entry point, after all required checks and image
publication succeed.

## Context

The gated `CI` workflow (H-012) verifies and publishes images. The infrastructure
exposes the restricted, root-owned `/usr/local/sbin/sokoladas-deploy` entry point
(`stage`/`release`/`status`).

## Dependencies

- H-012 (gated image publication).
- `sm-oracle-infra` restricted entry point and its deploy lock.

## Scope

- `changes` job (documentation-only detection) and `deploy` job in
  `.github/workflows/ci.yml`.
- Dedicated Actions SSH key installed on the `deploy` account (restricted);
  pinned host key; `staging` GitHub Environment secret.
- Workflow-logic tests (`apps/web/src/test/cd-workflow.test.ts`).

## Out of Scope

- Deploying on PRs/untrusted events; arbitrary manifests/repositories.
- Rollback across incompatible migrations; another deployment mechanism.

## Acceptance Criteria

- [x] Deploy job gated on `workflow`, `verify`, `build`, `release` and `changes`.
- [x] Trusted events only; PRs excluded; documentation-only changes skip deploy.
- [x] Exact-run manifest reused (no "latest"/rebuild); manual dispatch supported.
- [x] Dedicated restricted SSH key + pinned host key; `staging` environment.
- [x] Concurrency serialization + stale-run rejection; no cancel-in-progress.
- [x] Deployment fails loudly if it is required but `DEPLOY_SSH_KEY` is missing.
- [x] Workflow-logic tests pass.
- [x] Live automatic deployment verified.

## Required Verification

- `pnpm --filter @smshop/web exec vitest run src/test/cd-workflow.test.ts`.
- `pnpm check:workflow`, `pnpm format:check`.
- Actual GitHub run of the `deploy` job.

## Implementation Result

Added `changes` (runtime vs documentation-only) and `deploy` jobs. `deploy` stages
the manifest produced by the same run via stdin and runs `release`/`status`
through the entry point as `deploy`; it downloads the run's `release-manifest`
artifact, rejects stale runs, requires and pins the deploy SSH key/host key, and
verifies live health. A restricted Actions SSH key
(`no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty`) was installed
on the `deploy` account.

## Verification Result

Live run `https://github.com/marijustechin/smshop/actions/runs/37840767185`
(source `02a62de6e3b73183f8c94f12ed9d87bf7274f790`): all jobs succeeded, and the
`Deploy staging` steps executed — `Require the deploy SSH key and install it`,
`Prepare the approved release manifest`, `Stage, release and status through the
restricted entry point` and `Verify live health` all **completed success** (not
skipped).

- Applied release `ci-02a62de6e3b7`; previous `d007-v1`; `appliedBy: deploy`.
- web `ghcr.io/marijustechin/smshop-web@sha256:ddd3a6a5c4e6ed133475ba0c2d288a79cf57dcfcc906d5bb88f194d42a8e29ac`;
  api `ghcr.io/marijustechin/smshop-api@sha256:5b0a3f70edb554521811a87ae9d7de2320cbbea805acfabe278a6aac9b72aaea`
  (both `linux/arm64`, revision label = the source SHA).
- Evidence `/opt/sokoladas-staging/evidence/20261008T204746Z-ci-02a62de6e3b7/`
  `finalStatus: success`; containers healthy on the new digests.
- Live checks: `/health/ready`, `/`, `/tortai` → `200`.
- Workflow-logic tests: 18 passed (`build-config` + `cd-workflow`).

## Decisions

- Reused the existing entry point only; no new mechanism.
- Release id derived from the commit (`ci-<sha12>`) — deterministic and idempotent.
- Deployment is required on runtime changes: a missing `DEPLOY_SSH_KEY` fails the
  job with a clear `::error::`; only intentional documentation-only and stale-run
  skips remain non-failing.

## Follow-ups

- None. (The `workflow_dispatch` trigger was not exercised live by the agent —
  no GitHub token/CLI is available to dispatch; the identical `deploy` job ran
  via a `main` push, which additionally exercises the stale-run check. A human
  can confirm the manual path from the Actions UI.)

## State Reconciliation

Updated `.github/workflows/ci.yml`, `apps/web/src/test/cd-workflow.test.ts`,
`docs/deployment.md`, `AGENTS.md`, `tasks/TODO.md` and this record;
`sm-oracle-infra` deployment contract/`docs/deployment.md`/`CHANGELOG.md`; root
`TODO.md`/`docs/project-state.md`. Application runtime code, server
configuration/data and secrets are unchanged.

## Completion

Completed date: 2026-10-08
Commit: `02a62de` (implementation) + docs reconciliation commit
