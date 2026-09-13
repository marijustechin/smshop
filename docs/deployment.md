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
- Migrations reuse the API image and run `prisma migrate deploy`; the exact
  runtime command is an implementation detail until the API image is designed.

## Cross-repository deployment contract

This is the application-side declaration consumed by `sm-oracle-infra`. The
authoritative shared contract remains
`sm-oracle-infra/docs/application-deployment-contract.md`; this section only
states what the application provides and expects. Unresolved points are marked
**open**.

Application provides / expects (all under `/api` unless noted):

- **Runtime:** Node.js 24 (`.nvmrc`, `engines.node = >=24 <25`); pnpm workspace.
- **Images:** prebuilt `linux/arm64` from CI, pinned by digest; no server builds.
- **Entrypoints:** web `node .next/standalone/apps/web/server.js` (port `3000`);
  API `node dist/main.js` (port `3001`).
- **Routing:** the API owns `/api` and `/api/*`; `/health/ready` is served
  outside `/api` on both services.
- **Health/readiness:** `/health/ready` (API returns 200 only after a DB query).
- **Environment contract:** documented in `docs/configuration.md`
  (`NODE_ENV`, `PORT`, `DATABASE_URL`, `WEB_ORIGIN`, `API_ORIGIN`, `JWT_*`,
  `SMTP_*`, `MAIL_FROM`, `GOOGLE_*`).
- **Secrets:** every secret accepts a direct value or `<NAME>_FILE` pointing at a
  secret file (contract C.4 application side).
- **Database:** PostgreSQL via Prisma; connection from `DATABASE_URL`.
- **Migrations:** `prisma migrate deploy` using the API image; exit 0 on success.
- **Shutdown:** graceful SIGTERM with meaningful exit codes; no process
  supervisor.
- **Persistence:** stateless containers; no writable application paths by
  default.

`sm-oracle-infra` supplies: actual secret values and mounts, DNS, TLS/ACME,
reverse-proxy routing, persistent storage, production database connectivity,
and container orchestration/lifecycle.

Still **open** (application/infrastructure alignment): production image digests
(C.1), production variable/DB layout values (C.3), production secret file names
and mount locations (C.4), concrete writable paths if any (C.5), persistent
storage beyond PostgreSQL (C.6), and required egress (C.7).

## Infra-owned (not application contract)

- Docker restart policy.
- Compose `init`.
- Health-check cadence (interval, timeout, retries, start_period).
- Dependency ordering and container lifecycle policy.
- Production Compose service names.
- Everything else listed in the deployment contract's infra boundary.

## Open fields (application-owned)

1. C.1 — production image references (digests): resolved at build time.
2. C.3 — environment variable names and DB connection layout: implementation.
3. C.4 — file-based secret names and file-reading support: coordinate with
   `sm-oracle-infra`.
4. C.5 — writable runtime paths: ephemeral `/tmp` by default; concrete paths
   at implementation.
5. C.6 — persistent storage beyond PostgreSQL: product-dependent, open.
6. C.7 — egress requirements: product-dependent, open.
