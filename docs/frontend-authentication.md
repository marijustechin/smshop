# Frontend Authentication

Status: **implemented (A-008).** Lithuanian-only auth UI on top of the backend
auth API (see `docs/authentication.md` for protocol details). The storefront
stays public; authentication is only required for account functionality.

## Routes

| Route                   | Access        | Purpose                                     |
| ----------------------- | ------------- | ------------------------------------------- |
| `/`                     | public        | Storefront placeholder + dev nav links      |
| `/prisijungti`          | public        | Login, Google entry, OAuth outcome handling |
| `/registracija`         | public        | Registration                                |
| `/patvirtinti-el-pasta` | public        | Verification-link consumer                  |
| `/pamirsau-slaptazodi`  | public        | Forgot password                             |
| `/atkurti-slaptazodi`   | public        | Reset password                              |
| `/paskyra`              | **protected** | Simple account/test page                    |

Slugs are ASCII-only Lithuanian. No English auth routes.

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
`oauth=account-link-required` and `oauth=failed` show Lithuanian guidance. No
token ever appears in a URL.

## Protected route behaviour

`/paskyra` uses the client auth boundary: while `status === 'unknown'` it shows a
loading state (no protected content and no redirect flash); `authenticated`
renders safe data (email, verification state; dev-only user id/status);
`unauthenticated` redirects to `/prisijungti?returnTo=/paskyra`; `error` renders a
recoverable Lithuanian error with a retry button (which re-runs bootstrap) and
does **not** redirect to login. Logout calls `POST /api/auth/logout`, clears
in-memory state, and returns to login. Public pages remain usable regardless of
bootstrap outcome.

## API origin

`src/lib/api/config.ts` resolves the API origin once: `NEXT_PUBLIC_API_BASE_URL`
when set, otherwise empty string in production (same-origin under `/api`) and
`http://localhost:3001` in development. Components never hard-code origins. The
client always sends `credentials: 'include'` for cookie-bearing calls.

## Not implemented (intentionally)

No roles/RBAC, no Customer/addresses/orders/checkout, no catalog, no Turnstile
(A-009), no rate limiting, no account-linking UI, no multi-session/device
management. `/paskyra` is an auth/test page, not the final customer dashboard.

## Tests

`apps/web` uses Vitest + Testing Library (jsdom). Coverage: auth state
(bootstrap success/failure, login, logout, coordinated refresh), `returnTo`
safety, error mapping, login/registration/verification/password-recovery forms,
OAuth query outcomes, and the protected `/paskyra` behaviour. All backend HTTP is
mocked; no test calls the live API.
