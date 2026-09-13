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

**Current milestone:** M1 — Harness & Development Workflow (M0 foundation audit
is complete).

**Current task:** none — `tasks/current/` is empty; start the next task from
the list below.

**Recently completed:** H-000 repository readiness audit, H-001 verification
gate, H-002 runtime baseline, H-003 task workflow, H-004 CI workflow.

**Next:** H-005 — Establish Auth environment & validation baseline.

**Planned Harness tasks:** H-006 — Test database strategy.

**Next product milestone:** M2 — Authentication v1, after the Harness tasks
above.

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
- [ ] Define missing Harness infrastructure (H-001–H-003 done; H-004–H-006 planned)
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
- [ ] H-005 — Establish Auth environment & validation baseline
- [ ] H-006 — Establish test database strategy

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

# M2 — Authentication v1

Goal: establish complete customer identity and authentication infrastructure.

2FA is explicitly out of scope for this milestone.

## Authentication foundation

- [ ] Define authentication domain model
- [ ] Separate authentication identity from e-commerce customer domain
- [ ] Define account/provider model
- [ ] Define access token strategy
- [ ] Define refresh token strategy
- [ ] Define logout / token invalidation strategy
- [ ] Implement secure password hashing

## Credentials registration

- [ ] Registration API
- [ ] Registration validation
- [ ] Duplicate email handling
- [ ] Registration frontend
- [ ] Registration success/error states

## Email verification

- [ ] Email verification token model
- [ ] Token expiration
- [ ] Verification email
- [ ] Verification endpoint
- [ ] Verification frontend
- [ ] Resend verification
- [ ] Invalid token handling
- [ ] Expired token handling
- [ ] Already-used token handling

## Login

- [ ] Credentials login API
- [ ] Login frontend
- [ ] Access token flow
- [ ] Refresh token flow
- [ ] Logout
- [ ] Authentication state restoration

## Password recovery

- [ ] Forgot-password API
- [ ] Forgot-password frontend
- [ ] Reset token
- [ ] Reset email
- [ ] Reset-password frontend
- [ ] Password update
- [ ] Token expiration
- [ ] Single-use reset tokens
- [ ] Existing session/token invalidation after reset

## Google authentication

- [ ] Google OAuth architecture
- [ ] Google login
- [ ] Google registration
- [ ] OAuth callback handling
- [ ] Account linking strategy
- [ ] Existing credentials-account collision handling
- [ ] Google authentication frontend

## Account area

- [ ] `/paskyra`
- [ ] Basic account information
- [ ] Email verification state
- [ ] Logout action
- [ ] Protected route behaviour

## Security

- [ ] Rate limiting
- [ ] Login brute-force protection
- [ ] Password-reset abuse protection
- [ ] User enumeration protection
- [ ] Secure cookies
- [ ] CORS review
- [ ] CSRF review
- [ ] Secret validation
- [ ] Auth security tests

## Auth verification

- [ ] Unit tests
- [ ] Integration tests
- [ ] API e2e tests
- [ ] Critical frontend flow tests
- [ ] Full Auth v1 verification
- [ ] Auth v1 milestone review

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

- [ ] Email infrastructure
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
