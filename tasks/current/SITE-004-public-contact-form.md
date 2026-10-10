# SITE-004 — Public contact form

## Status

CURRENT — implementation complete and locally verified; staging deployment and
live verification in progress.

## Objective

Add a working public contact form on `/kontaktai` that validates visitor input
server-side, routes each fixed topic to the matching administrator-managed
contact group, and sends the message through the application mail transport.

## Context

SITE-003 introduced the persisted, administrator-managed contact groups
(`administracija`, `uzsakymai`, `e-parduotuve`) with editable emails. This task
makes them the recipients of a public contact form and is the first consumer of
the group's configured email; it reuses the existing mail transport and the
Turnstile/rate-limit security boundaries.

## Dependencies

- SITE-003 (contact groups, public contacts approach).
- Existing `MailModule` / `MailService` and configured `MAIL_FROM` sender.
- Existing `TurnstileGuard`, `TurnstileVerifier`, `RateLimitGuard`,
  `InMemoryRateLimiter` (ADM-001/A-009 infrastructure).

## Scope

- Public form on `/kontaktai`, prominent and before the store list, mobile-first
  and using existing form components and chocolate styling.
  - Tema (required select: Bendras klausimas / Užsakymas / El. parduotuvė),
    El. paštas (required), Žinutė (required, ≤ 5000), Vardas (optional, ≤ 100),
    Telefonas (optional, ≤ 50). Optional fields clearly marked.
  - Reuse the centered Turnstile widget; accessible validation, submitting,
    success and failure states; no repeated submissions; values preserved on
    failure and cleared only after success; consumed/expired tokens reset so
    retries work.
- Public `POST /api/public/contact` with strict server-side validation and
  bounded request size.
- Topic → group mapping (general→administration, order→orders, shop→e-shop),
  recipient resolved from the database at submission time; the client never
  supplies a recipient. Missing/invalid recipient fails clearly and sends
  nothing.
- Email delivery via the existing transport: From = configured sender, To = the
  group's email, Reply-To = the visitor's validated email, fixed Lithuanian
  subject prefix + topic, plain-text body. Success returned only after the
  transport accepts; failures return a useful Lithuanian message without
  provider detail. Visitor text is never used as mail headers, and message
  bodies / visitor addresses / Turnstile tokens are never persisted or logged.
- Abuse protection: server-side Turnstile through the existing verifier (no
  staging bypass) and an endpoint-specific rate limit using the existing
  limiter.
- Regression tests (web + DB-backed API) and documentation.

## Out of Scope

- Attachments and any automatic confirmation email to the visitor.
- A second contact-form recipient field.
- Changes to catalogue, stores, footer styling, authentication, Turnstile
  behaviour, or deployment permissions.
- Changing `trustProxy` (the per-client-IP limitation behind the proxy remains
  the documented infrastructure follow-up).
- Storing message bodies or adding a message database model.

## Acceptance Criteria

- [x] Form with the specified fields, optional-field labels, required topic
      select, and the shared centered Turnstile.
- [x] Accessible validation/submitting/success/failure states; repeated clicks
      prevented; values preserved on failure; form cleared after success;
      Turnstile token reset for retries.
- [x] `POST /api/public/contact` with strict validation and bounded size.
- [x] Fixed topic→group mapping; recipient resolved from the database at
      submission time; missing/invalid recipient fails without sending.
- [x] Correct From/To/Reply-To/subject/body; success only after transport
      acceptance; sanitized failure messages; no persistence/logging of bodies,
      addresses or tokens.
- [x] Server-side Turnstile via the existing verifier (no bypass) and an
      endpoint-specific rate limit.
- [x] Focused tests cover routing/DB lookup, invalid payload rejection, missing
      recipient, Turnstile missing/invalid/expired, rate limiting, From/To/
      Reply-To, transport failure, and form states.
- [x] `pnpm verify` and `pnpm verify:db` (DB-backed) pass.
- [ ] Staging CI/CD deployed; the deployed endpoint and form verified; the real
      delivery check handled per the task's owner authorization (or reported as an
      owner action).
- [ ] State reconciliation performed.

## Required Verification

- `pnpm verify` (format, lint, typecheck, unit/web tests, build).
- `pnpm verify:db` / `pnpm test:db` (DB-backed API tests).
- Focused suites: `apps/api/test/database/contact-form.db-spec.ts`,
  `apps/api/src/modules/mail/smtp-mail.transport.spec.ts`,
  `apps/web/src/features/contacts/ui/contact-form.test.tsx`,
  `apps/web/src/app/(public)/kontaktai/page.test.tsx`.
- Visual: the form on desktop and mobile.
- Live: `POST /api/public/contact` deployed; recipient mapping; a single,
  clearly labelled real delivery to the owner-authorized address if achievable
  (otherwise reported as an owner action).

## Implementation Result

- API: `modules/contact-form` — `ContactFormController`
  (`POST /api/public/contact`, `@RateLimit` + `TurnstileGuard`),
  `ContactFormService` (DB recipient lookup, plain-text body, mail send),
  strict zod DTO, topic map, and 503/502 domain exceptions. Registered in
  `AppModule`.
- Mail: added `replyTo` to `MailMessage` and passed it in `SmtpMailTransport`.
- Web: `shared/ui/textarea.tsx`; `features/contacts` topic model, contact-form
  API wrapper, and `ContactForm` component; `ContactsContent` renders the form
  before the store list.

## Verification Result

### Repository implementation (local gates)

- `pnpm verify` exit 0 (format, lint, typecheck, web + api unit tests, build);
  the `/kontaktai` route builds with the form.
- `pnpm test:db` exit 0: 15 DB spec files, 216 tests, including the new
  `contact-form.db-spec.ts` (13 tests: routing/DB lookup, invalid payloads,
  missing recipient, Turnstile outcomes, rate limit, transport failure).
- Focused web suite (`contact-form.test.tsx`, `kontaktai/page.test.tsx`) passes.

Deployment and live verification results are recorded below once the staging
deployment completes.

## Decisions

- Reuse the existing `MailService`/SMTP transport and `MAIL_FROM`; add only a
  `replyTo` field to the provider-neutral `MailMessage`.
- Recipient is resolved from `ContactGroup` at submission time; the client never
  sends an address. Missing/invalid recipient → 503 `CONTACT_UNAVAILABLE`;
  transport failure → 502 `CONTACT_SEND_FAILED`; nothing is sent on either.
- Rate-limit policy: `contact-form` = 5 requests / 10 minutes, via the existing
  in-memory `InMemoryRateLimiter`. State is per-process only and resets on API
  restart. Behind the staging reverse proxy, Fastify `trustProxy` is `false`, so
  the limiter keys on the proxy address (effectively a shared bucket) until the
  documented infrastructure `trustProxy` follow-up is resolved; client-supplied
  forwarded headers are not trusted.
- Request size is bounded by the strict field maxima (message ≤ 5000 characters)
  plus Fastify's default JSON body limit; no new dependency or global limit
  change.
- Visitor input is plain-text body content only; the subject is fixed and
  server-controlled.

## Follow-ups

- Attachments and a visitor confirmation email (explicitly out of scope).
- Configure `trustProxy` for the known proxy hops so rate limits apply per real
  client IP (pre-existing infrastructure follow-up, also affects auth limits).
- Optional backfill of a `tasks/done/` record for earlier catalogue/media work
  remains outstanding (pre-existing).

## State Reconciliation

Filled when completed.

## Completion

Completed date:
Commit:
