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
[`TODO.md`](TODO.md) for what remains.

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

Prerequisites: Node.js 24 LTS, pnpm, Docker (for the local PostgreSQL).

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

| Command                               | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                            | build `@smshop/db`, then run web + api on the host     |
| `pnpm build`                          | production builds (db → api → web)                     |
| `pnpm typecheck`                      | type-check all packages                                |
| `pnpm lint`                           | ESLint across packages                                 |
| `pnpm format` / `pnpm format:check`   | Prettier write / check                                 |
| `pnpm test`                           | run unit/integration tests (Vitest, API via Supertest) |
| `pnpm db:up` / `pnpm db:down`         | start/stop local PostgreSQL 18                         |
| `pnpm prisma:generate`                | generate Prisma client                                 |
| `pnpm prisma:migrate:dev` / `:deploy` | dev / deploy migrations                                |

## Documentation

- [Architecture](docs/architecture.md) — application boundaries and repository structure
- [Product requirements](docs/product-requirements.md) — functional specification framework (open)
- [Development](docs/development.md) — local development environment and commands
- [Testing](docs/testing.md) — testing strategy and acceptance expectations
- [Deployment](docs/deployment.md) — application-side image build/publish
- [TODO](TODO.md) — unfinished actionable work

The deployment contract itself is owned by `sm-oracle-infra`; see
`sm-oracle-infra/docs/application-deployment-contract.md`.

## Technology stack (accepted)

| Concern          | Choice                                                         |
| ---------------- | -------------------------------------------------------------- |
| Frontend         | Next.js 16                                                     |
| API              | NestJS 11                                                      |
| Database         | PostgreSQL 18 (runtime owned by infrastructure)                |
| ORM / migrations | Prisma 6                                                       |
| Package manager  | pnpm (workspace monorepo)                                      |
| Images           | prebuilt `linux/arm64`, published to GitHub Container Registry |
| CI               | GitHub Actions with Buildx                                     |

The stack is already selected; do not reopen it unless an actual incompatibility
is found.
