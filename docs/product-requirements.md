# Product requirements

Status: **framework only.** The functional specification is not yet defined.
Unknown business/product requirements are explicitly marked as **UNKNOWN** and
must not be invented. Until these are filled in, application scaffolding should
not assume any of them.

## Product summary

`sokoladas.eu` — an e-commerce web store. The domain suggests a chocolate /
confectionery shop, but the catalog and business model are **UNKNOWN** and must
be confirmed by product/business stakeholders.

## What is known

Only the technical stack and the deployment contract are known. No product
behaviour is established.

## Functional areas (structure only)

Each area lists the questions that must be answered. All answers are **UNKNOWN**
until confirmed.

### Catalog and products

UNKNOWN: product types, attributes, images, variants, pricing, stock/inventory
model.

### Cart

UNKNOWN: guest vs account cart, persistence, single vs multi-item assumptions.

### Checkout and orders

UNKNOWN: checkout flow, order states, guest checkout, order history.

### Payments

UNKNOWN: payment provider(s), method, currency. Affects egress (contract C.7).

### Shipping / delivery

UNKNOWN: methods, regions, costs, integration requirements.

### Accounts / authentication

UNKNOWN: roles (customer / admin), auth method, password/reset, sessions.

### Admin / backoffice

UNKNOWN: product and order management scope, CMS needs.

### Search and navigation

UNKNOWN: faceted search, filtering, categories.

### Localization and compliance

UNKNOWN: language(s) (Lithuanian?), currency, VAT/tax, GDPR/cookies.

### Media / uploads

UNKNOWN: product image storage and delivery. Affects contract C.5/C.6 (writable
paths and persistent storage).

### Egress / third-party integrations

UNKNOWN: payment gateway, email, analytics, external APIs. Affects contract C.7.

## Non-functional requirements (open)

- Performance and availability targets: **UNKNOWN**.
- Backup/restore (application side): **UNKNOWN** (database side is infra-owned).
- Observability/logging: **UNKNOWN** beyond the accepted Docker `local` log
  policy in the contract.

## Blocking product questions

These block meaningful scaffolding and are open until stakeholders answer them:

1. What is the catalog (products, attributes, media)?
2. What payment and shipping providers are required (egress)?
3. Are there admin/backoffice requirements, and for whom?
4. Is there guest checkout, or must customers create accounts?
5. What languages and currencies/tax regimes apply?
6. Is there any persistent file/media storage beyond PostgreSQL (uploads)?
