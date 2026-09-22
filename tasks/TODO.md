# smShop — Project TODO

This document is the high-level roadmap and current state of the `smShop` project.

It is intentionally broader than individual task files.

Detailed implementation requirements belong in:

```text
tasks/current/
tasks/done/
docs/
```

This roadmap may evolve as product decisions are made.

---

# Current State

**Current milestone:** M2 — Authentication v1 (COMPLETE; manually verified
end-to-end in local development).

**Current task:** none — `tasks/current/` is empty. Authentication work through
A-012 is complete; the next milestone (M3+) is decided separately.

**Recently completed:** H-000–H-010; A-001–A-012. Beyond Auth v1
(A-001–A-010), this includes:

- **A-011** — automatic Google↔credentials convergence: a verified Google email
  converges to the existing `User` (auto-link), with no manual account-linking
  UX and no duplicate `User`; unverified Google emails are never trusted and a
  Google `sub` is never reassigned.
- **A-012** — password recovery for Google-only users, creating credentials
  access for the same `User`.
- **H-010** — local development environment hardening (local ports 3101/3100,
  `pnpm dev` env preflight, Prisma local env resolution, local docs/tests).

**Next application task:** M3+ milestones, decided separately. No further
authentication feature work is planned.

**Parallel workstream:** production infrastructure / Oracle (`sm-oracle-infra`),
tracked as `OPS-*` below.

**Commit state:** authentication work through A-012 is committed on `main` (see
Git history). Deploying the updated application images to Oracle staging is a
separate, explicitly authorized step.

**Infrastructure vs application:** Auth development does not depend on
production Oracle deployment. Production infrastructure runs as a parallel
workstream and becomes a hard dependency only at pre-launch (see the
infrastructure workstream below).

---

# Project Goal

Build a modern Lithuanian e-commerce store focused on presenting and selling premium chocolate products.

The store should be:

- mobile-first;
- visually product-driven;
- simple and pleasant to use;
- fast;
- accessible;
- SEO-friendly;
- maintainable;
- secure;
- suitable for future growth.

The product photography should do most of the selling.

The UI should support the product imagery rather than compete with it.

Public-facing store content will be **Lithuanian only**.

Public URL slugs should use Lithuanian wording but ASCII-only characters.

Example:

```text
/prisijungti
/pamirsau-slaptazodi
/paskyra
```

---

# Current Milestone

## M0 — Project Foundation & Auth Readiness

- [x] Audit current repository state (H-000)
- [x] Audit Harness maturity (H-000)
- [x] Define missing Harness infrastructure (H-001–H-008 done)
- [ ] Prepare Auth v1 implementation plan

---

# M1 — Harness & Development Workflow

Goal: make the repository safe and predictable for agentic development.

## Harness

- [x] Establish `AGENTS.md`
- [x] Establish architecture rules
- [x] Establish testing rules
- [x] Establish coding conventions where needed
- [x] Establish verification workflow (H-001)
- [x] Establish task lifecycle (H-003)
- [x] Establish commit / completion rules (H-003)

## Harness tasks

- [x] H-000 — Repository readiness audit
- [x] H-001 — Establish the project verification gate
- [x] H-002 — Pin the runtime baseline
- [x] H-003 — Establish the persistent task workflow
- [x] H-004 — Establish CI workflow
- [x] H-005 — Establish Auth environment & validation baseline
- [x] H-006 — Establish test database strategy
- [x] H-007 — Integrate infrastructure workstream into project roadmap
- [x] H-008 — Align backend stack (Fastify / Prisma 7 / ESM-first)
- [x] H-009 — Relocate API modules under `src/modules/`

The Harness baseline is complete. Application development proceeds under M2.

## Application tasks

- [x] A-001 — Establish the authentication domain model
- [x] A-002 — Credentials registration and password hashing
- [x] A-003 — Email infrastructure
- [x] A-004 — Email verification
- [x] A-005 — Login, access token, refresh session and logout
- [x] A-006 — Password recovery
- [x] A-007 — Google authentication and safe account linking
- [x] A-008 — Frontend authentication flows
- [x] A-009 — Authentication security hardening
- [x] A-010 — Auth v1 milestone verification

