# Configuration

Status: **implemented (Harness baseline).** The API validates its environment at
startup and fails fast on invalid required configuration. Auth-related names are
declared now but stay optional until their consuming features land.

## Where configuration comes from

| Environment | Source                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| Development | `apps/api/.env` (copied from `apps/api/.env.example`), gitignored         |
| CI          | `process.env` set by the workflow; tests use a non-secret local value     |
| Production  | Environment variables and/or `<NAME>_FILE` secret files provided by infra |

`ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` loads the env
file and merges it with `process.env`, then runs validation. Validation runs
before the application becomes ready, so an invalid configuration prevents
startup.

## Local development minimum

The API validates its environment at startup and exits if a required value is
missing, so a fresh clone must create `apps/api/.env` from
`apps/api/.env.example` before `pnpm dev` can start the API. The local minimum
is:

| Variable            | Local value                                        | Notes                                   |
| ------------------- | -------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`      | `postgresql://smshop:smshop@localhost:5432/smshop` | Matches the Compose `db` service        |
| `PORT`              | `3100`                                             | Local API port (container port is 3001) |
| `WEB_ORIGIN`        | `http://localhost:3101`                            | Next.js dev origin (CORS + email links) |
| `JWT_ACCESS_SECRET` | random string, at least 32 characters              | Secret; local-only, never committed     |

Generate a local access secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

`NODE_ENV`, `JWT_ACCESS_TTL`, and `AUTH_SESSION_TTL` have development defaults.
`PORT` has a schema default of `3001` (the production/container contract), so
local development sets `PORT=3100` explicitly. SMTP, Google, Turnstile,
`AUTH_INITIAL_ADMIN_EMAIL`, and `API_ORIGIN` are optional and disabled when
unset. A `.env` created before a new required variable was introduced will
fail current startup validation: re-copy or merge the new names from
`apps/api/.env.example`. `pnpm dev` runs a preflight
(`scripts/check-dev-env.mjs`) that reports missing names before either server
starts. The committed example is itself validated by
`env.validation.spec.ts`, so it cannot silently drift from the schema.

## Validation

The single configuration boundary is
`apps/api/src/config/env.validation.ts`:

- an explicit Zod schema (`envSchema`) defines the contract;
- `validateEnv` resolves file-based secrets and parses the environment;
- failures throw `Invalid environment configuration:` with one line per invalid
  variable;
- error messages contain variable **names** and validation messages only — never
  values, and resolved secret values are scrubbed defensively.

Application modules must read configuration through `ConfigService`, not by
scattering `process.env` access.

## Environment contract

`Required now` means the current scaffold cannot start without it. `Reserved`
means the name is part of the contract but becomes mandatory only when its
consumer (Auth v1) is implemented; it is validated only when present.

| Category        | Variable                         | Required now | Secret | Notes                                                                                |
| --------------- | -------------------------------- | ------------ | ------ | ------------------------------------------------------------------------------------ |
| Application     | `NODE_ENV`                       | no (default) | no     | `development` \| `test` \| `production`                                              |
| Application     | `PORT`                           | no (default) | no     | Defaults to `3001`                                                                   |
| Database        | `DATABASE_URL`                   | **yes\***    | yes    | `postgres://` or `postgresql://`; no fallback                                        |
| Database        | `DB_HOST` / `DB_PORT`            | **yes\***    | no     | Alternative to `DATABASE_URL`; port defaults `5432`                                  |
| Database        | `DB_NAME` / `DB_USER`            | **yes\***    | no     | Alternative to `DATABASE_URL`                                                        |
| Database        | `DB_PASSWORD`                    | **yes\***    | yes    | Supports `DB_PASSWORD_FILE`                                                          |
| Origins         | `WEB_ORIGIN`                     | **yes**      | no     | Browser origin; CORS with credentials + email links                                  |
| Origins         | `API_ORIGIN`                     | reserved     | no     | Public API origin; email links / callbacks                                           |
| Access token    | `JWT_ACCESS_SECRET`              | **yes**      | yes    | Min 32 chars; signs access JWTs                                                      |
| Access token    | `JWT_ACCESS_TTL`                 | no (default) | no     | Access-token lifetime; default `15m`                                                 |
| Refresh/session | `AUTH_SESSION_TTL`               | no (default) | no     | Refresh-session lifetime; default `7d`                                               |
| Email           | `SMTP_HOST`                      | grouped      | no     | SMTP group is all-or-none (see below)                                                |
| Email           | `SMTP_PORT`                      | grouped      | no     | 1–65535; requires the whole SMTP block                                               |
| Email           | `SMTP_SECURE`                    | grouped      | no     | Explicit `"true"`/`"false"`; not inferred by port                                    |
| Email           | `SMTP_USER`                      | grouped      | no     |                                                                                      |
| Email           | `SMTP_PASSWORD`                  | grouped      | yes    | Supports `SMTP_PASSWORD_FILE`                                                        |
| Email           | `MAIL_FROM`                      | grouped      | no     | Bare email or `Name <email>` sender                                                  |
| Google OAuth    | `GOOGLE_CLIENT_ID`               | grouped      | no     | Google group is all-or-none; disabled when absent                                    |
| Google OAuth    | `GOOGLE_CLIENT_SECRET`           | grouped      | yes    | Supports `GOOGLE_CLIENT_SECRET_FILE`                                                 |
| Google OAuth    | `GOOGLE_CALLBACK_URL`            | grouped      | no     | Must equal the Google Authorized redirect URI                                        |
| Turnstile       | `TURNSTILE_SECRET_KEY`           | optional     | yes    | Backend secret; absent disables Turnstile. `_FILE`; local dev uses the test secret   |
| Turnstile       | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional     | no     | Frontend (public) site key; absent hides the widget; local dev uses the test sitekey |

