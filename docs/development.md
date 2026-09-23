# Development

Status: **implemented (foundation).**

## Accepted decisions

- Node.js baseline: **Node.js 24.x LTS**. Pinned by root `.nvmrc` (`24`) and
  `engines.node` (`>=24 <25`); do not widen to a newer major to match a local
  host.
- Package manager: pnpm, with a workspace monorepo.
- Layout: `apps/web` (Next.js), `apps/api` (NestJS), `packages/db` (Prisma).
- API source layout: NestJS application modules live under
  `apps/api/src/modules/<module-name>/` (see `docs/architecture.md`);
  cross-cutting configuration may stay in `apps/api/src/config/`.
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

Run these from the repository root. Node.js 24 (`nvm use`), pnpm, and Docker are
required.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create the local environment files from the committed examples:

   | File                  | Required     | Purpose                                                       |
   | --------------------- | ------------ | ------------------------------------------------------------- |
   | `.env`                | recommended  | Compose values for `pnpm db:up` (defaults match the examples) |
   | `packages/db/.env`    | optional     | Prisma CLI datasource (migrations also read the files below)  |
   | `apps/api/.env`       | **required** | API runtime config; startup validation fails without it       |
   | `apps/web/.env.local` | optional     | Browser API origin; dev falls back to `http://localhost:3100` |

   For local migrations, `prisma migrate` resolves `DATABASE_URL` (or the
   `DB_*` group) from `packages/db/.env`, the repository-root `.env`, then
   `apps/api/.env` (first value wins; the process environment always wins). So
   copying `apps/api/.env` is enough to run `pnpm prisma:migrate:deploy`; copying
   `packages/db/.env` is optional and only makes the connection explicit.

   ```sh
   cp .env.example .env
   cp packages/db/.env.example packages/db/.env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Set the required API values in `apps/api/.env`:

   | Variable            | Local value                                        | Notes                                     |
   | ------------------- | -------------------------------------------------- | ----------------------------------------- |
   | `DATABASE_URL`      | `postgresql://smshop:smshop@localhost:5432/smshop` | Matches the Compose `db` service          |
   | `PORT`              | `3100`                                             | Local API port (container port is `3001`) |
   | `WEB_ORIGIN`        | `http://localhost:3101`                            | Next.js dev origin (CORS + email links)   |
   | `JWT_ACCESS_SECRET` | random string, at least 32 characters              | Local-only; never reuse or commit         |

   Local ports are intentionally different from the production/container ports
   (`3000`/`3001`, set by infrastructure Compose) so a local dev server never
   collides with a container. The web dev server runs on `3101`; the API on
   `3100`; `NEXT_PUBLIC_API_BASE_URL` points at `http://localhost:3100`.

   Generate a local access secret (never a shared or production value):

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   SMTP, Google, Turnstile, and `API_ORIGIN` are optional and disabled when unset.
   The full variable contract is in `docs/configuration.md`.

   **Turnstile works in local dev out of the box:** the examples already contain
   Cloudflare's official always-pass **test** pair (sitekey
   `1x00000000000000000000AA` in `apps/web/.env.local`, secret
   `1x0000000000000000000000000000000AA` in `apps/api/.env`). They work on
   `localhost` without real challenges and are **test-only** — never use them in
   staging/production. If the API secret is set but the web site key is missing,
   the widget never renders and registration fails with the Turnstile error;
   `pnpm dev` preflights this mismatch.

4. Start PostgreSQL and apply migrations:

   ```sh
   pnpm db:up                  # local PostgreSQL 18 in Docker
   pnpm prisma:migrate:deploy  # apply existing migrations
   ```

5. Start both applications:

   ```sh
   pnpm dev                    # preflight, build @smshop/db, then web + api
   ```

### Grant your first administrator

The administration area is available only to the `admin` role, so the first
administrator must be bootstrapped once from an existing account:

