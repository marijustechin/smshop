# AGENTS.md

Enforceable agent rules for this repository. Detailed guidance lives in `docs/`;
this file contains only constraints, not duplicated architecture or product
documentation.

## Ownership and boundaries

- This repository owns application code only. Infrastructure concerns belong to
  `sm-oracle-infra`.
- The application deployment contract is infrastructure-owned. Its single
  authoritative copy lives in
  `sm-oracle-infra/docs/application-deployment-contract.md`; this repository
  keeps **no local copy**. Read it from the parent workspace's
  `sm-oracle-infra` for cross-repository context. Do not modify it; if a
  genuine contract issue is found, report it instead of silently editing.
- Document ownership does not give infrastructure unilateral ownership of
  application-side decisions: this repository supplies application-owned
  runtime requirements/facts (the contract's C fields), and the infrastructure
  repository records and consumes the reconciled interface.
- Accepted infrastructure decisions in the contract are external constraints.
  Do not override them to simplify application work.

## Security and access

- Never commit secrets, keys, tokens, or `.env` files.
- No production access, no production SSH, no production secrets.
- The application never publishes its own host ports; only the infrastructure
  proxy publishes 80/443.

## Code and workflow

- Stack is fixed: Next.js / NestJS (Fastify adapter) / Prisma 7 / PostgreSQL 18
  on Node.js 24 LTS, managed with pnpm in a workspace monorepo, ESM-first for
  the backend and shared packages. Framework/product choices are fixed unless an
  actual incompatibility is found. **Version currency is not "reopening stack
  selection":** moving a dependency from an older major to the intended current
  stable major follows the technology-selection philosophy below. NestJS remains
  NestJS, Prisma remains Prisma, PostgreSQL remains PostgreSQL, and Fastify
  remains the selected HTTP adapter — do not swap these out without a documented
  incompatibility.
- Layout is fixed: `apps/web` (Next.js), `apps/api` (NestJS), `packages/db`
  (Prisma). Do not create `packages/contracts` until a concrete shared-contract
  need exists.
- Application runtime constraints are fixed: `linux/arm64` images, runtime user
  UID:GID `10001:10001`, stateless/disposable containers with no persistent
  filesystem state (unless an approved requirement introduces it), normal
  foreground processes, graceful SIGTERM shutdown with meaningful exit codes,
  `/api/*` owned by the API. Images must not contain a process supervisor
  (PM2/supervisord/systemd).
- Local development: Node/NestJS/Next.js run directly on the host; only
  PostgreSQL runs in Docker/Compose. No Turborepo; pnpm workspace scripts are
  sufficient. Lint with ESLint, format with Prettier, type-check with
  TypeScript.
- Follow the monorepo layout in `docs/architecture.md`.

## Technology selection philosophy

- Use current stable, production-ready versions by default. Avoid unnecessary
  legacy choices. Do not pick an older major merely because it is familiar,
  older tutorials use it, it avoids ESM, CommonJS feels simpler, migration work
  can be avoided, or an older API is easier to copy from existing examples.
- Default rule: prefer the latest stable major version that is production-ready,
  compatible with the project architecture, and sufficiently supported by the
  surrounding ecosystem.
- Do not blindly adopt every new release. Before adopting a new major, verify:
  compatibility with the supported Node.js baseline; compatibility with required
  frameworks and integrations; ecosystem maturity; production readiness;
  migration impact; and support in critical dependencies.
- Avoid beta, alpha, RC, experimental, and newly released technology whose
  ecosystem support is still materially incomplete, unless there is a specific
  documented reason.
- If the latest stable major cannot reasonably be used, select the newest
  suitable stable version and document the concrete compatibility reason.
- **ESM-first:** new JavaScript/TypeScript code and dependencies should be
  ESM-compatible by default. Do not introduce CommonJS-only patterns or
  dependencies merely for convenience. CommonJS is acceptable only when a
  required dependency or platform constraint provides no reasonable modern
  alternative; do not downgrade libraries or tooling solely to preserve
  CommonJS compatibility.
- Practical principle: stay current without chasing instability. Prefer modern,
  supported, production-ready technology over legacy defaults, while avoiding
  premature adoption of immature releases.
- Such choices are intentional, for example: modern NestJS versions; Fastify
  rather than Express where the architecture specifies Fastify; Prisma 7 rather
  than starting new greenfield work on Prisma 6; the current stable TypeScript
  compatible with the stack; ESM-first configuration. This is a decision rule,
  not a version catalogue — specific versions belong in package manifests and
  architecture/development documentation.

## Tasks and change discipline

- Follow the task workflow in `docs/task-workflow.md`: `tasks/TODO.md` is the
  roadmap/state document; one task lives in `tasks/current/<task>.md`; completed
  tasks move to `tasks/done/`.
- Work only within the current task's documented scope.
- Do not make unrelated changes, silently expand scope, perform speculative
  refactors, or create abstractions for hypothetical future use.
- Do not add dependencies without concrete justification.
- Preserve existing architecture boundaries.
- Newly discovered work is recorded as a follow-up (task file / `tasks/TODO.md`),
  not silently included in the current task.
- Stop and report when repository facts materially contradict the task
  assumptions.
- Do not commit or push unless explicitly asked. Completing a task does **not**
  authorize a commit.

## Documentation discipline

- `tasks/TODO.md` is the high-level roadmap and current-state navigation
  document, not a duplicate of completed work: detailed completed work lives in
  `tasks/done/` and Git history.
- Detailed requirements live in task files, not in `tasks/TODO.md`.
- Proposed defaults from the deployment contract (section B) are not accepted
  application facts until explicitly reviewed and confirmed. Accepted B defaults
  are recorded in `docs/architecture.md`; keep the remainder marked as open.

## Verification

- Run `pnpm verify` before finishing work; it is the authoritative local
  verification gate (format, lint, typecheck, test, build). Work is not complete
  until it passes. Work that touches persistence must also pass `pnpm verify:db`
  (database-backed tests). Commands are documented in `docs/development.md` and
  `docs/testing.md`.
- No GitHub Actions implementation until it is listed in `tasks/TODO.md`.
- Product implementation is permitted only when the relevant requirements are
  documented in the authoritative sources. The organized requirements
  (`docs/product-requirements-organized.md`) are authoritative, with
  `docs/product-requirements-notes.md` as supporting notes, plus the roadmap in
  `tasks/TODO.md` and the active task file. Do not start product work on
  undocumented or invented requirements.