\* Provide **either** a full `DATABASE_URL` (or `DATABASE_URL_FILE`) **or** the
complete `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` group. An explicit
`DATABASE_URL` always wins. The API assembles the URL in process (URL-encoding
the credentials), which matches the infrastructure secret model where only the
password is mounted as a file; see "Database connection" below.

PostgreSQL Compose values (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`POSTGRES_PORT`) are development-only and consumed by `docker-compose.yml`, not
by the API.

Test-only variables are **not** part of runtime configuration and are never
required at application startup. They are consumed only by the test tooling:

| Variable                 | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `TEST_DATABASE_URL`      | Isolated test database connection (name must end `_test`)  |
| `TEST_POSTGRES_USER`     | Compose `db-test` service user (default `smshop_test`)     |
| `TEST_POSTGRES_PASSWORD` | Compose `db-test` service password                         |
| `TEST_POSTGRES_DB`       | Compose `db-test` service database (default `smshop_test`) |
| `TEST_POSTGRES_PORT`     | Compose `db-test` host port (default `5433`)               |

## Database connection

The API consumes a single PostgreSQL connection URL. It is resolved in this
order:

1. `DATABASE_URL` (direct value); else
2. `DATABASE_URL_FILE` (file contents); else
3. assembled from `DB_HOST`, `DB_PORT` (default `5432`), `DB_NAME`, `DB_USER`,
   and `DB_PASSWORD` (or `DB_PASSWORD_FILE`).

The assembled form URL-encodes the user and password, so credentials containing
reserved characters are handled correctly. A partial component group fails
startup with the missing variable names; a full URL always wins over components.

The Prisma CLI (`prisma migrate deploy`, run from the migration image) uses the
same resolution order (`packages/db/prisma7.config.ts`) so migrations and the
runtime agree. Secret files are read as raw values; one trailing newline is
tolerated.

For local development, the Prisma CLI also loads, in order, `packages/db/.env`,
the repository-root `.env`, and `apps/api/.env` (process environment always
wins; the first file defining a key provides it). Copying any of the documented
env files is therefore enough to run local migrations — a missing
`packages/db/.env` is not an error. In CI/production the connection comes from
the process environment, so no `.env` file is required.

## Required now vs reserved

- **Required now:** a database connection (`DATABASE_URL`/`DATABASE_URL_FILE` or
  the complete `DB_*` component group), `WEB_ORIGIN`, and `JWT_ACCESS_SECRET`.
  `NODE_ENV`, `PORT`, `JWT_ACCESS_TTL` (`15m`), and `AUTH_SESSION_TTL` (`7d`) have
  safe defaults. `JWT_ACCESS_SECRET` is a secret (supports `JWT_ACCESS_SECRET_FILE`).
- **SMTP group (all-or-none):** if any of `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` is set, all of them
  are required and startup fails fast otherwise. If none is set, mail is disabled
  and startup still succeeds — so CI and tests need no SMTP credentials. Empty
  values are treated as unset. `SMTP_SECURE` is parsed explicitly (`"true"` /
  `"false"`); security is never inferred from the port. See `docs/email.md`.
