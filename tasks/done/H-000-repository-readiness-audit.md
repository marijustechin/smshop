# H-000 — Repository Readiness Audit

## Status

DONE

## Note

Completed before the task lifecycle existed. The body below is the original
audit task specification, preserved for context. Its findings drove H-001
(verification gate), H-002 (runtime baseline), and H-003 (task workflow).

---

# smShop — Current State and Harness Readiness Audit

## Objective

Before implementing authentication, inspect the current `smShop` repository and produce a technical readiness report.

This is a **discovery and audit task only**.

Do not implement authentication, change application behavior, modify the database schema, install dependencies, or make architectural changes.

We need to understand:

1. the current project architecture and technical state;
2. what already exists in frontend, backend, database, and authentication-related areas;
3. how mature the current Harness / agentic development setup is;
4. what is missing before we can safely start `Auth v1`;
5. what project documentation, constraints, or verification workflows should be improved first.

---

# Product Context

`smShop` is a Lithuanian e-commerce store.

The public store will support **Lithuanian only**.

Public-facing route names must use Lithuanian wording, but slugs must be **ASCII-only** and must not contain Lithuanian diacritics.

Examples:

- `/prisijungti`
- `/registracija`
- `/patvirtinti-el-pasta`
- `/pamirsau-slaptazodi`
- `/atkurti-slaptazodi`
- `/paskyra`

Do not use English public routes such as:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

Do not use Lithuanian Unicode characters in public slugs.

For example:

- correct: `/pamirsau-slaptazodi`
- incorrect: `/pamiršau-slaptazodi`

Internal code, API names, class names, variables, modules, database entities, and technical documentation should remain in English.

---

# Planned First Functional Scope: Auth v1

The next major implementation phase will be a complete `Auth v1`.

Expected scope:

## Credentials Authentication

- user registration with email and password;
- login;
- logout;
- access token mechanism;
- refresh token mechanism;
- secure password hashing.

## Email Verification

- verification email;
- verification token;
- token expiration;
- resend verification flow;
- already-used token handling;
- invalid and expired token handling.

## Password Recovery

- forgot password flow;
- reset email;
- single-use reset token;
- token expiration;
- password reset;
- invalidation of existing refresh tokens or sessions after password reset, where appropriate.

## Google Authentication

- registration with Google;
- login with Google;
- account linking strategy when the same email already exists as a credentials account.

## Frontend

At minimum, expect routes equivalent to:

- `/prisijungti`
- `/registracija`
- `/patvirtinti-el-pasta`
- `/pamirsau-slaptazodi`
- `/atkurti-slaptazodi`
- `/paskyra`

2FA is explicitly **out of scope** for Auth v1.

---

# Important Domain Boundary

Evaluate the current project with the following principle in mind:

**Authentication identity must not automatically be treated as the same domain concept as an e-commerce Customer.**

We do not want to create an unnecessary hard dependency such as:

```text
User === Customer
```

if this could later interfere with:

- guest checkout;
- customer profiles;
- multiple delivery addresses;
- order history;
- B2B accounts;
- future e-commerce requirements.

Inspect whether the current data model already couples identity and customer concepts too tightly.

Do not redesign the domain model during this task.

Only report what currently exists and identify potential risks.

---

# 1. Repository Audit

Inspect the repository structure.

Report:

- important root directories;
- workspace structure;
- package manager;
- Node.js version;
- main frameworks;
- frontend application;
- backend application;
- shared packages;
- database layer;
- test infrastructure;
- linting;
- formatting;
- type checking;
- build scripts;
- Docker / Compose setup, if present;
- environment configuration strategy;
- `.env.example` or equivalent.

Do not dump the entire repository tree.

Show only architecture-relevant structure.

---

# 2. Frontend Audit

Determine:

- framework and version;
- App Router or Pages Router;
- route structure;
- layout structure;
- UI libraries;
- form libraries;
- validation libraries;
- API client strategy;
- state management;
- cookie usage;
- authentication-related code;
- protected route mechanisms, if any.

Search specifically for existing:

- auth routes;
- login components;
- registration components;
- account pages;
- user state;
- auth hooks;
- auth stores;
- route guards;
- middleware.

For every relevant area, distinguish between:

- implemented;
- scaffolded;
- unused;
- missing.

---

# 3. Backend Audit

Determine:

- framework and version;
- HTTP adapter;
- global pipes;
- validation;
- exception handling;
- configuration management;
- CORS setup;
- cookie support;
- security middleware;
- rate limiting;
- auth-related modules;
- user-related modules;
- mail infrastructure;
- OAuth-related dependencies.

If authentication-related code already exists, report:

- what is functional;
- what is incomplete;
- what is unused;
- what appears obsolete;
- what may conflict with the planned Auth v1.

---

# 4. Database Audit

Inspect the current database layer.

Report:

- database engine;
- ORM;
- migration mechanism;
- user-related tables or entities;
- authentication-related tables or entities;
- important fields;
- unique constraints;
- indexes;
- relations.

Specifically evaluate readiness for:

- credentials authentication;
- Google authentication;
- multiple auth providers;
- email verification;
- password reset;
- refresh token or session lifecycle;
- account linking.

Do not propose a final schema unless necessary to explain a concrete limitation.

First describe the current state.

---

# 5. Email Infrastructure

Check whether the project already contains:

- mail service;
- SMTP configuration;
- mail transport;
- email templates;
- email rendering infrastructure;
- development mail catcher;
- testing strategy for email.

If nothing exists, explicitly state:

`Not found`.

Do not configure SMTP or any external email provider.

