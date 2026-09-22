# Deployment

Status: **application-side description only.** This document covers the
application's responsibility in producing and delivering container images. The
infrastructure interface is defined in the application deployment contract
(owned by `sm-oracle-infra`).

## Application-owned delivery

- **Build:** GitHub Actions with Buildx, producing prebuilt `linux/arm64`
  images (native arm64 runners preferred; QEMU emulation as CI fallback).
- **Registry:** GitHub Container Registry (GHCR).
- **Tagging:** release version + git SHA for traceability; deployment pins by
  immutable digest — no floating `:latest` tags in the deploy path.
- **No server builds:** no source checkout, no Node.js/pnpm on the Oracle host.
- **No automatic deployment:** application CI builds and publishes images only;
  it receives no production SSH credentials and does not deploy to the Oracle
  host.

## Accepted image/runtime facts

- Frontend internal port `3000`; API internal port `3001`.
- Readiness endpoint `/health/ready` (semantics in `docs/architecture.md`).
- Runtime user target UID:GID `10001:10001`.
- `/api` and `/api/*` belong to the API.
- Containers are stateless/disposable; no persistent application filesystem
  state without an approved requirement.
- Application processes run as normal foreground processes.
- Graceful SIGTERM shutdown with meaningful exit codes.
- Images must not contain or depend on PM2, supervisord, systemd, or another
  process supervisor.
- Migrations reuse the API image and run `prisma migrate deploy`; the API runtime
  image is also the migration image (see below).

## Cross-repository deployment contract

This is the application-side declaration consumed by `sm-oracle-infra`. The
authoritative shared contract remains
`sm-oracle-infra/docs/application-deployment-contract.md`; this section only
states what the application provides and expects. Unresolved points are marked
**open**.

Application provides / expects (all under `/api` unless noted):

- **Runtime:** Node.js 24 (`.nvmrc`, `engines.node = >=24 <25`); pnpm workspace.
- **Images:** prebuilt `linux/arm64` from CI, pinned by digest; no server builds.
- **Entrypoints:** web `node apps/web/server.js` with working directory `/app`
  (port `3000`); API `node /app/apps/api/dist/main.js` (port `3001`). The API
  image's default working directory is `/app/packages/db` so the one-shot
  `prisma migrate deploy` job resolves `prisma7.config.ts` and
  `prisma/schema.prisma`; the API server is started by absolute path, so the
  working directory does not affect it.
- **Routing:** the API owns `/api` and `/api/*`; `/health/ready` is served
  outside `/api` on both services.
- **Health/readiness:** `/health/ready` (API returns 200 only after a DB query).
- **Environment contract:** documented in `docs/configuration.md`
  (`NODE_ENV`, `PORT`, `DATABASE_URL`/`DB_*`, `WEB_ORIGIN`, `API_ORIGIN`,
  `JWT_*`, `SMTP_*`, `MAIL_FROM`, `GOOGLE_*`).
- **Database connection:** the API consumes a single PostgreSQL URL resolved
  from `DATABASE_URL`/`DATABASE_URL_FILE` or assembled from
  `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`(`_FILE`); the Prisma CLI
  uses the same resolution. The infrastructure delivers components plus a
  mounted password file, so the credential is never rendered into a nonsecret
  env value.
- **Secrets:** every secret accepts a direct value or `<NAME>_FILE` pointing at a
  secret file (contract C.4 application side). The application secrets are
  `DATABASE_URL`/`DB_PASSWORD`, `JWT_ACCESS_SECRET`, `SMTP_PASSWORD`,
  `GOOGLE_CLIENT_SECRET`, and `TURNSTILE_SECRET_KEY`.
- **Database:** PostgreSQL via Prisma; connection assembled per above.
- **Migrations:** `prisma migrate deploy` using the API image (the API runtime
  image is also the migration image; its default working directory is the
  `@smshop/db` package so the Prisma config/schema resolve); exit 0 on success.
- **Shutdown:** graceful SIGTERM with meaningful exit codes; no process
  supervisor.
- **Persistence:** stateless containers; no writable application paths by
  default.

### Exact runtime interface (reconciled 2026-09-15)

Application-owned (semantics/names) — see `docs/configuration.md`:

- Ordinary (nonsecret) service env: `NODE_ENV=production`, `PORT`, `WEB_ORIGIN`,
  optional `API_ORIGIN`, `JWT_ACCESS_TTL`, `AUTH_SESSION_TTL`, SMTP/Google/Turnstile
  blocks as applicable. `/api` is served on the API's internal port `3001`; the
  frontend serves `3000`.
- File-backed secrets (`<NAME>_FILE`, one trailing newline tolerated):
  `DB_PASSWORD_FILE` (or `DATABASE_URL_FILE`), `JWT_ACCESS_SECRET_FILE`,
  `SMTP_PASSWORD_FILE`, `GOOGLE_CLIENT_SECRET_FILE`,
  `TURNSTILE_SECRET_KEY_FILE`.
- Frontend build-time public values (inlined by Next.js): production uses
  relative `/api` (no `NEXT_PUBLIC_API_BASE_URL`); `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  is required at image build time only when Turnstile is enabled.

Infrastructure-owned (values/mounts/lifecycle) — see the authoritative contract
`sm-oracle-infra/docs/application-deployment-contract.md` and
`sm-oracle-infra/docs/deployment.md`: secret values, file names and mount paths,
per-service grants, PostgreSQL roles and credentials, restart policy, health
cadence, and container lifecycle.

`sm-oracle-infra` supplies: actual secret values and mounts, DNS, TLS/ACME,
reverse-proxy routing, persistent storage, production database connectivity,
and container orchestration/lifecycle.

Resolved/current (application/infrastructure alignment): production image
digests (C.1 — published and pinned by immutable digest), writable paths (C.5 —
ephemeral `/tmp` only), the environment/secret interface (C.3/C.4), migration
command (C.2), and database connection layout (see "Exact runtime interface"
above). SMTP egress (C.7) is **prepared** (committed, not deployed); any other
future egress remains open. Persistent storage beyond PostgreSQL (C.6) remains
product-dependent and open. The authoritative field status is maintained in
`sm-oracle-infra/docs/application-deployment-contract.md`.

## Infra-owned (not application contract)

- Docker restart policy.
- Compose `init`.
- Health-check cadence (interval, timeout, retries, start_period).
- Dependency ordering and container lifecycle policy.
- Production Compose service names.
- Everything else listed in the deployment contract's infra boundary.

## Contract field status (application-owned)

The authoritative field status is maintained in the infrastructure deployment
contract (`sm-oracle-infra/docs/application-deployment-contract.md`). Summary of
the application-owned fields:

1. C.1 — production image references (digests): **resolved** — immutable
   `linux/arm64` images published to GHCR and pinned by digest; see the
   contract's "Published application images".
2. C.2 — migration command: **resolved** — API image, `prisma migrate deploy`, exit 0.
3. C.3 — environment variable names and DB connection layout: **resolved** — URL
   or `DB_*` component assembly; see `docs/configuration.md`.
4. C.4 — file-based secret names and file-reading support: application side
   **resolved** (`<NAME>_FILE`); production secret file names/mounts remain
   infrastructure-owned.
5. C.5 — writable runtime paths: **resolved** — ephemeral `/tmp`; otherwise
   stateless.
6. C.6 — persistent storage beyond PostgreSQL: product-dependent, open.
7. C.7 — egress requirements: SMTP egress **prepared** (committed, not deployed);
   other future egress remains product-dependent and open.
