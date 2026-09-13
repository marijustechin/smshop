# smshop

Application repository for the **sokoladas.eu** e-commerce project.

This repository owns the application side of the system: frontend and API source
code, database schema and migrations, Dockerfiles, health endpoint
implementation, tests, and production application image builds. It is separate
from the infrastructure repository `sm-oracle-infra`, which owns Oracle Cloud
configuration, production Docker Compose, Nginx/TLS, PostgreSQL runtime,
secret provisioning, and deployment/rollback.

The boundary between the two repositories is defined in the application
deployment contract, which is owned by the infrastructure project. Its single
authoritative copy lives in
`sm-oracle-infra/docs/application-deployment-contract.md`; this repository keeps
no local copy. Accepted infrastructure decisions in it are external constraints
and must not be silently changed.

## Status

**Monorepo scaffolded (foundation only).** No product features. See
[`tasks/TODO.md`](tasks/TODO.md) for the roadmap and current state.

## Repository structure

```
apps/web/        Next.js frontend (port 3000)
apps/api/        NestJS API (port 3001, owns /api/*)
packages/db/     Prisma schema + migrations + generated client
docker/          web.Dockerfile, api.Dockerfile (linux/arm64, UID 10001:10001)
docker-compose.yml  local PostgreSQL 18 for development
docs/            architecture, product, development, testing, deployment docs
```

## Getting started

Prerequisites: Node.js 24 LTS (`nvm use` reads the root `.nvmrc`), pnpm, Docker
(for the local PostgreSQL).

```sh
pnpm install
cp .env.example .env                    # development DB/connection values
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
pnpm db:up                              # start local PostgreSQL 18
pnpm dev                                # build db package, then run web + api
```

Endpoints (development):

- Frontend `http://localhost:3000` — `/health/ready`
- API `http://localhost:3001` — `/health/ready`, `/api`

## Scripts

| Command                               | Purpose                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                            | build `@smshop/db`, then run web + api on the host                  |
| `pnpm build`                          | production builds (db → api → web)                                  |
| `pnpm typecheck`                      | type-check all packages                                             |
| `pnpm lint`                           | ESLint across packages                                              |
| `pnpm format` / `pnpm format:check`   | Prettier write / check                                              |
| `pnpm test`                           | run unit/integration tests (Vitest, API via Supertest)              |
| `pnpm verify`                         | full local verification gate (format, lint, typecheck, test, build) |
| `pnpm verify:db`                      | `verify` plus database-backed tests (starts the test DB)            |
| `pnpm test:db`                        | run database-backed integration tests                               |
| `pnpm db:up` / `pnpm db:down`         | start/stop local PostgreSQL 18                                      |
| `pnpm prisma:generate`                | generate Prisma client                                              |
| `pnpm prisma:migrate:dev` / `:deploy` | dev / deploy migrations                                             |

## Verification gate

`pnpm verify` is the single authoritative local verification gate. It runs, in
order: formatting check, lint, typecheck, tests, and production build. It exits
`0` only when every stage succeeds.

Implementation work is not technically complete until `pnpm verify` passes. The
gate is safe to run repeatedly, does not modify source files, and does not
require production services.

## Documentation

- [Architecture](docs/architecture.md) — application boundaries and repository structure
- [Authentication](docs/authentication.md) — authentication persistence model and identity/customer boundary
- [Product requirements](docs/product-requirements-organized.md) — authoritative functional requirements (working draft)
- [Product requirements notes](docs/product-requirements-notes.md) — supporting notes
- [Development](docs/development.md) — local development environment and commands
- [Configuration](docs/configuration.md) — environment contract, validation, and secrets strategy
- [Email](docs/email.md) — provider-independent SMTP email infrastructure
- [Testing](docs/testing.md) — testing strategy and acceptance expectations
- [Task workflow](docs/task-workflow.md) — task lifecycle, naming, and completion rules
- [Deployment](docs/deployment.md) — application-side image build/publish
- [TODO](tasks/TODO.md) — roadmap and current project state

The deployment contract itself is owned by `sm-oracle-infra`; see
`sm-oracle-infra/docs/application-deployment-contract.md`.

## Technology stack (accepted)

| Concern          | Choice                                                         |
| ---------------- | -------------------------------------------------------------- |
| Frontend         | Next.js 16                                                     |
| API              | NestJS 11 (Fastify adapter)                                    |
| Database         | PostgreSQL 18 (runtime owned by infrastructure)                |
| ORM / migrations | Prisma 7 (`@prisma/adapter-pg`)                                |
| Module system    | ESM-first (backend and shared packages)                        |
| Package manager  | pnpm (workspace monorepo)                                      |
| Images           | prebuilt `linux/arm64`, published to GitHub Container Registry |
| CI               | GitHub Actions with Buildx                                     |

The stack is already selected; do not reopen it unless an actual incompatibility
is found. Version currency follows the technology-selection philosophy in
`AGENTS.md`.
