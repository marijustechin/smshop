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

- Stack is fixed: Next.js / NestJS / Prisma / PostgreSQL 18 on Node.js 24 LTS,
  managed with pnpm in a workspace monorepo. Do not reopen stack selection
  unless an actual incompatibility is found.
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
- Do not commit or push unless explicitly asked.
- Follow the monorepo layout in `docs/architecture.md`.

## Documentation discipline

- `TODO.md` contains only unfinished, actionable work. Completed work goes to
  Git history / CHANGELOG, not closed TODO sections.
- Proposed defaults from the deployment contract (section B) are not accepted
  application facts until explicitly reviewed and confirmed. Accepted B defaults
  are recorded in `docs/architecture.md`; keep the remainder marked as open.

## Verification

- Run lint, typecheck, and tests before finishing work (commands in
  `docs/development.md` and `docs/testing.md`).
- No GitHub Actions implementation until it is listed in `TODO.md`.
- No product features until product requirements exist in
  `docs/product-requirements.md` (catalog, auth, cart, checkout, admin,
  payments, shipping, email, uploads/media).