Milestone M2 — Authentication v1 remains the current application milestone; see
its checklist below for the full scope.

## Structural follow-ups

- [x] Relocate API modules to `apps/api/src/modules/<module-name>/` (H-009).
      Auth, Prisma, and Health now live under `src/modules/`; `src/config`,
      `app.module.ts`, and `main.ts` remain at their architectural level. The
      unused scaffold `app.controller.ts` was removed.

## Task workflow

Task lifecycle, naming conventions, and completion rules are defined in
`docs/task-workflow.md`. Summary:

```text
tasks/TODO.md
    ↓
tasks/current/<task>.md
    ↓
implementation
    ↓
verification
    ↓
tasks/done/<completed-task>.md
    ↓
tasks/TODO.md updated
```

Each implementation task defines objective, context, dependencies, scope,
out-of-scope items, acceptance criteria, required verification, and follow-up
work. A task is not complete until its verification passes.

---

# Infrastructure / Oracle Workstream

This is an **active parallel workstream**, separate from application
milestones. Infrastructure implementation is owned by the external repository
`sm-oracle-infra`; this roadmap tracks only cross-repository status. Detailed
implementation history, runbooks, and secrets remain in `sm-oracle-infra` and
are **not** copied into `smShop`.

Status legend: `DONE` (executed and verified), `PARTIAL` (prepared/partial, not
fully executed), `PLANNED` (not started), `BLOCKED` (waiting on a decision or
dependency). Status reflects known evidence only; do not mark work DONE merely
because it was discussed.

- `DONE` **OPS-000 — Oracle host access and identity baseline**
  - SSH connectivity and hostname-based SSH access confirmed.
  - ED25519 host fingerprint recorded; host identity matched to known address.
- `PARTIAL` **OPS-001 — HTTP bootstrap readiness**
  - Prepared: execution/rollback runbook, Compose file, Nginx configuration,
    firewall helpers, planned TCP 80/443 network allowance.
  - Only HTTP 80 intended initially; ACME challenge path handled directly;
    ordinary requests return 503; Certbot excluded.
  - Not yet executed: Nginx runtime validation remains a pre-exposure gate; no
    live exposure/change confirmed yet.
- `PLANNED` **OPS-002 — TLS / ACME enablement**
  - ACME validation, certificate acquisition, HTTPS listener, HTTP → HTTPS
    redirect, renewal validation.
- `PARTIAL` **OPS-003 — Application deployment contract**
  - Application side exists: Node 24 baseline, configuration contract, `*_FILE`
    secret support, API health endpoint, container/runtime documentation.
  - Remaining infrastructure-side contract alignment is still open.
- `PLANNED` **OPS-004 — Production database and persistence strategy**
  - PostgreSQL placement, volume persistence, backup, restore, migration
    procedure.
- `PLANNED` **OPS-005 — Deployment and rollback workflow**
  - Release process, migration ordering, startup ordering, health verification,
    rollback.
- `PLANNED` **OPS-006 — Backups, logging and monitoring**
  - DB backups, restore test, disk monitoring, service health, logs, error
    visibility, restart strategy.
- `PLANNED` **OPS-007 — Production readiness review**
  - Final infrastructure gate before production launch.

## Infrastructure ↔ application dependencies

- Auth development (M2) **does not** require production Oracle deployment.
- Pre-launch (M21–M22) requires `OPS-002` … `OPS-007` as applicable.
- `OPS-003` (deployment contract) bridges the two repositories; the
  application-side declaration lives in `docs/deployment.md`, the authoritative
  contract remains in
  `sm-oracle-infra/docs/application-deployment-contract.md`.

External repository: `sm-oracle-infra` (cross-repository reference only).

## Production follow-ups (auth-related)

