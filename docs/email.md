# Email

Status: **implemented (infrastructure, A-003).** Provider-independent
transactional email infrastructure. No verification or password-reset flow is
implemented yet.

## Architecture

```text
MailService          application-facing API (send({ to, subject, text, html }))
    ↓
MailTransport        provider-independent boundary (interface + token)
    ↓
SmtpMailTransport    SMTP implementation (nodemailer)
    ↓
SMTP provider        configured entirely through environment variables
```

- `apps/api/src/modules/mail/mail.service.ts` — `MailService`, the only type the
  rest of the application depends on.
- `apps/api/src/modules/mail/mail.transport.ts` — `MailMessage`, `MailTransport`,
  the `MAIL_TRANSPORT` token, and sanitized error types
  (`MailNotConfiguredError`, `MailSendError`).
- `apps/api/src/modules/mail/smtp-mail.transport.ts` — `SmtpMailTransport` and
  `createSmtpTransporter`.
- `apps/api/src/modules/mail/mail.config.ts` — reads and normalizes SMTP settings.

Auth must send email through `MailService`; it must not import the SMTP library
or reference SMTP concepts directly.

## Configuration

The transport is driven only by configuration. No host, port, sender, or
provider value is hard-coded.

| Variable        | Notes                                                        |
| --------------- | ------------------------------------------------------------ |
| `SMTP_HOST`     | SMTP server hostname                                         |
| `SMTP_PORT`     | SMTP port                                                    |
| `SMTP_SECURE`   | Explicit `"true"` (implicit TLS, e.g. 465) or `"false"`      |
| `SMTP_USER`     | SMTP username                                                |
| `SMTP_PASSWORD` | SMTP password (secret; `SMTP_PASSWORD_FILE` also supported)  |
| `MAIL_FROM`     | Default sender: bare address or `Name <noreply@example.com>` |

The SMTP group is **all-or-none**: if any is set, all are required, and
structural validation rejects partial configuration at startup. If none is set,
mail is disabled and the application still starts (CI and tests need no SMTP).
Empty values are treated as unset. `SMTP_SECURE` is parsed explicitly — security
is never inferred from the port number. See `docs/configuration.md`.

Timeouts: connection and greeting 10s, socket 30s (conservative, not
configurable yet to avoid config proliferation).

## Provider independence

The current development/testing provider is **Resend SMTP**; the future
production provider is the **Šokolado meistrai SMTP** account. Neither is
represented in code — there is no `ResendService`, `ResendTransport`,
`RESEND_API_KEY`, provider hostname, or provider sender domain anywhere in the
application. Switching providers requires **only** changing environment values
(host, port, secure, credentials, sender). Nothing assumes Resend's username
format, port, or sender domain.

## Secrets

`SMTP_PASSWORD` follows the project secret strategy: a direct value or
`SMTP_PASSWORD_FILE` pointing at a secret file (container/mount friendly). A
direct value wins over the file. Credentials are never logged, never included in
validation errors (the error formatter scrubs secret values), and never exposed
by `MailSendError` — only a generic `Failed to send email` message with the
original error attached as an internal `cause`.

## Manual smoke test

Real SMTP is **never** used by `pnpm verify` or CI. Use the opt-in command:

```bash
pnpm mail:smoke -- recipient@example.com
```

It builds the API, loads `apps/api/.env`, and sends one test message through the
real `MailService`/SMTP transport. It prints only success/failure and never
prints credentials. The recipient is passed on the command line and is never
hard-coded.

## Tests

- `apps/api/src/modules/mail/mail.service.spec.ts` — delegation to the transport
  and error propagation.
- `apps/api/src/modules/mail/smtp-mail.transport.spec.ts` — configured sender and
  text/html payload, HTML omission, sanitized send errors (no secrets), and the
  not-configured error.
- `apps/api/src/config/env.validation.spec.ts` — SMTP group completeness,
  explicit `SMTP_SECURE` parsing, empty-as-unset, and sender validation.

No unit test connects to a real SMTP server.
