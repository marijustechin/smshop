# Frontend Authentication

Status: **implemented (A-008).** Lithuanian-only auth UI on top of the backend
auth API (see `docs/authentication.md` for protocol details). The storefront
stays public; authentication is only required for account functionality.

## Routes

| Route                         | Access        | Purpose                                     |
| ----------------------------- | ------------- | ------------------------------------------- |
| `/`                           | public        | Storefront placeholder + dev nav links      |
| `/prisijungti`                | public        | Login, Google entry, OAuth outcome handling |
| `/registracija`               | public        | Registration (credentials + Google entry)   |
| `/patvirtinti-el-pasta`       | public        | Verification-link consumer                  |
| `/pamirsau-slaptazodi`        | public        | Forgot password                             |
| `/atkurti-slaptazodi`         | public        | Reset password                              |
| `/paskyra`                    | **protected** | Account page (session info + Google status) |
| `/administravimas`            | **admin**     | Admin shell; redirects to the Users section |
| `/administravimas/naudotojai` | **admin**     | User management (list, role change, delete) |

Slugs are ASCII-only Lithuanian. No English auth routes; the admin routes follow
the same Lithuanian slug convention. `/administravimas` is registered in
`entities/user` as the frontend role model; the server is always the authority.

## Auth state and memory-only access token

`AuthProvider` (`src/lib/auth/auth-context.tsx`) is a client component at the
root layout. State: `status` (`unknown` | `authenticated` | `unauthenticated` |
`error`), `user`, and an in-memory access token held in a `useRef`. The access
token is **never** written to `localStorage`, `sessionStorage`, IndexedDB, or a
JavaScript cookie. The refresh token stays in the backend's httpOnly cookie and
is never read by JS.

### Auth status semantics

| Status            | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `unknown`         | Bootstrap not completed yet                                    |
| `authenticated`   | A confirmed valid session                                      |
| `unauthenticated` | Backend **confirmed** no valid session (`401`)                 |
| `error`           | Transient/infrastructure failure — session state is _unproven_ |

Only a confirmed `401` from `POST /api/auth/refresh` (or `GET /api/auth/me`)
transitions to `unauthenticated`. Network failures, timeouts, `5xx`, and
malformed/unexpected server failures transition to `error` and never clear a
potentially valid session. This is the smallest clean model the auth UI needs.

## Session bootstrap

On mount, `AuthProvider` calls `POST /api/auth/refresh` (credentials/cookies).
On success it stores the access token, calls `GET /api/auth/me`, and marks
`authenticated`. A confirmed `401` marks `unauthenticated`; a transient or `5xx`
failure marks `error`, keeping any existing state. Because bootstrap lives in one
provider, mounted components don't each trigger a refresh, and it is re-runnable
for retry.

## Refresh coordination

`refreshAccessToken` is single-flight: concurrent callers await one shared
promise, so refresh-token rotation (A-005) is never raced. A confirmed `401`
marks `unauthenticated` and clears state; a transient/`5xx` failure throws
without clearing (the user is not classified as logged out).
`authedRequest` retries a request once after a refresh on `401`, then gives up
and clears state — no infinite loops or indefinite retries. A transient refresh
failure propagates as an error and leaves the session untouched.

## `returnTo` safety

`safeReturnTo` only accepts same-origin relative paths; it rejects absolute and
protocol-relative URLs, backslashes, and control characters (open-redirect safe),
falling back to `/paskyra`.

## OAuth handoff

The Google button is a real link/navigation to `GET /api/auth/google` (no JS
SDK, no JSON fetch). The backend redirects to `/prisijungti?oauth=success`, where
the login page bootstraps the session via refresh and navigates on;
`oauth=failed` shows Lithuanian guidance. No token ever appears in a URL.

The backend OAuth flow creates, auto-links, or logs in the account through the
same `GET /api/auth/google` endpoint (identity resolution in
`docs/authentication.md`): a Google sign-in with the same verified email as an
existing credentials account transparently enters that account. The registration
page therefore exposes the same Google entry point as login rather than a
separate "Google registration" flow.

### Google availability (capability-gated)

The frontend must not advertise an action the deployed backend cannot perform.
`GoogleAuthButton` (`src/components/google-auth-button.tsx`) is shared by
`/prisijungti` and `/registracija` and:

1. fetches `GET /api/auth/capabilities` (non-secret, public; currently
   `{ "google": boolean }`) on mount;
2. renders the Google action only when `google === true`;
3. renders nothing while the answer is unknown and **fails closed** (hidden) if
   the request fails.

This means a disabled deployment never shows a usable Google control, so a user
cannot be sent to the backend's explicit `GET /api/auth/google` `503` response
by clicking the UI. When Google is configured, the action appears consistently
on both pages. The backend's disabled-provider behaviour is unchanged.

Email verification, resend, and password recovery are permanent product
capabilities and are **not** capability-gated: they remain visible even when
staging SMTP is temporarily unconfigured (`docs/email.md`).

