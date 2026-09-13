# Development

Status: **implemented (foundation).**

## Accepted decisions

- Node.js baseline: **Node.js 24.x LTS**. Pinned by root `.nvmrc` (`24`) and
  `engines.node` (`>=24 <25`); do not widen to a newer major to match a local
  host.
- Package manager: pnpm, with a workspace monorepo.
- Layout: `apps/web` (Next.js), `apps/api` (NestJS), `packages/db` (Prisma).
- No `packages/contracts` until a concrete shared-contract need exists.
- No Turborepo — pnpm workspaces/scripts are sufficient.
- Lint: ESLint. Format: Prettier. TypeScript type-checking is part of validation.
- Stack: Next.js / NestJS (Fastify adapter) / Prisma 7 / PostgreSQL 18.
- Module system: **ESM-first** for the backend and shared packages (`"type":
"module"`, `module: nodenext`, explicit `.js` relative imports). See
  `docs/architecture.md`.
- No builds on the Oracle host; images are built only in CI.
- The application never publishes host ports in production (local dev is exempt
  and may expose dev ports on `localhost` only).

## Locked tooling versions (foundation)

| Tool                    | Version                                       |
| ----------------------- | --------------------------------------------- |
| Node.js                 | 24.x LTS                                      |
| pnpm                    | 12.x                                          |
| Next.js                 | 16.x                                          |
| React                   | 19.x                                          |
| NestJS                  | 11.x                                          |
| Nest HTTP adapter       | Fastify (via `@nestjs/platform-fastify` 11.x) |
| Prisma / @prisma/client | 7.x (`@prisma/adapter-pg`)                    |
| TypeScript              | 5.9.x                                         |
| ESLint                  | 9.x                                           |
| Prettier                | 3.x                                           |
| Vitest                  | 5.x (unit + integration)                      |
| Supertest               | 7.x (API HTTP integration)                    |

Prisma 7 uses the `prisma-client` generator, a PostgreSQL driver adapter
(`@prisma/adapter-pg`), and `packages/db/prisma7.config.ts` for the datasource
URL. TypeScript stays on the newest stable 5.9.x: it is the version validated
with NestJS 11 decorator metadata (`emitDecoratorMetadata`/`experimentalDecorators`)
and `@prisma/client` 7 (`typescript >=5.4.0`); TypeScript 6/7 are newer majors
whose Nest decorator-metadata support is not yet established, so adopting them is
deferred to a separately evaluated task.

## Local development topology

- Next.js and NestJS run **directly on the developer host** (not in containers).
- Local **PostgreSQL 18** runs in Docker/Compose (`docker-compose.yml`).
- Root-level pnpm scripts orchestrate the workspace.
- Per-app `.env` files are gitignored; `.env.example` files are committed.
- API configuration is validated at startup; see `docs/configuration.md` for the
  variable contract, secrets strategy (direct value or `<NAME>_FILE`), and
  required-vs-reserved rules.

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

| Command                               | Purpose                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                            | build `@smshop/db`, then run web + api on the host                  |
| `pnpm build`                          | production builds (db → api → web)                                  |
| `pnpm lint`                           | ESLint across packages                                              |
| `pnpm format` / `pnpm format:check`   | Prettier write / check                                              |
| `pnpm typecheck`                      | type-check all packages                                             |
| `pnpm test`                           | run the test suite (Vitest; see `docs/testing.md`)                  |
| `pnpm verify`                         | full local verification gate (format, lint, typecheck, test, build) |
| `pnpm verify:db`                      | `verify` plus database-backed tests (starts the test DB)            |
| `pnpm db:test:up` / `db:test:down`    | start/stop the isolated test database                               |
| `pnpm db:test:migrate` / `:reset`     | apply / reset migrations on the test database                       |
| `pnpm test:db`                        | run database-backed integration tests                               |
| `pnpm db:up` / `pnpm db:down`         | start/stop the local PostgreSQL Compose                             |
| `pnpm prisma:generate`                | generate the Prisma client                                          |
| `pnpm prisma:migrate:dev` / `:deploy` | create/apply / deploy migrations                                    |

## Verification gate

`pnpm verify` is the authoritative local verification command and defines the
minimum technical gate for completing implementation tasks. It runs the existing
checks in a deterministic order and fails fast on the first failure:

```text
format:check → lint → typecheck → test → build
```

The command exits `0` only when every stage passes. Implementation tasks are not
technically complete until `pnpm verify` passes. It is safe to run repeatedly,
does not modify application source files, does not update dependencies, does not
change the database schema, does not create migrations, and does not require
production services. It is suitable for reuse by CI.

`pnpm verify` is intentionally service-free and deterministic, so it excludes
database-backed tests. Work that changes persistence must also pass
`pnpm verify:db`, which starts the isolated test database, applies migrations,
runs `pnpm verify`, then runs the database-backed tests (see `docs/testing.md`).

CI (`.github/workflows/ci.yml`) runs `pnpm verify:ci` on a clean Node.js 24
environment (selected from `.nvmrc`) with an ephemeral PostgreSQL service, so
local and CI verification cover the same gates.

## Runtime contract (accepted)

- Frontend port `3000`; API port `3001`; `/api/*` owned by the API.
- Readiness endpoint `/health/ready` on both services.
- Images target `linux/arm64`, run as a normal foreground process with UID:GID
  `10001:10001`, no process supervisor.

## Constraints

- Never commit `.env` files or secrets.
- Local dev is separate from the infrastructure Compose/runtime contract; do not
  reuse or modify the deployment contract (owned by `sm-oracle-infra`).
