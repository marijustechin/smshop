# A-003 — Establish Email Infrastructure

## Status

DONE

## Objective

Implement provider-agnostic transactional email infrastructure for Auth v1:
a configuration-driven SMTP transport behind a `MailTransport` boundary and a
`MailService` application API. No verification business flow yet.

## Context

A-002 added registration. A-004 will send email verification, so a provider
independent SMTP layer is needed. Development uses Resend SMTP; production will
use a different SMTP provider. The transport must be configuration-driven with
no provider-specific code.

## Dependencies

H-000–H-009; A-001; A-002.

## Scope

1. Create this task and mark it current.
2. Extend the env contract: `SMTP_SECURE` explicit boolean parsing, all-or-none
   SMTP activation semantics, `*_FILE` secret support, formatted `MAIL_FROM`.
3. Create `apps/api/src/modules/mail/` (`MailService`, `MailTransport`,
   `SmtpMailTransport`).
4. Register `MailModule` in `AppModule` (not wired into Auth yet).
5. Add unit tests (no real SMTP) and an opt-in `pnpm mail:smoke` command.
6. Update `apps/api/.env.example` (placeholders only) and docs.
7. Complete the lifecycle; A-004 stays next, unstarted.

## Out of Scope

Verification tokens/emails, registration changes, password reset, login, JWT,
Google OAuth, frontend pages, Oracle/SMTP production config, commit, push.

## Acceptance Criteria

- [x] `src/modules/mail/` exists
- [x] MailService is provider-independent
- [x] SMTP transport implementation exists
- [x] no Resend-specific application code exists
- [x] SMTP config is environment-driven
- [x] `SMTP_SECURE` is validated explicitly
- [x] partial SMTP config fails safely
- [x] SMTP secrets remain protected
- [x] generic text/html sending works
- [x] unit tests exist
- [x] normal CI does not depend on external SMTP
- [x] manual SMTP smoke mechanism exists
- [x] one local real SMTP smoke test run (connection/auth OK; provider rejected
      unverified sender domain — reported, not an app defect)
- [x] `.env.example` contains placeholders only
- [x] documentation explains provider independence
- [x] `pnpm verify` passes
- [x] `pnpm verify:db` passes

## Required Verification

```bash
nvm use
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:db
git diff --check
git status --short
```

Plus the explicit local SMTP smoke test if valid local configuration exists.

## Implementation Result

- Added `apps/api/src/modules/mail/`: `mail.service.ts` (`MailService`),
  `mail.transport.ts` (boundary + `MAIL_TRANSPORT` token + sanitized errors),
  `smtp-mail.transport.ts` (`SmtpMailTransport`, `createSmtpTransporter`),
  `mail.config.ts` (`readSmtpConfig`, `SMTP_CONFIG`), `mail.module.ts`.
- Registered `MailModule` in `AppModule`; not injected into Auth.
- Extended `env.validation.ts`: `SMTP_SECURE` explicit boolean parsing,
  all-or-none SMTP group via `superRefine`, formatted `MAIL_FROM` sender
  validation, empty-string-as-unset normalization, `SMTP_PASSWORD_FILE` support
  (already generic via `SECRET_KEYS`).
- Added unit tests: `mail.service.spec.ts`, `smtp-mail.transport.spec.ts`, and
  SMTP cases in `env.validation.spec.ts`.
- Added opt-in `pnpm mail:smoke -- <recipient>` (`apps/api/scripts/mail-smoke.mjs`,
  `apps/api/package.json`, root `package.json`), excluded from `verify`/CI.
- Updated `apps/api/.env.example` (placeholders only) and added `docs/email.md`;
  linked from `README.md`; SMTP rows in `docs/configuration.md`.
- Added `nodemailer@10.0.9`.

## Verification Result

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm verify` → exit 0 (API 7 files / 39 tests, web 1 test, builds).
- `pnpm verify:db` → exit 0 (migration applied, 32 DB tests).
- Mail-disabled startup confirmed: built API boots with no SMTP config
  (`MailModule dependencies initialized`), so CI/tests need no SMTP.
- `git diff --check` → exit 0; `git status --short` → intended files only.
- Real SMTP smoke (`pnpm mail:smoke`): connection and authentication
  **succeeded**, but the provider rejected the message at `DATA` with
  `550 The sokoladas.eu domain is not verified. Please, add and verify your
domain on <provider>/domains`. This is a provider-account/domain issue (the
  sender domain is not verified at the current SMTP provider), not an
  application defect; per the task, no architecture/provider change was made.

## Decisions

- **Library:** `nodemailer@10.0.9` — current stable, ESM-first (`"type":
"module"`, import/require exports), Node >=20, ships its own types (no
  `@types/nodemailer` needed), provider-independent. No provider SDK.
- **Activation semantics:** all-or-none SMTP group. If any SMTP variable is set,
  all are required; none set means mail is disabled and startup succeeds. This
  makes partial configuration fail fast while keeping CI/tests credential-free.
- **Empty-as-unset:** empty-string variables are stripped before validation, so
  `.env` placeholders like `SMTP_HOST=` do not count as configured and
  `MAIL_FROM=` no longer blocks (also resolves the earlier H-005 empty-value
  exposure).
- **Sender:** `MAIL_FROM` accepts a bare address or `Name <addr>`; header
  injection characters are rejected.
- **Timeouts:** connection/greeting 10s, socket 30s; not configurable yet.
- **Errors:** `MailSendError` exposes only `Failed to send email`; the original
  error is attached as `cause`. `MailNotConfiguredError` is thrown when mail is
  used without configuration.
- Unrelated: `apps/api/tsconfig.json` (`baseUrl` removal) appeared in the working
  tree during this task but was not part of A-003 and was left untouched.

## Follow-ups

- A-004 — Email verification (uses `MailService`).
- Provider account: verify/authorize the sender domain at the SMTP provider
  (development account) to make the real smoke test pass; configuration only.
- Consider configurable SMTP timeouts only if a concrete need appears.
- `docker/api.Dockerfile` images remain unverified by an actual build
  (pre-existing).

## Completion

Completed date: 2026-09-13
Commit: not committed (pending explicit request)
