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

| Category        | Variable                         | Required now | Secret | Notes                                               |
| --------------- | -------------------------------- | ------------ | ------ | --------------------------------------------------- |
| Application     | `NODE_ENV`                       | no (default) | no     | `development` \| `test` \| `production`             |
| Application     | `PORT`                           | no (default) | no     | Defaults to `3001`                                  |
| Database        | `DATABASE_URL`                   | **yes\***    | yes    | `postgres://` or `postgresql://`; no fallback       |
| Database        | `DB_HOST` / `DB_PORT`            | **yes\***    | no     | Alternative to `DATABASE_URL`; port defaults `5432` |
| Database        | `DB_NAME` / `DB_USER`            | **yes\***    | no     | Alternative to `DATABASE_URL`                       |
| Database        | `DB_PASSWORD`                    | **yes\***    | yes    | Supports `DB_PASSWORD_FILE`                         |
| Origins         | `WEB_ORIGIN`                     | **yes**      | no     | Browser origin; CORS with credentials + email links |
| Origins         | `API_ORIGIN`                     | reserved     | no     | Public API origin; email links / callbacks          |
| Access token    | `JWT_ACCESS_SECRET`              | **yes**      | yes    | Min 32 chars; signs access JWTs                     |
| Access token    | `JWT_ACCESS_TTL`                 | no (default) | no     | Access-token lifetime; default `15m`                |
| Refresh/session | `AUTH_SESSION_TTL`               | no (default) | no     | Refresh-session lifetime; default `7d`              |
| Email           | `SMTP_HOST`                      | grouped      | no     | SMTP group is all-or-none (see below)               |
| Email           | `SMTP_PORT`                      | grouped      | no     | 1–65535; requires the whole SMTP block              |
| Email           | `SMTP_SECURE`                    | grouped      | no     | Explicit `"true"`/`"false"`; not inferred by port   |
| Email           | `SMTP_USER`                      | grouped      | no     |                                                     |
| Email           | `SMTP_PASSWORD`                  | grouped      | yes    | Supports `SMTP_PASSWORD_FILE`                       |
| Email           | `MAIL_FROM`                      | grouped      | no     | Bare email or `Name <email>` sender                 |
| Google OAuth    | `GOOGLE_CLIENT_ID`               | grouped      | no     | Google group is all-or-none; disabled when absent   |
| Google OAuth    | `GOOGLE_CLIENT_SECRET`           | grouped      | yes    | Supports `GOOGLE_CLIENT_SECRET_FILE`                |
| Google OAuth    | `GOOGLE_CALLBACK_URL`            | grouped      | no     | Must equal the Google Authorized redirect URI       |
| Turnstile       | `TURNSTILE_SECRET_KEY`           | optional     | yes    | Backend secret; absent disables Turnstile. `_FILE`  |
| Turnstile       | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional     | no     | Frontend (public) site key; absent hides the widget |

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
- **Turnstile (optional, backend secret):** `TURNSTILE_SECRET_KEY` (supports
  `TURNSTILE_SECRET_KEY_FILE`). When absent, Turnstile is disabled and the public
  auth endpoints accept requests without a challenge (local dev / CI need no
  secret). When present, `register`, `login`, `forgot-password`, and
  `resend-verification` require a valid challenge and fail closed. The site key
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is public and belongs to the frontend; it must
  never be confused with the secret.
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
