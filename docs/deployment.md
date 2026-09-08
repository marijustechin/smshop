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