## Protected route behaviour

`/paskyra` uses the client auth boundary: while `status === 'unknown'` it shows a
loading state (no protected content and no redirect flash); `authenticated`
renders safe data (email, verification state; dev-only user id/status);
`unauthenticated` redirects to `/prisijungti?returnTo=/paskyra`; `error` renders a
recoverable Lithuanian error with a retry button (which re-runs bootstrap) and
does **not** redirect to login. Logout calls `POST /api/auth/logout`, clears
in-memory state, and returns to login. Public pages remain usable regardless of
bootstrap outcome.

### Admin area access

`/administravimas` and `/administravimas/naudotojai` reuse the same client
boundary (widget `widgets/admin`): `unknown` shows loading; `unauthenticated`
redirects to `/prisijungti?returnTo=<current path>`; `error` shows a recoverable
retry; an authenticated `user` or `editor` gets an explicit “Neturite prieigos”
state. Only an `admin` sees the dashboard shell with the Users section. This
gating is UX only — every admin API request is re-authorized server-side by
`RolesGuard` (`admin` required), so hiding the UI is never the security control.

### Google status (read-only)

Google accounts are linked automatically on Google login when the Google email is
verified and matches an existing account whose own email is verified (see
`docs/authentication.md`). There is **no user action** to link or unlink. When
Google is enabled (`GET /api/auth/capabilities` → `{ google: true }`), `/paskyra`
shows a read-only `Google paskyra: Susieta | Nesusieta` row based on
`user.googleLinked`.

## API origin

`src/lib/api/config.ts` resolves the API origin once: `NEXT_PUBLIC_API_BASE_URL`
when set, otherwise empty string in production (same-origin under `/api`) and
`http://localhost:3100` in development. Components never hard-code origins. The
client always sends `credentials: 'include'` for cookie-bearing calls.

## Turnstile and rate-limit UX (A-009)

- `TurnstileWidget` (`src/components/turnstile.tsx`) loads Cloudflare's explicit
  widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, and renders nothing when it
  is not. It emits the challenge token via a callback; `useTurnstileGate()`
  exposes `token`, `reset()`, `needsChallenge`, and `canSubmit`.
- Local development uses Cloudflare's official always-pass **test** sitekey
  `1x00000000000000000000AA` (see `apps/web/.env.example`), paired with the test
  secret in the API; these are test-only and must not reach staging/production.
  If the API enforces Turnstile but no site key is set, the widget never renders
  and submissions fail with `403 TURNSTILE_REQUIRED`.
- Forms on `/prisijungti`, `/registracija`, `/pamirsau-slaptazodi`, and the login
  resend action include `turnstileToken` in the request and disable submission
  until a valid token is available (when a site key is configured). After every
  attempt the widget is remounted, acquiring a fresh single-use token.
- Error mapping (Lithuanian): `403 TURNSTILE_REQUIRED`/`TURNSTILE_FAILED` →
  "Nepavyko patvirtinti, kad nesate robotas…"; `429` →
  "Per daug bandymų…". Raw Cloudflare/backend detail is never shown.
- The secret key is backend-only; only the public site key reaches the frontend,
  and it is never used in `NEXT_PUBLIC_*` for the secret.

## Password visibility

Every password input uses `PasswordField` (`src/components/password-field.tsx`),
which wraps the shared `FormField` and adds an accessible show/hide toggle:
login password, registration password and confirmation, and reset-password
(new + confirmation). The toggle only switches the input `type` between
`password` and `text`; it never reads or changes the field value, so
`react-hook-form` registration and validation are unaffected. It is keyboard
operable, has an action-labelled accessible name (Lithuanian "Rodyti
slaptažodį" / "Slėpti slaptažodį"), and exposes state via `aria-pressed`. No new
UI dependency was added (the icons come from the existing `lucide-react`).

## Not implemented (intentionally)

Roles exist (`user` / `editor` / `admin`) and the first admin area is
implemented (ADM-001); `editor` is reserved and carries no capabilities yet. No
Customer/addresses/orders/checkout, no catalog, no account-linking UI, no
multi-session/device management, no full RBAC, and no admin audit log.
`/paskyra` is still an auth/test page, not the final customer dashboard.

## Tests

`apps/web` uses Vitest + Testing Library (jsdom). Coverage: auth state
(bootstrap success/failure, login, logout, coordinated refresh), `returnTo`
safety, error mapping (including `429` and Turnstile codes), login/registration/
verification/password-recovery forms, Turnstile gating and widget rendering,
OAuth query outcomes, and the protected `/paskyra` behaviour. `PasswordField`
tests cover hidden-by-default, reveal/hide without changing the value, and
keyboard operation; `GoogleAuthButton` and the login/registration forms cover the
capability-gated Google action (available, unavailable, and fail-closed). All
backend HTTP and Cloudflare are mocked; no test calls the live API or Cloudflare.