1. Register an account through `/registracija` and verify its email address.
2. Add `AUTH_INITIAL_ADMIN_EMAIL=<that address>` to `apps/api/.env`.
3. Restart the API. On startup it promotes that existing, verified account to
   `admin` and logs `Promoted the configured initial administrator account`.
4. Sign in and open `/administravimas` (the Users section lives at
   `/administravimas/naudotojai`).
5. Remove `AUTH_INITIAL_ADMIN_EMAIL` from `apps/api/.env`; the promotion is
   already applied.

The bootstrap never creates a user, is idempotent, and does not log the address.
The first registered account is **never** made an administrator automatically.
See `docs/configuration.md` for the variable contract.

### If the API does not start

`pnpm dev` runs `scripts/check-dev-env.mjs` **before** it builds or starts
anything, so a missing or invalid API environment stops the command up front
rather than leaving the web server running alone:

```text
The API environment is incomplete (apps/api/.env).
Required for `pnpm dev`:
  - WEB_ORIGIN (expected http://localhost:3101)
  - PORT (expected 3100)
  - JWT_ACCESS_SECRET (at least 32 characters)
...
```

Add the missing variables to `apps/api/.env`, or re-copy
`apps/api/.env.example`. A `.env` created before a new required variable was
introduced keeps old values but fails current startup validation; re-copy or
merge the new names. The API itself also validates at startup
(`validateEnv`), which remains the authority; the preflight only makes the
failure impossible to miss. The preflight never prints secret values.

Without this, `pnpm --parallel` runs web and API together: the API exits during
validation while the web dev server continues, and the error can scroll past
unnoticed.

### If registration fails with the Turnstile message

`Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.` means the API
enforces Turnstile (a `TURNSTILE_SECRET_KEY` is set) but the browser did not send
a valid challenge token. In local development the usual causes are:

- `apps/web/.env.local` is missing, so `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset
  and the widget never renders → `403 TURNSTILE_REQUIRED`;
- the API and web keys are mismatched (for example a real secret with the test
  sitekey, or the test secret with a real sitekey).

Fix by re-copying the examples (`cp apps/web/.env.example apps/web/.env.local`)
and/or using the always-pass test pair above; restart `pnpm dev` afterward,
because `next dev` reads `NEXT_PUBLIC_*` only at start. `pnpm dev` preflights the
missing-sitekey and test/non-test mismatch cases.

Note: the always-pass test secret accepts **any** token by design, so it cannot
demonstrate invalid-token rejection. Use a real secret, or Cloudflare's
always-fail test secret `2x0000000000000000000000000000000AA`, to exercise
`403 TURNSTILE_FAILED`.

## Commands (implemented)

| Command                               | Purpose                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | preflight API env, build `@smshop/db`, then run web + api on the host                                     |
| `pnpm check:dev-env`                  | check `apps/api/.env` for the required local values (no output = ok)                                      |
| `pnpm build`                          | production builds (db → api → web)                                                                        |
| `pnpm lint`                           | ESLint across packages                                                                                    |
| `pnpm format` / `pnpm format:check`   | Prettier write / check                                                                                    |
| `pnpm typecheck`                      | type-check all packages                                                                                   |
| `pnpm test`                           | run the test suite (Vitest; see `docs/testing.md`)                                                        |
| `pnpm verify`                         | full local verification gate (format, lint, typecheck, test, build)                                       |
| `pnpm verify:db`                      | `verify` plus database-backed tests (starts the test DB)                                                  |
| `pnpm db:test:up` / `db:test:down`    | start/stop the isolated test database (Compose project `smshop-test`; teardown removes only test volumes) |
| `pnpm db:test:migrate` / `:reset`     | apply / reset migrations on the test database                                                             |
| `pnpm test:db`                        | run database-backed integration tests                                                                     |
| `pnpm db:up` / `pnpm db:down`         | start/stop the local PostgreSQL Compose                                                                   |
| `pnpm prisma:generate`                | generate the Prisma client                                                                                |
| `pnpm prisma:migrate:dev` / `:deploy` | create/apply / deploy migrations                                                                          |

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
