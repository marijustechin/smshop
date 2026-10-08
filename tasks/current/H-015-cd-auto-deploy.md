# H-015 — Automatic staging deployment (CD)

## Status

CURRENT — implementation complete; activation pending GitHub Environment/secret
configuration (READY_FOR_DEPLOYMENT_CONFIGURATION).

## Objective

Deploy verified `main` releases to Oracle staging automatically through the
existing restricted `deploy` entry point, after all required checks and image
publication succeed.

## Context

The gated `CI` workflow (H-012) verifies and publishes images but stops short of
deployment. The infrastructure exposes the restricted, root-owned
`/usr/local/sbin/sokoladas-deploy` entry point (`stage`/`release`/`status`). See
`docs/deployment.md` and `sm-oracle-infra/docs/application-deployment-contract.md`.

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
- [x] Workflow-logic tests pass.
- [ ] Live automatic deployment verified (pending `DEPLOY_SSH_KEY` configuration).

## Required Verification

- `pnpm --filter @smshop/web exec vitest run src/test/cd-workflow.test.ts`.
- `pnpm check:workflow`, `pnpm format:check`.
- Actual GitHub run of the `deploy` job after configuration.

## Implementation Result

Added `changes` (runtime vs documentation-only) and `deploy` jobs. `deploy`
stages the manifest produced by the same run via stdin and runs `release`/
`status` through the entry point as `deploy`; it downloads the run's
`release-manifest` artifact, rejects stale runs (compares `github.sha` with the
current `main` tip), pins the host key, and verifies live health. A restricted
Actions SSH key (`no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty`)
was installed on the `deploy` account and verified against the entry point.

## Verification Result

- `vitest` `cd-workflow.test.ts`: 9 passed (plus 7 build-config) — gate, trigger,
  SSH pinning, no-rebuild and stale-run properties.
- Local `check:workflow` and `format:check` pass.
- Live deploy not yet exercised (see follow-up).

## Decisions

- Reused the existing entry point only; no new mechanism.
- Release id derived from the commit (`ci-<sha12>`) so it is deterministic and
  idempotent for retries.

## Follow-ups

- User: create the `staging` GitHub Environment and add secret `DEPLOY_SSH_KEY`
  (contents of `~/sokoladas-deploy-actions.key`), then push/trigger; verify the
  automatic run. Production remains a separate environment/approval boundary.

## State Reconciliation

Filled on completion. Updated `.github/workflows/ci.yml`,
`apps/web/src/test/cd-workflow.test.ts`, `docs/deployment.md`, `AGENTS.md`, this
record and `tasks/TODO.md`; `sm-oracle-infra` deployment contract and
`docs/deployment.md`. Application runtime code, server configuration/data and
secrets are unchanged.

## Completion

Completed date: pending live verification
Commit: (Git history)