- [ ] Configure Fastify `trustProxy` for the known production reverse-proxy hops
      in `sm-oracle-infra` before launch, so auth rate limiting keys on the real
      client IP rather than the proxy. Current default is `trustProxy=false`
      (client-supplied `X-Forwarded-For` is not trusted). Do not blindly trust
      arbitrary forwarded-IP headers. See `docs/authentication.md`.
- [ ] Move auth rate limiting to a shared store (e.g. Redis) if/when the API is
      scaled horizontally; the current in-memory limiter is per-instance.
- [x] Verify the actual `apps/api` and `apps/web` Docker image builds and run the
      images (D-001, 2026-09-15): both build and run for `linux/arm64`; readiness
      and registration verified; `prisma migrate deploy` verified against
      PostgreSQL 18. GHCR publication and CI execution remain blocked on an
      authorized commit/push.
- [ ] (D-001 discovery) The API does not recover `/health/ready` after a database
      restart without a process restart: a fresh container returns 200, but a
      container that lost its database connection keeps returning 503. The
      infrastructure architecture expects the API to reconnect with bounded
      backoff after database recovery. Investigate the Prisma/pg pool recovery
      behaviour and fix or document.
- [ ] (D-001 discovery) When Turnstile is enabled, the public
      `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is inlined into the frontend image at
      build time; ensure the image build supplies it (it is not a runtime env
      value).

---

# M2 — Authentication v1

**Status: COMPLETE (A-010).** The full credentials + Google authentication slice
is implemented, hardened, documented, and verified end-to-end.

Goal: establish complete customer identity and authentication infrastructure.

2FA is explicitly out of scope for this milestone.

## Authentication foundation

- [x] A-001 — Define authentication domain model
- [x] Separate authentication identity from e-commerce customer domain
- [x] Define account/provider model
- [x] Define access token strategy (A-005)
- [x] Define refresh token strategy (A-005)
- [x] Define logout / token invalidation strategy (A-005)
- [x] Implement secure password hashing (A-002)

## Credentials registration

- [x] A-002 — Registration API (`POST /api/auth/register`)
- [x] A-002 — Registration validation
- [x] A-002 — Duplicate email handling
- [x] Registration frontend (A-008)
- [x] Registration success/error states (A-008)

## Email verification

- [x] Email verification token model (A-001)
- [x] Token expiration (A-004 — 24h TTL)
- [x] Verification email (A-004 — Lithuanian, via MailService)
- [x] Verification endpoint (A-004 — `POST /api/auth/verify-email`)
- [x] Verification frontend (A-008)
- [x] Resend verification (A-004 — `POST /api/auth/resend-verification`)
- [x] Invalid token handling (A-004)
- [x] Expired token handling (A-004)
- [x] Already-used token handling (A-004)

## Login

- [x] Credentials login API (A-005)
- [x] Login frontend (A-008)
- [x] Access token flow (A-005)
- [x] Refresh token flow (A-005)
- [x] Logout (A-005)
- [x] Authentication state restoration (A-005 — `GET /api/auth/me`)

## Password recovery

- [x] Forgot-password API (A-006)
- [x] Forgot-password frontend (A-008)
- [x] Recovery for Google-only users — creates credentials access for the same User (A-012)
- [x] Reset token (A-006)
- [x] Reset email (A-006)
- [x] Reset-password frontend (A-008)
- [x] Password update (A-006)
- [x] Token expiration (A-006 — 1h)
- [x] Single-use reset tokens (A-006)
- [x] Existing session/token invalidation after reset (A-006)

## Google authentication

- [x] Google OAuth architecture (A-007)
- [x] Google login (A-007)
- [x] Google registration (A-007)
- [x] OAuth callback handling (A-007)
- [x] Account linking strategy (A-007; superseded by A-011 automatic linking)
- [x] Existing credentials-account collision handling (A-011 — auto-links the same verified email; never an unverified one)
- [x] Google↔credentials automatic convergence, same User, no manual link UX (A-011)
- [x] Google authentication frontend (A-008)

## Account area

- [x] `/paskyra` (A-008 auth/test page)
- [x] Basic account information (email, verification state)
- [x] Email verification state
- [x] Google status (read-only; no link action required) (A-011)
- [x] Logout action
- [x] Protected route behaviour

## Security

- [x] Rate limiting (A-009 — endpoint-specific, 429)
- [x] Login brute-force protection (A-009 — rate limit + Turnstile)
- [x] Password-reset abuse protection (A-009 — rate limit + Turnstile)
- [x] User enumeration protection (A-004/A-006/A-009)
- [x] Secure cookies (A-005)
- [x] CORS review (A-005 — explicit origin + credentials)
- [x] CSRF review (A-005 — documented SameSite=Lax + origin decision)
- [x] Secret validation (H-005 / A-002)
- [x] Auth security tests (A-009)

## Auth verification

- [x] Unit tests
- [x] Integration tests
- [x] API e2e tests
- [x] Critical frontend flow tests
- [x] Full Auth v1 verification (A-010)
- [x] Auth v1 milestone review (A-010)
- [x] Google convergence + Google-only recovery DB tests (A-011/A-012)
- [x] Manual browser end-to-end verification (local development)

---

# M3 — Store Information Architecture

Goal: freeze the first usable store structure before catalogue implementation expands.

- [ ] Finalize public site map
- [ ] Finalize main navigation
- [ ] Finalize footer structure
- [ ] Define product category structure
- [ ] Define informational pages
- [ ] Define account navigation
- [ ] Define search requirements
- [ ] Define filtering requirements
- [ ] Define sorting requirements

Potential public areas:

- [ ] Home
- [ ] Product catalogue
- [ ] Product categories
- [ ] Product page
- [ ] Cart
- [ ] Checkout
- [ ] Account
- [ ] About
- [ ] Contact
- [ ] Delivery information
- [ ] Payment information
- [ ] FAQ
- [ ] Privacy policy
- [ ] Terms and conditions
- [ ] Returns / complaints information

Exact routes and structure remain subject to product decisions.

---

# M4 — Design System & Storefront Foundation

Goal: establish the visual language before building large amounts of storefront UI.

## Visual direction

- [ ] Finalize primary colour palette
- [ ] Finalize typography
- [ ] Define spacing scale
- [ ] Define border radius
- [ ] Define shadows
- [ ] Define buttons
- [ ] Define form controls
- [ ] Define cards
- [ ] Define feedback states
- [ ] Define modal / drawer patterns

Current visual direction:

```text
Chocolate: #522c1b
Caramel:   #b07e5b
Cream:     #ebdccd
```

Headings may use `Kalam` or a visually compatible alternative, subject to final design review.

## Design principles

- [ ] Mobile-first
- [ ] Product photography is dominant
- [ ] UI must not compete with product imagery
- [ ] Warm visual language
- [ ] Minimal visual clutter
- [ ] Clear conversion paths
- [ ] Accessible contrast
- [ ] Consistent touch targets
- [ ] Strong responsive behaviour

## Shared storefront shell

- [ ] Header
- [ ] Mobile navigation
- [ ] Desktop navigation
- [ ] Footer
- [ ] Store layout
- [ ] Breadcrumbs
- [ ] Global loading states
- [ ] Global error states
- [ ] Empty states

---

# M5 — Product Domain & Catalogue

Goal: create the core product model and public catalogue.

## Product domain

- [ ] Define product entity
- [ ] Define categories
- [ ] Define pricing model
- [ ] Define product availability
- [ ] Define inventory requirements
- [ ] Define product images
- [ ] Define product attributes
- [ ] Define variants, if required
- [ ] Define product status
- [ ] Define slug strategy

## Catalogue backend

- [ ] Product persistence
- [ ] Category persistence
- [ ] Product queries
- [ ] Category queries
- [ ] Filtering
- [ ] Sorting
- [ ] Pagination
- [ ] Search strategy

## Catalogue frontend

- [ ] Catalogue page
- [ ] Category page
- [ ] Product cards
- [ ] Filters
- [ ] Sorting
- [ ] Pagination / load-more decision
- [ ] Empty states
- [ ] Responsive behaviour

---

# M6 — Product Detail Experience

Goal: create a product page that sells through imagery and clear product information.

- [ ] Product image gallery
- [ ] Responsive image handling
- [ ] Product name
- [ ] Price
- [ ] Availability
- [ ] Description
- [ ] Ingredients
- [ ] Allergens
- [ ] Weight / quantity information
- [ ] Storage information where relevant
- [ ] Product attributes
- [ ] Variant selection if required
- [ ] Quantity selector
- [ ] Add-to-cart
- [ ] Related products
- [ ] Product structured data
- [ ] Social / SEO metadata

Product photography quality is a launch requirement, not an optional enhancement.

---

# M7 — Shopping Cart

Goal: build a reliable cart independent of checkout implementation details.

## Decisions

- [ ] Decide anonymous cart strategy
- [ ] Decide authenticated cart strategy
- [ ] Decide cart persistence duration
- [ ] Decide cart merge behaviour after login

## Backend

- [ ] Cart model
- [ ] Add item
- [ ] Remove item
- [ ] Update quantity
- [ ] Validate availability
- [ ] Recalculate prices server-side
- [ ] Cart merge strategy

## Frontend

- [ ] Add-to-cart interaction
- [ ] Cart indicator
- [ ] Cart drawer or page decision
- [ ] Cart page
- [ ] Quantity controls
- [ ] Remove item
- [ ] Cart totals
- [ ] Empty cart
- [ ] Checkout CTA

---

# M8 — Customer Domain

Goal: add e-commerce customer functionality without polluting the authentication domain.

- [ ] Define Customer model
- [ ] Connect Customer to authenticated identity where appropriate
- [ ] Support guest checkout
- [ ] Customer name and contact information
- [ ] Delivery addresses
- [ ] Billing information
- [ ] Address management
- [ ] Account profile
- [ ] Customer order history

Future requirements should remain possible:

- B2B customers;
- multiple delivery addresses;
- guest orders;
- account conversion after guest checkout.

---

# M9 — Checkout

Goal: create a clear and reliable checkout flow.

## Checkout decisions

- [ ] Decide guest checkout requirements
- [ ] Decide required customer fields
- [ ] Decide billing address rules
- [ ] Decide delivery methods
- [ ] Decide delivery pricing rules
- [ ] Decide free-delivery thresholds
- [ ] Decide payment providers
- [ ] Decide order confirmation flow

## Checkout implementation

- [ ] Checkout session/domain model
- [ ] Customer/contact step
- [ ] Delivery address
- [ ] Delivery method
- [ ] Billing information
- [ ] Order summary
- [ ] Final server-side price validation
- [ ] Payment initiation
- [ ] Checkout error handling
- [ ] Checkout recovery behaviour

---

# M10 — Payments

Payment architecture remains subject to business decisions.

- [ ] Select payment provider
- [ ] Define payment states
- [ ] Payment initiation
- [ ] Payment callback/webhook
- [ ] Signature verification
- [ ] Duplicate webhook protection
- [ ] Failed payment handling
- [ ] Cancelled payment handling
- [ ] Payment reconciliation
- [ ] Refund requirements
- [ ] Payment integration tests

Never trust frontend payment state as the authoritative source.

---

# M11 — Orders

Goal: establish reliable order lifecycle management.

## Order model

- [ ] Order number strategy
- [ ] Order items snapshot
- [ ] Price snapshot
- [ ] Customer snapshot
- [ ] Delivery snapshot
- [ ] Payment state
- [ ] Fulfilment state
- [ ] Order state transitions

## Customer experience

- [ ] Order confirmation page
- [ ] Confirmation email
- [ ] Order history
- [ ] Order detail page
- [ ] Guest order access strategy

## Internal handling

- [ ] New order notification
- [ ] Order processing workflow
- [ ] Order status updates
- [ ] Customer status notifications

---

# M12 — Email & Notifications

Goal: create consistent transactional communication.

- [x] Email infrastructure (A-003 — provider-independent SMTP)
- [ ] Shared email layout
- [ ] Email branding
- [ ] Registration verification
- [ ] Password reset
- [ ] Order confirmation
- [ ] Order status updates
- [ ] Payment-related notifications if required
- [ ] Development email preview/testing
- [ ] Delivery failure monitoring strategy

---

# M13 — Admin / Store Management

Goal: allow store operators to manage core commerce data without database access.

## Product management

- [ ] Product list
- [ ] Create product
- [ ] Edit product
- [ ] Archive/unpublish product
- [ ] Category management
- [ ] Product image management
- [ ] Price management
- [ ] Stock / availability management

## Order management

- [ ] Order list
- [ ] Order search
- [ ] Order filters
- [ ] Order detail
- [ ] Order status management
- [ ] Payment state visibility

## Customer management

- [ ] Customer list if required
- [ ] Customer detail if required
- [ ] Order history visibility

## Access control

- [ ] Define admin identity model
- [ ] Define admin authorization
- [ ] Protect administration routes
- [ ] Security audit

Do not overbuild RBAC unless the business actually requires it.

---

# M14 — Content & Homepage

Goal: build the commercial storefront around real products and real photography.

## Homepage

Potential sections:

- [ ] Hero
- [ ] Featured products
- [ ] Product categories
- [ ] Seasonal products
- [ ] Best sellers
- [ ] Brand/story section
- [ ] Benefits / trust signals
- [ ] Delivery / ordering information
- [ ] CTA sections

Exact homepage composition remains a design/content decision.

## Content

- [ ] Final Lithuanian copy
- [ ] Product descriptions
- [ ] Product imagery
- [ ] Category imagery
- [ ] Brand story
- [ ] Contact details
- [ ] Legal content

---

# M15 — Search, SEO & Discoverability

## Technical SEO

- [ ] Metadata system
- [ ] Canonical URLs
- [ ] Sitemap
- [ ] Robots rules
- [ ] Product structured data
- [ ] Breadcrumb structured data
- [ ] Organisation structured data where appropriate
- [ ] Open Graph metadata
- [ ] 404 handling
- [ ] Redirect strategy

## Content SEO

- [ ] Product titles
- [ ] Product descriptions
- [ ] Category titles
- [ ] Category descriptions
- [ ] Image alt text
- [ ] Internal linking

## Search

- [ ] Decide whether site search is required for initial launch
- [ ] Search UX
- [ ] Search API
- [ ] No-results behaviour

---

# M16 — Performance & Accessibility

Performance and accessibility should be considered during implementation, not postponed entirely until launch.

## Performance

- [ ] Responsive image optimisation
- [ ] Image format strategy
- [ ] Lazy loading
- [ ] Font loading
- [ ] Bundle review
- [ ] Cache strategy
- [ ] API performance review
- [ ] Core Web Vitals review

## Accessibility

- [ ] Keyboard navigation
- [ ] Visible focus states
- [ ] Form labels
- [ ] Validation accessibility
- [ ] Semantic structure
- [ ] Image alt strategy
- [ ] Colour contrast
- [ ] Touch target sizing
- [ ] Screen-reader review of critical flows

---

# M17 — Analytics & Business Measurement

- [ ] Define analytics platform
- [ ] Cookie/consent requirements
- [ ] Page-view tracking
- [ ] Product-view events
- [ ] Add-to-cart events
- [ ] Begin-checkout events
- [ ] Purchase events
- [ ] Conversion measurement
- [ ] Search Console
- [ ] Error monitoring

Analytics must not expose sensitive customer data.

---

# M18 — Legal & Compliance

Requirements must be reviewed against the actual Lithuanian/EU business setup before launch.

- [ ] Privacy policy
- [ ] Cookie policy
- [ ] Terms and conditions
- [ ] Delivery terms
- [ ] Return / complaint policy
- [ ] GDPR review
- [ ] Consent requirements
- [ ] Transactional email requirements
- [ ] Required seller/company information
- [ ] Product information compliance
- [ ] Food-related information requirements
- [ ] Allergen information requirements

Do not treat this roadmap as legal advice.

---

# M19 — Production Infrastructure

Production infrastructure decisions are intentionally separate from feature development.

> Active workstream tracked as `OPS-*` in the **Infrastructure / Oracle
> Workstream** section above. That section is the authoritative roadmap for
> infrastructure status; the items below are the application-visible production
> concerns and are not a duplicate of `sm-oracle-infra` history.

- [ ] Production architecture
- [ ] Hosting decision
- [ ] Production database
- [ ] Object/image storage if required
- [ ] Environment configuration
- [ ] Secrets management
- [ ] Production email provider
- [ ] Domain/DNS
- [ ] TLS
- [ ] Backup strategy
- [ ] Database backup restore test
- [ ] Logging
- [ ] Monitoring
- [ ] Error tracking
- [ ] Deployment workflow
- [ ] Rollback strategy

---

# M20 — Security Hardening

- [ ] Dependency audit
- [ ] Authentication security review
- [ ] Authorization review
- [ ] Admin security review
- [ ] Rate-limit review
- [ ] Input validation review
- [ ] File upload security review
- [ ] Secret exposure review
- [ ] HTTP security headers
- [ ] Cookie security
- [ ] CSRF review
- [ ] XSS review
- [ ] SQL/ORM query review
- [ ] Sensitive logging review
- [ ] Production security checklist

---

# M21 — Pre-Launch Verification

## Functional

- [ ] Registration
- [ ] Email verification
- [ ] Login
- [ ] Password recovery
- [ ] Google login
- [ ] Product browsing
- [ ] Filtering
- [ ] Product page
- [ ] Cart
- [ ] Guest checkout
- [ ] Authenticated checkout
- [ ] Payment
- [ ] Order creation
- [ ] Emails
- [ ] Account
- [ ] Admin workflow

## Quality

- [ ] Full verification gate passes
- [ ] Production build passes
- [ ] Database migrations verified
- [ ] Browser testing
- [ ] Mobile testing
- [ ] Accessibility review
- [ ] Performance review
- [ ] SEO review
- [ ] Security review

## Operational

- [ ] Production environment
- [ ] Backups
- [ ] Monitoring
- [ ] Error reporting
- [ ] Analytics
- [ ] Search Console
- [ ] SMTP/email delivery
- [ ] Payment production credentials
- [ ] Legal pages
- [ ] Launch rollback plan

---

# M22 — Launch

- [ ] Final production deployment
- [ ] Production smoke test
- [ ] Test real payment
- [ ] Test transactional email
- [ ] Verify indexing configuration
- [ ] Verify analytics
- [ ] Verify monitoring
- [ ] Confirm backup execution
- [ ] Launch approval

---

# Post-Launch

Potential future work:

- [ ] Wishlist
- [ ] Product reviews
- [ ] Discount codes
- [ ] Promotions
- [ ] Gift cards
- [ ] Loyalty programme
- [ ] Abandoned cart recovery
- [ ] Product recommendations
- [ ] Advanced search
- [ ] Customer segmentation
- [ ] B2B functionality
- [ ] 2FA
- [ ] Additional authentication providers
- [ ] Advanced admin roles
- [ ] Marketing automation
- [ ] Additional languages if the business ever requires them

These features are **not part of the initial launch unless explicitly promoted into scope**.

---

# Project Principles

1. Do not implement speculative complexity.
2. Build in small, independently verifiable tasks.
3. Repository state is the source of truth.
4. `tasks/TODO.md` describes the roadmap; task files describe implementation work.
5. Completed tasks must preserve useful implementation history.
6. Product requirements may evolve; update this roadmap when they do.
7. Security and testing are part of implementation, not cleanup work.
8. Authentication identity and e-commerce customer concepts should remain appropriately separated.
9. Critical prices, stock, payments, and order state must be authoritative on the server.
10. Product photography is a core part of the product experience, not decorative content.
