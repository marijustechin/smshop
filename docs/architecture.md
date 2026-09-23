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

`smShop` additionally owns: application runtime/deployment contract, API ports,
health/readiness endpoints, the environment-variable contract, Prisma
migrations, application startup behaviour, and application-level deployment
expectations.

`sm-oracle-infra` additionally owns: Oracle VM configuration, OS-level
networking/firewall, host packages, Docker/Compose host orchestration, reverse
proxy, TLS/ACME, production secret delivery, production persistent volumes,
backups, logging/monitoring, deployment/rollback runbooks, and production
service lifecycle. Infrastructure implementation is **not** duplicated into
`smShop`; this repository documents cross-repository contracts only. Infrastructure
roadmap status is tracked as `OPS-*` in `tasks/TODO.md`.

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
| API                   | NestJS 11 (Fastify adapter) in `apps/api`                       |
| Database / migrations | Prisma 7 in `packages/db` (driver adapter, `prisma7.config.ts`) |
| Module system         | ESM-first for backend and shared packages                       |
| Shared contracts      | none yet — `packages/contracts` only if a concrete need appears |
| Database runtime      | PostgreSQL 18 (owned by infrastructure)                         |
| Images                | prebuilt `linux/arm64`, published to GHCR                       |
| CI                    | GitHub Actions + Buildx                                         |

Prisma 7 uses the `prisma-client` generator, a driver adapter
(`@prisma/adapter-pg`), and `packages/db/prisma7.config.ts` for the datasource
URL. The API uses the Fastify platform adapter and emits ESM
(`"type": "module"`, `module: nodenext`).

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

## API source layout

NestJS application modules live under `apps/api/src/modules/<module-name>/`.
Cross-cutting bootstrap/configuration concerns may stay in dedicated top-level
folders such as `src/config`; `app.module.ts` and `main.ts` stay at `src/` root.

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   └── password/
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── admin-users.controller.ts
│   │   ├── admin-users.service.ts
│   │   ├── authorization/
│   │   ├── bootstrap/
│   │   └── dto/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── health/
│       ├── health.controller.ts
│       └── health.controller.spec.ts
├── config/
│   └── ...
├── app.module.ts
└── main.ts
```

Do not place feature modules directly under `src/`.

## Frontend source layout (FSD-lite)

`apps/web` follows a **pragmatic five-layer FSD-lite** structure (ARCH-001).
Next.js App Router remains the routing/composition layer; classic FSD `pages/`
and `processes/` layers are intentionally omitted because `app/` already owns
routing and there is no cross-page process orchestration to model.

```
apps/web/src/
├── app/         Next.js routes, layouts, metadata, route handlers, composition
├── widgets/     larger reusable UI composition blocks (none yet)
├── features/    user actions/use cases (currently `auth`)
├── entities/    domain-oriented frontend models/UI (currently `user`)
└── shared/      domain-agnostic ui / api / config / lib
```

Dependency direction (strict): `app → widgets → features → entities → shared`.

- `app/` composes the layers below. `page.tsx` files, `layout.tsx`,
  `globals.css`, route handlers and metadata stay here; it should not contain
  reusable business logic.
- `widgets/` are larger UI composition blocks (header, footer, mobile nav,
  product grid, filters panel, account navigation, ...). None exist yet.
- `features/` are user actions/use cases (auth, and later add-to-cart, search,
  filtering, checkout actions, account actions). They may use entities and
  shared.
- `entities/` are domain-oriented frontend models/UI (user, and later product,
  category, cart, order). They must not know page-specific flows.
- `shared/` is domain-agnostic infrastructure (`ui`, `api`, `config`, `lib`) and
  must not import from entities/features/widgets/app.

Same-layer policy: cross-feature and cross-entity imports are disallowed by
default. Imports within a slice use relative paths; the `@/...` alias is reserved
for imports from other slices/layers. When two slices need common logic it moves
down into `entities/` or `shared/`.

Public API: slices imported across boundaries expose a small `index.ts` public
API (currently `shared/ui`, `shared/api`, `shared/lib`, `entities/user`,
`features/auth`). There is no global/root barrel, and slices import one another
through the public API rather than through a slice's internals.

Enforcement uses the existing ESLint setup only (`no-restricted-imports` in
`apps/web/eslint.config.mjs`); no FSD-specific tooling is added. The existing
`@/*` alias (`@/ → src/*`) is unchanged and no layer-specific aliases were
introduced.

The authentication implementation was migrated into this structure as a
source-structure change only: routes, URLs, the API contract, cookies/session
behaviour, Turnstile and Google behaviour, and error messages are unchanged.

## Domain boundaries

- **Authentication identity is separate from the e-commerce customer.** `User`
  (authentication identity) must not become the `Customer` aggregate. The
  authentication model is owned by `packages/db` and documented in
  `docs/authentication.md`; a future `Customer` domain may link to `User`.
  Authorization uses a `Role` enum on `User` (`user` / `editor` / `admin`),
  enforced server-side by `RolesGuard` in `apps/api/src/modules/admin`; `editor`
  is reserved and carries no capabilities yet.

## Authentication persistence

- Auth models live in `packages/db/prisma/schema.prisma` (`User`, `AuthAccount`,
  `AuthSession`, `EmailVerificationToken`, `PasswordResetToken`). Auth persistence
  belongs to this repository; auth **behaviour** (endpoints, tokens, hashing,
  email, OAuth) is separate, later work. See `docs/authentication.md`.

## Open fields (application-owned)

- C.1 — production image references (digests): **resolved** — immutable
  `linux/arm64` images published to GHCR and pinned by digest; see the
  authoritative infrastructure deployment contract.
- C.3 — environment variable names and DB connection layout: resolved — a full
  `DATABASE_URL`/`DATABASE_URL_FILE`, or assembly from
  `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`(`_FILE`); see
  `docs/configuration.md`.
- C.4 — file-based secret names and file-reading support: the application side is
  defined — the API accepts either a direct environment variable or a
  `<NAME>_FILE` path for every secret (see `docs/configuration.md`). Exact
  production secret file names and mount locations remain coordinated with
  `sm-oracle-infra`.
- C.5 — writable runtime paths: the foundation requires **no** writable runtime
  paths (stateless by default); reopen only if a requirement introduces them.
- C.6 — persistent storage beyond PostgreSQL: product-dependent, open.
- C.7 — egress: SMTP egress is **prepared** (committed, not deployed); other
  future egress requirements remain product-dependent and open.

Contract C.2 (migration command) is effectively resolved by the foundation:
`prisma migrate deploy`, exit 0 on success. The exact wrapper command inside the
API image remains an implementation detail.