- **Google group (all-or-none):** if any of `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` is set, all are required and
  startup fails fast otherwise. If none is set, Google authentication is disabled
  and startup still succeeds (CI/tests need no Google credentials).
  `GOOGLE_CLIENT_SECRET` supports `GOOGLE_CLIENT_SECRET_FILE`. The callback URL
  must exactly match the Authorized redirect URI registered in Google Cloud. See
  `docs/authentication.md`.
- **Reserved:** `API_ORIGIN`. It is accepted and format-checked today but does not
  block the current application.
- **First administrator bootstrap (optional, one-off):**
  `AUTH_INITIAL_ADMIN_EMAIL`. When set, the API promotes the **already-existing,
  email-verified** user whose normalized email exactly matches this address to
  the `admin` role on startup. It never creates a user, is idempotent (a no-op
  once the account is an admin), and never logs the address. Remove the variable
  from the environment after the first successful use. See
  `docs/development.md` for the local procedure and `docs/authentication.md` for
  the authorization model. Not a secret, so no `_FILE` variant exists.
- **Turnstile (optional, backend secret):** `TURNSTILE_SECRET_KEY` (supports
  `TURNSTILE_SECRET_KEY_FILE`). When absent, Turnstile is disabled and the public
  auth endpoints accept requests without a challenge (CI needs no secret). When
  present, `register`, `login`, `forgot-password`, and `resend-verification`
  require a valid challenge and fail closed. The site key
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is public and belongs to the frontend; it must
  never be confused with the secret.
- **Turnstile site key at image build time:** the production **web** image gets
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` as a Docker build argument supplied by the
  `Images` workflow from the GitHub Actions repository variable
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public, never a secret). The web build fails
  if the variable is unset, so an auth image cannot be published with the widget
  silently disabled. Changing the value requires rebuilding the web image; the
  API image is unaffected.
- **Turnstile in local development:** the committed examples
  (`apps/api/.env.example`, `apps/web/.env.example`) contain Cloudflare's official
  **always-pass TEST** pair — secret `1x0000000000000000000000000000000AA`,
  sitekey `1x00000000000000000000AA`. They work on `localhost` without real
  challenges and are **test-only**: never use them in staging/production, where
  the real secret is supplied as `TURNSTILE_SECRET_KEY_FILE` and the real sitekey
  is inlined into the web image at build time. The API enforces Turnstile only if
  its secret is set, so keeping the pair consistent (test+test or real+real) is
  required; `pnpm dev` preflights this. Note the always-pass test secret accepts
  any token by design, so invalid-token rejection must be verified with a real
  secret or the always-fail test secret (`2x0000000000000000000000000000000AA`),
  not with the always-pass one. Reference:
  <https://developers.cloudflare.com/turnstile/troubleshooting/testing/>.
- **Session lifetime:** `AUTH_SESSION_TTL` controls both the server-side
  `AuthSession` lifetime and the refresh cookie `Max-Age`. Refresh tokens are
  opaque random secrets, so there is no refresh signing secret. See
  `docs/authentication.md`.

## Secrets strategy

Secrets are never committed. The API supports two forms for every secret:

1. a direct environment variable, e.g. `JWT_ACCESS_SECRET=...`;
2. a file-based path, e.g. `JWT_ACCESS_SECRET_FILE=/run/secrets/jwt-access`, whose
   file contents are read at startup. A direct value wins over the file.

This works cleanly with container secret mounts and keeps the same code path for
development, CI, and production. File-based secret resolution is implemented;
the exact production secret file names and mount locations remain an
infrastructure concern (deployment contract field C.4).

- **Development:** direct values in `apps/api/.env`.
- **CI:** no real secrets; tests supply a non-secret `DATABASE_URL` via
  `apps/api/test/setup-env.ts`.
- **Production:** provided by `sm-oracle-infra` as environment variables and/or
  secret files; secrets must not be baked into images or committed.

## Ownership

| Concern                                            | Owner          |
| -------------------------------------------------- | -------------- |
| Variable names in the API contract (this document) | Application    |
| Local `.env.example` / `.env`                      | Application    |
| Production secret values, mounts, and file paths   | Infrastructure |
| PostgreSQL runtime and connection layout in prod   | Infrastructure |

See `docs/architecture.md` for the full application/infrastructure boundary.
