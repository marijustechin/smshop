# H-008 — Align Backend Stack with the Project Technology Baseline

## Status

DONE

## Objective

Align the backend implementation and documentation with the accepted technology
philosophy before Auth v1: NestJS 11 + Fastify, Prisma 7, PostgreSQL, current
stable compatible TypeScript, ESM-first configuration, Node 24 LTS, pnpm
monorepo. Remove contradictions between `AGENTS.md`, docs, manifests, and code.

## Context

The audit found legacy-oriented choices: Express adapter, Prisma 6, CommonJS, and
docs pinning those. `AGENTS.md` now prefers Prisma 7 and ESM-first. The project is
still greenfield, so this is the right time to resolve it.

## Dependencies

H-000–H-007 complete; technology-selection philosophy in `AGENTS.md`.

## Scope

1. Create this task and mark it current.
2. Reconcile the `AGENTS.md` "stack is fixed" rule with version currency.
3. Migrate NestJS Express → Fastify.
4. Upgrade Prisma 6 → stable Prisma 7 and adopt its config/driver-adapter model.
5. Move backend/shared config to ESM-first.
6. Review TypeScript version and document the decision.
7. Preserve behaviour (startup, readiness, shutdown, Prisma, tests, build).
8. Keep the H-006 test DB lifecycle working.
9. Review Docker API/Web images against the aligned stack.
10. Align documentation and dependency hygiene.
11. Update tests where required (no Auth tests).
12. Complete the lifecycle; A-001 stays next, unstarted.

## Out of Scope

Auth models/migrations/registration/login/JWT/refresh/password hashing/email/
OAuth, Oracle deployment, live infrastructure, product-domain changes, commit,
push.

## Acceptance Criteria

- [x] NestJS uses Fastify, not Express
- [x] Express platform dependencies removed where no longer needed
- [x] Prisma 7 installed and functioning
- [x] Prisma configuration follows supported Prisma 7 patterns
- [x] backend/shared configuration is ESM-first where compatible
- [x] TypeScript version reviewed and current/stable/compatible
- [x] existing API behaviour preserved
- [x] test DB lifecycle works
- [x] Prisma migrations work
- [x] `pnpm verify` passes
- [x] `pnpm verify:db` passes
- [x] CI-compatible verification passes locally
- [x] docs and AGENTS no longer contradict actual stack
- [x] A-001 remains unstarted

## Required Verification

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:db
pnpm verify:ci
git diff --check
git status --short
```

Report node/pnpm versions, NestJS platform adapter, Prisma version, TypeScript
version, and module system.

## Implementation Result

- **Fastify:** replaced `@nestjs/platform-express` + `@types/express` with
  `@nestjs/platform-fastify@^11.2.3`; `main.ts` now uses
  `FastifyAdapter`/`NestFastifyApplication`; the HTTP e2e test builds a Fastify
  app and awaits `ready()`.
- **Prisma 7:** upgraded `prisma`/`@prisma/client` to `7.10.0` and added
  `@prisma/adapter-pg@7.10.0`; switched the generator to `prisma-client`
  (`moduleFormat = "esm"`, `importFileExtension = "js"`, output
  `src/generated/prisma`); added `packages/db/prisma7.config.ts`; `PrismaService`
  and the test helper now construct the client with the `PrismaPg` adapter;
  `createPrismaClient(connectionString)` is exported from `@smshop/db`.
- **ESM-first:** `"type": "module"` on `apps/api` and `packages/db`;
  `tsconfig.base.json` and `apps/api/tsconfig.json` moved to `module`/
  `moduleResolution: nodenext`, `target: ES2023`; relative imports given `.js`
  extensions; `@smshop/db` exposes `exports`.
- **TypeScript:** kept `5.9.3` (newest stable 5.x); documented the compatibility
  reason (NestJS 11 decorator metadata + `@prisma/client` 7 require
  `typescript >=5.4.0`; TS 6/7 adoption deferred).
- **Docker:** rewrote `docker/api.Dockerfile` runner to a correct pnpm-workspace
  ESM layout (root store, `apps/api/node_modules`, `apps/api/package.json` for
  ESM, built `apps/api/dist`, built `@smshop/db`), and made the deps stage a full
  workspace install so `prisma generate` works.
- **Docs/AGENTS:** reconciled the fixed-stack rule with version currency;
  updated `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/development.md`,
  `tasks/TODO.md`.
- **Dependencies:** removed Express platform packages; lockfile regenerated with
  `pnpm install` and verified with `--frozen-lockfile`.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0 (lockfile up to date).
- `pnpm verify` → exit 0 (API 4 files / 21 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0 (test DB healthy, Prisma 7 migrate, verify, 4 DB tests).
- `pnpm verify:ci` → exit 0 (migrate + verify + DB tests against the local test DB;
  CI uses the equivalent ephemeral service).
- `git diff --check` → exit 0; `git status --short` → intended files only, no
  artifacts/credentials.
- Runtime: API boots under Node 24 with Fastify + ESM; `/api`, `/health/ready`
  routes mapped; graceful shutdown hook preserved.
- Diagnostics: node v24.20.0 (pinned), pnpm 12.3.4, `@nestjs/platform-fastify`
  11.2.3, Prisma 7.10.0, TypeScript 5.9.3, ESM (`"type":"module"` + `nodenext`).

## Decisions

- **Fastify** replaces Express per the accepted architecture; peer compatibility
  kept at NestJS 11 (`@nestjs/platform-fastify@11.2.3`, not the Nest 12 line).
- **Prisma 7.10.0**, not the Prisma 8 release candidate (philosophy forbids RC).
- **Prisma generator/config:** new `prisma-client` generator with ESM output and
  `prisma7.config.ts`, matching Prisma 7's supported model.
- **ESM-first** applied to `apps/api` and `packages/db`; `apps/web` keeps the
  Next.js-managed module configuration (Next handles this itself).
- **TypeScript 5.9.3** retained with a documented compatibility reason.
- `@nestjs/platform-express` remains in the lockfile only as an auto-installed
  optional peer of `@nestjs/core`/`@nestjs/testing`; it is not linked into
  `apps/api` and is not resolvable from application code.

## Follow-ups

- `docker/web.Dockerfile` still copies a `public/` directory that does not exist
  (pre-existing feasibility-draft issue, unrelated to the backend stack change);
  fix when the web image is finalized.
- API and web Docker images remain unverified by an actual build (no image build
  in the verify gate/CI yet).
- TypeScript 6/7 adoption deferred pending NestJS 11 decorator-metadata support.
- Next application task: A-001 — Authentication domain model (not started).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
