# Architecture

Status: **implemented (foundation).** Defines application boundaries and the
monorepo structure. Accepted infrastructure decisions referenced here come from
the application deployment contract (owned by `sm-oracle-infra`) and are
external constraints.

## Ownership boundary

| Owned by this repository                   | Owned by `sm-oracle-infra`                  |
| ------------------------------------------ | ------------------------------------------- |
| Application source code (Next.js / NestJS) | Oracle/OCI configuration                    |
| Frontend and API architecture              | Production Docker Compose                   |
| Database schema and migrations (Prisma)    | Production Nginx/TLS                        |
| Application Dockerfiles                    | Production PostgreSQL runtime configuration |
| Health endpoint implementation             | Production secret provisioning              |
| Tests                                      | Production deployment/rollback              |
| Production application image builds (CI)   | Production SSH access                       |

Additional boundary corrections (accepted):

- Docker health-check **cadence** (interval, timeout, retries, start_period)
  belongs to `sm-oracle-infra`, not to the application contract.
- Production Compose **service names** belong to `sm-oracle-infra`. This
  repository uses `apps/web` and `apps/api` as its own naming.
- Exact environment-variable names, file-secret names, and production image
  digests remain open until implementation defines them.

The application never publishes its own host ports; only the infrastructure
proxy publishes 80/443.

## Accepted stack and decisions

| Concern               | Decision                                                        |
| --------------------- | --------------------------------------------------------------- |
| Package manager       | pnpm (workspace monorepo)                                       |
| Frontend              | Next.js 16 in `apps/web`                                        |
| API                   | NestJS 11 in `apps/api`                                         |
| Database / migrations | Prisma 6 in `packages/db`                                       |
| Shared contracts      | none yet — `packages/contracts` only if a concrete need appears |
| Database runtime      | PostgreSQL 18 (owned by infrastructure)                         |
| Images                | prebuilt `linux/arm64`, published to GHCR                       |
| CI                    | GitHub Actions + Buildx                                         |

Prisma 6 is pinned for the classic `url = env("DATABASE_URL")` datasource model
implied by the deployment contract. Prisma 7 (current major) requires driver
adapters and `prisma.config.ts`; revisit when the schema grows (see `TODO.md`).

Accepted runtime facts:

- Frontend internal port `3000`; API internal port `3001`.
- Readiness endpoint `/health/ready`: frontend returns 200 with no DB/API
  dependency; API returns 200 only after an authenticated DB query, else 503.
- `/api` and `/api/*` belong to the API (Next.js must not compete).
- Runtime user target UID:GID `10001:10001`.
- Frontend and API containers are **stateless/disposable by default**; no
  persistent application filesystem state unless explicitly introduced by an
  approved requirement.
- Application processes run as **normal foreground processes**.
- Application processes must handle **graceful SIGTERM shutdown** and return
  meaningful exit codes.
- Application images must **not** contain or depend on PM2, supervisord,
  systemd, or any other process supervisor.
- Migrations use the same API image and run `prisma migrate deploy`; the exact
  runtime command remains an implementation detail until the API image is
  designed.

Container lifecycle boundary (infra-owned): Docker restart policy, Compose
`init`, health-check cadence, dependency ordering, and container lifecycle
policy all belong to `sm-oracle-infra`.

## Monorepo structure

```
apps/
  web/          Next.js frontend (port 3000)
  api/          NestJS API (port 3001)
packages/
  db/           Prisma schema, migrations, generated client
docker/
  web.Dockerfile
  api.Dockerfile
docs/
```

## Service responsibilities

- `apps/web` — rendering and frontend; calls the API only via `/api`.
- `apps/api` — API under `/api`; business logic; Prisma data access.
- `packages/db` — schema and migrations; consumed by the API image.
- `migrate` (infra-side service) — reuses the API image digest and runs
  `prisma migrate deploy`.

## Open fields (application-owned)

- C.1 — production image references (digests): open until images are built.
- C.3 — environment variable names and DB connection layout: dev defaults are
  `DATABASE_URL` and `PORT`; production values open until implementation and
  `sm-oracle-infra` coordination.
- C.4 — file-based secret names and file-reading support: open, requires
  coordination with `sm-oracle-infra`.
- C.5 — writable runtime paths: the foundation requires **no** writable runtime
  paths (stateless by default); reopen only if a requirement introduces them.
- C.6 — persistent storage beyond PostgreSQL: product-dependent, open.
- C.7 — egress: product-dependent, open.

Contract C.2 (migration command) is effectively resolved by the foundation:
`prisma migrate deploy`, exit 0 on success. The exact wrapper command inside the
API image remains an implementation detail.
