# Development

Status: **implemented (foundation).**

## Accepted decisions

- Node.js baseline: **Node.js 24.x LTS**.
- Package manager: pnpm, with a workspace monorepo.
- Layout: `apps/web` (Next.js), `apps/api` (NestJS), `packages/db` (Prisma).
- No `packages/contracts` until a concrete shared-contract need exists.
- No Turborepo — pnpm workspaces/scripts are sufficient.
- Lint: ESLint. Format: Prettier. TypeScript type-checking is part of validation.
- Stack: Next.js / NestJS / Prisma / PostgreSQL 18.
- No builds on the Oracle host; images are built only in CI.
- The application never publishes host ports in production (local dev is exempt
  and may expose dev ports on `localhost` only).

## Locked tooling versions (foundation)

| Tool                    | Version                    |
| ----------------------- | -------------------------- |
| Node.js                 | 24.x LTS                   |
| pnpm                    | 12.x                       |
| Next.js                 | 16.x                       |
| React                   | 19.x                       |
| NestJS                  | 11.x                       |
| Prisma / @prisma/client | 6.19.x (see note below)    |
| TypeScript              | 5.9.x                      |
| ESLint                  | 9.x                        |
| Prettier                | 3.x                        |
| Vitest                  | 5.x (unit + integration)   |
| Supertest               | 7.x (API HTTP integration) |

Note: Prisma 6 is pinned for the classic `url = env("DATABASE_URL")` datasource
model used by the deployment contract. Prisma 7 (current major) requires driver
adapters and `prisma.config.ts`; revisit when the schema grows (see `TODO.md`).

## Local development topology

- Next.js and NestJS run **directly on the developer host** (not in containers).
- Local **PostgreSQL 18** runs in Docker/Compose (`docker-compose.yml`).
- Root-level pnpm scripts orchestrate the workspace.
- Per-app `.env` files are gitignored; `.env.example` files are committed.

## Setup

```sh
pnpm install
cp .env.example .env                    # dev Postgres + DATABASE_URL
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
pnpm db:up                              # start local PostgreSQL 18 (Docker)
pnpm dev                                # build db, then run web + api
```

## Commands (implemented)

| Command                               | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| `pnpm dev`                            | build `@smshop/db`, then run web + api on the host |
| `pnpm build`                          | production builds (db → api → web)                 |
| `pnpm lint`                           | ESLint across packages                             |
| `pnpm format` / `pnpm format:check`   | Prettier write / check                             |
| `pnpm typecheck`                      | type-check all packages                            |
| `pnpm test`                           | run the test suite (Vitest; see `docs/testing.md`) |
| `pnpm db:up` / `pnpm db:down`         | start/stop the local PostgreSQL Compose            |
| `pnpm prisma:generate`                | generate the Prisma client                         |
| `pnpm prisma:migrate:dev` / `:deploy` | create/apply / deploy migrations                   |

## Runtime contract (accepted)

- Frontend port `3000`; API port `3001`; `/api/*` owned by the API.
- Readiness endpoint `/health/ready` on both services.
- Images target `linux/arm64`, run as a normal foreground process with UID:GID
  `10001:10001`, no process supervisor.

## Constraints

- Never commit `.env` files or secrets.
- Local dev is separate from the infrastructure Compose/runtime contract; do not
  reuse or modify the deployment contract (owned by `sm-oracle-infra`).
