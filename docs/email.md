# Email

Status: **implemented (infrastructure A-003; consumed by A-004/A-006).**
Provider-independent transactional email infrastructure used by email
verification/resend and password recovery. Real SMTP is not configured on
staging yet (see "Staging enablement" below).

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

## Staging enablement (external requirements)

Email is **implemented application-side**; the staging deployment simply has no
SMTP configured, so `readSmtpConfig` returns `null` and every send fails with
`MailNotConfiguredError`. Registration therefore commits the account and returns
`verificationEmailSent: false` (the UI offers resend), and resend /
forgot-password log a warning but never reveal delivery state. This is a
configuration gap, not a product or code gap: verification and password recovery
remain required and are never weakened or hidden because SMTP is unset.

To send real staging email, the following must be provided/approved **outside
this repository**. No credential is invented or committed here.

**Application-side contract (already implemented — nothing to change in code):**

| Variable / file      | Kind            | Notes                                                   |
| -------------------- | --------------- | ------------------------------------------------------- |
| `SMTP_HOST`          | nonsecret       | Provider SMTP hostname                                  |
| `SMTP_PORT`          | nonsecret       | Provider SMTP port                                      |
| `SMTP_SECURE`        | nonsecret       | Explicit `"true"` (implicit TLS, e.g. 465) or `"false"` |
| `SMTP_USER`          | nonsecret       | Provider SMTP username                                  |
| `SMTP_PASSWORD_FILE` | **secret file** | Mounted for the `api` service; read as `SMTP_PASSWORD`  |
| `MAIL_FROM`          | nonsecret       | Sender, e.g. `Šokolado meistrai <noreply@…>`            |

The group is all-or-none: if any value is present, all are required, and the API
fails fast at startup otherwise. `SMTP_SECURE` is never inferred from the port.

**Infrastructure-side requirements (`sm-oracle-infra`, requires human approval):**

1. **Provider + credentials.** A sending provider and its SMTP credentials must
   be chosen and supplied by the human administrator. Choosing/paying for an
   external provider is a human decision; the application code is
   provider-independent.
2. **Secret delivery.** A root-managed `smtp_password` file under
   `/etc/sokoladas-staging/secrets/`, owned by app UID `10001` mode `0400`, and
   mounted into `api` as `SMTP_PASSWORD_FILE` alongside the `SMTP_*`/`MAIL_FROM`
   environment values (same model as `jwt_access_secret`).
3. **API egress.** The accepted architecture gives the API **no initial outbound
   Internet access** (`app`/`db` are internal Docker networks). SMTP requires the
   API to reach the provider's SMTP host, so an approved, dedicated egress path
   must be added for the `api` service (or another explicitly approved network
   design). This is the contract's C.2.6 egress field and is not yet implemented.
4. **DNS / SPF / DKIM.** The `MAIL_FROM` domain must be authorized by the chosen
   provider (verified sending domain) with the provider's required SPF/DKIM (and
   any DMARC) records added to DNS. Exact records are provider-specific and must
   come from the human administrator.

Until 1–4 are provided and a redeploy is authorized, staging email cannot be
end-to-end verified; the application-side behaviour is fully covered by tests
with a stubbed transport.

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