---

# 6. Google OAuth Readiness

Check for:

- Google OAuth dependencies;
- Passport strategies or equivalent;
- OAuth callback routes;
- environment variables;
- frontend integration;
- provider/account models;
- OAuth state handling;
- PKCE support where applicable.

Evaluate whether the current architecture can support Google authentication cleanly alongside credentials authentication.

Do not configure Google Cloud Console or external credentials.

---

# 7. Security Baseline

Inspect the current state regarding:

- password hashing;
- JWT handling;
- refresh token handling;
- cookie flags;
- token storage;
- token hashing in the database;
- token expiration;
- logout strategy;
- token invalidation;
- CSRF exposure;
- CORS;
- rate limiting;
- brute-force protection;
- user enumeration;
- secret handling;
- environment variable validation.

Classify each relevant area as:

- implemented;
- partially implemented;
- missing.

Flag concrete security risks where evidence exists.

Do not speculate.

---

# 8. Testing and Verification

Determine:

- test runner;
- unit tests;
- integration tests;
- e2e tests;
- frontend component tests;
- API tests;
- database testing strategy;
- CI workflows;
- coverage requirements, if any.

Identify the main project verification command.

For example:

```bash
pnpm verify
```

If no single verification gate exists, explicitly identify this as a Harness gap.

Also determine whether verification currently includes:

- lint;
- typecheck;
- unit tests;
- integration tests;
- e2e tests;
- production build;
- migration checks.

---

# 9. Harness Audit

This is a critical part of the task.

Inspect the repository for the current agentic development Harness.

Look for:

- `AGENTS.md`
- `README.md`
- `TODO.md`
- `docs/`
- `architecture.md`
- `testing.md`
- `development.md`
- `contributing.md`
- ADRs;
- architecture decision records;
- task documents;
- project-state documents;
- verification scripts;
- CI workflows;
- task naming conventions;
- commit rules.

Assess whether an implementation agent can clearly determine the following.

## Architecture

Is it clear:

- which technologies are allowed;
- where frontend code belongs;
- where backend code belongs;
- where shared code belongs;
- where database code belongs;
- what architectural boundaries must not be crossed;
- which dependencies must not be introduced casually.

## Workflow

Is it clear:

- how a task is selected;
- how scope is defined;
- how implementation should proceed;
- how verification is performed;
- when a task is considered complete;
- when committing is allowed;
- what the final agent report should contain.

## Testing

Is it clear:

- when unit tests are required;
- when integration tests are required;
- when e2e tests are required;
- what verification command must pass;
- whether regression tests are expected.

## Change Discipline

Is the agent explicitly instructed to:

- avoid unrelated changes;
- avoid scope creep;
- avoid speculative refactors;
- avoid premature abstractions;
- avoid installing unnecessary dependencies;
- preserve architectural boundaries;
- preserve backward compatibility where relevant;
- stop and report when repository facts contradict the task assumptions.

---

# 10. Harness Maturity Assessment

Rate the current Harness using one of the following levels.

## A — Ready

The project is sufficiently constrained and documented for safe implementation of larger feature work.

## B — Mostly Ready

Only minor documentation or verification improvements are needed.

## C — Partial

The basic structure exists, but a dedicated Harness-hardening phase should happen before Auth v1.

## D — Not Ready

The repository currently presents a high risk of architectural drift, inconsistent implementation, or unsafe autonomous changes.

Support the rating with concrete repository evidence.

Do not rate based on general impressions.

---

# 11. Auth v1 Gap Analysis

Create four sections.

## Already Ready

What already exists and can be reused safely.

## Needs Modification

What exists but must be changed before or during Auth v1.

## Missing

What does not exist yet.

## Risks

Concrete technical, architectural, security, or workflow risks.

---

# 12. Recommended Task Sequence

Recommend a sequence of small, independently verifiable tasks.

Use identifiers such as:

```text
H-001 ...
H-002 ...
A-001 ...
A-002 ...
A-003 ...
```

Where:

- `H-*` = Harness / project infrastructure tasks;
- `A-*` = authentication implementation tasks.

Do not place the entire authentication system into one task.

Each task should have:

- one clear objective;
- defined scope;
- expected verification;
- obvious dependency relationships.

Prefer tasks that can be reviewed and committed independently.

---

# 13. Open Questions and Decisions

List only questions that genuinely require a product or architecture decision.

Do not ask questions that can be answered directly from the repository.

For every open question, explain why the decision matters.

---

# Constraints

During this audit:

- do not modify application source code;
- do not modify project documentation;
- do not modify the database schema;
- do not create migrations;
- do not install dependencies;
- do not configure Google OAuth;
- do not configure SMTP;
- do not create authentication pages;
- do not generate secrets;
- do not commit;
- do not push.

Only use read-only or diagnostic commands that do not change repository state.

If a command may modify files, caches, lockfiles, generated code, or repository state, do not run it.

---

# Required Final Report Structure

Return one structured report with these sections:

1. Executive Summary
2. Repository Overview
3. Frontend State
4. Backend State
5. Database State
6. Existing Authentication State
7. Email Readiness
8. Google OAuth Readiness
9. Security Baseline
10. Testing and Verification
11. Harness Audit
12. Harness Maturity Rating
13. Auth v1 Gap Analysis
14. Recommended Task Sequence
15. Open Questions / Decisions Needed

Support important conclusions with concrete file paths, configuration, or code references.

Do not guess.

When something cannot be established from the repository, explicitly write:

`Not found`

or:

`Cannot be determined from the current repository`

Finish the report with:

**Ready for review.**
