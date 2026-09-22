# A-011 — Unified Google and credentials authentication

## Status

**DONE (local development). Manually verified end-to-end in a real browser.**
Staging deployment of the resulting images is a separate, explicitly authorized
step.

## Goal

`User` is the account; Google and credentials are authentication methods. A
verified identity may add another authentication method without creating a
second `User`, and there is no manual account-linking UX.

## Scope (as delivered)

1. **Google login auto-convergence.** During the normal Google login callback: an
   existing `sub` logs in; otherwise the Google email must be present and
   `email_verified === true` and is normalized; if a `User` has that normalized
   email and holds no different Google identity, it is linked and logged in
   (marking its email verified, since Google proved control); otherwise a new
   `User` + `GOOGLE` account is created. Never trust an unverified Google email;
   never reassign a `sub`; uniqueness + `P2002` reconciliation for race safety.
2. **Google-only password recovery.** A verified Google-only `User` can use
   `forgot-password`; `reset-password` creates a `CREDENTIALS` account for the
   same `User` (or updates the existing one), never touching the `GOOGLE` account
   or creating a second `User`.
3. **Read-only Google status** on `/paskyra` via `googleLinked` on `/api/auth/me`.
4. **No manual linking**: the explicit OAuth link start/callback mode and its UI
   were removed.

## Out of scope

- Unlinking, additional providers, changing the core User/Customer boundary.
- Infrastructure changes (no schema/migration needed).

## Completion record

- Status: DONE (local development; real-browser verified).
- **Explicit linking removed:** `GoogleAccountService.linkIdentity` /
  `GoogleLinkResult`; `GoogleAuthService.startLink` and link callback outcomes;
  `POST /api/auth/google/link`; `linkUserId` in the signed OAuth transaction; the
  `/paskyra?google=…` messages and "Susieti Google paskyrą" action;
  `lib/navigation.ts`; the `/paskyra` `Suspense` wrapper.
- **Auto-convergence added:** transactional link-or-create in
  `GoogleAccountService.resolveIdentity`; an existing _unverified_ same-email
  account is linked and marked verified (real Google-first regression fix);
  `google_already_linked` rejection for a different identity; `P2002`
  reconciliation.
- **Google-only recovery (A-012, folded in):** `password-reset.service.ts`
  `forgot-password` eligibility is "verified `User`"; `reset-password` upserts
  the `CREDENTIALS` account for the same `User` with `P2002` reconciliation.
- Files: backend `google-account.service.ts`, `google-auth.service.ts`,
  `google-auth.controller.ts`, `oauth-transaction.ts`, `session/auth-session.service.ts`,
  `password-reset/password-reset.service.ts`; frontend
  `app/paskyra/{page,account-client}.tsx`, `app/prisijungti/login-form.tsx`,
  `lib/auth/types.ts`; tests `auth-google.db-spec.ts`, `auth-session.db-spec.ts`,
  `auth-password-reset.db-spec.ts`, `account-client.test.tsx`,
  `login-form.test.tsx`; docs `docs/authentication.md`,
  `docs/frontend-authentication.md`.
- Verified: `pnpm verify:db` exit 0 (API 107, web 91, DB-backed 121);
  `pnpm verify` exit 0. Manual browser verification covered credentials
  registration/login, Google registration/login, auto-convergence, duplicate
  rejection, credentials and Google-only password recovery, and continued Google
  login after password creation.
- Note: password recovery for a pure Google-only account creates credentials
  access, so an unverified application email is never relied upon; unknown
  emails remain enumeration-safe.
