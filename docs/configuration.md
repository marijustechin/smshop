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

| Category        | Variable               | Required now | Secret | Notes                                          |
| --------------- | ---------------------- | ------------ | ------ | ---------------------------------------------- |
| Application     | `NODE_ENV`             | no (default) | no     | `development` \| `test` \| `production`        |
| Application     | `PORT`                 | no (default) | no     | Defaults to `3001`                             |
| Database        | `DATABASE_URL`         | **yes**      | yes    | `postgres://` or `postgresql://`; no fallback  |
| Origins         | `WEB_ORIGIN`           | reserved     | no     | Browser origin; CORS / OAuth redirects / links |
| Origins         | `API_ORIGIN`           | reserved     | no     | Public API origin; email links / callbacks     |
| Access token    | `JWT_ACCESS_SECRET`    | reserved     | yes    | Min 32 chars when present                      |
| Access token    | `JWT_ACCESS_TTL`       | reserved     | no     | e.g. `15m`                                     |
| Refresh/session | `JWT_REFRESH_SECRET`   | reserved     | yes    | Min 32 chars when present                      |
| Refresh/session | `JWT_REFRESH_TTL`      | reserved     | no     | e.g. `30d`                                     |
| Email           | `SMTP_HOST`            | reserved     | no     |                                                |
| Email           | `SMTP_PORT`            | reserved     | no     | 1–65535 when present                           |
| Email           | `SMTP_USER`            | reserved     | no     |                                                |
| Email           | `SMTP_PASSWORD`        | reserved     | yes    |                                                |
| Email           | `MAIL_FROM`            | reserved     | no     | Must be a valid email when present             |
| Google OAuth    | `GOOGLE_CLIENT_ID`     | reserved     | no     |                                                |
| Google OAuth    | `GOOGLE_CLIENT_SECRET` | reserved     | yes    |                                                |
| Google OAuth    | `GOOGLE_CALLBACK_URL`  | reserved     | no     | Valid URL when present                         |

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

## Required now vs reserved

- **Required now:** `DATABASE_URL`. `NODE_ENV` and `PORT` have safe non-secret
  defaults.
- **Reserved for Auth v1:** `WEB_ORIGIN`, `API_ORIGIN`, the `JWT_*`, `SMTP_*`,
  `MAIL_FROM`, and `GOOGLE_*` variables. They are accepted and format-checked
  today but do not block the current scaffold. Promoting one to required is a
  one-line schema change.

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
