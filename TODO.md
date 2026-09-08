# TODO

Unfinished, actionable work only. Completed work belongs in Git history /
CHANGELOG, not as closed TODO sections here.

## Open during implementation (do not block feature work)

- [ ] Contract C.3 — production environment variable names and DB connection
      layout. Dev defaults are `DATABASE_URL` and `PORT`; production values stay
      open (coordinate with `sm-oracle-infra`).
- [ ] Contract C.4 — file-based secret names and file-reading support;
      coordinate with `sm-oracle-infra`.
- [ ] Contract C.1 — production image digests (resolved at build time).
- [ ] Finalize the migration runtime command inside the API image (foundation
      confirms `prisma migrate deploy`; the exact wrapper command is an
      implementation detail until the API image is finalized).

## Blocked on environment (this dev host)

- [ ] Validate PostgreSQL dev startup via `docker compose` — Docker daemon is
      unavailable on this Intel macOS 14.8.7 host (colima/lima qemu driver
      panics). This is an environment-specific verification blocker, not a
      change to the accepted PostgreSQL-via-Docker-Compose model.
- [ ] Build the `docker/*.Dockerfile` images for `linux/arm64` and verify the
      runtime contract (foreground, UID 10001:10001, SIGTERM) once a Docker
      host is available.

## Product-dependent (open until business requirements exist)

- [ ] Contract C.6 — persistent storage beyond PostgreSQL (media/uploads).
- [ ] Contract C.7 — outbound egress (payments, email, APIs).

## Later

- [ ] Add Playwright for browser E2E when real user flows exist (not installed
      now).
- [ ] Add Vitest to `packages/db` once it has testable code (currently only a
      Prisma client re-export).
- [ ] Revisit Prisma major (7+) and driver adapters when the schema grows;
      foundation pins Prisma 6 for the classic `url = env("DATABASE_URL")` +
      `prisma migrate deploy` model.
