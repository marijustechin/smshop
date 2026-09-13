# Task Workflow

Status: **implemented (Harness).**

This document defines how implementation work moves from the roadmap to a
completed, verified task. It is the detailed companion to the constraints in
`AGENTS.md`. The repository — not chat history — is the persistent source of
truth.

## Source-of-truth chain

```text
tasks/TODO.md                     roadmap and current state
    ↓
tasks/current/<task>.md           one active task with defined scope
    ↓
implementation
    ↓
verification (pnpm verify)
    ↓
tasks/done/<completed-task>.md    preserved task record
    ↓
tasks/TODO.md updated             state reflects the completed task
    ↓
completion report                 concise summary to the requester
    ↓
commit only when explicitly requested
```

## Directory structure

```text
tasks/
├── TODO.md          high-level roadmap and current project state
├── template.md      canonical task file format
├── current/         tasks in progress (ideally at most one)
└── done/            completed task records, kept for engineering history
```

`tasks/TODO.md` is the project navigation and state document. It stays high
level and answers: which milestone are we in, what is being worked on, what has
completed, what comes next, and what remains in the broader roadmap. Detailed
implementation requirements live in individual task files, never duplicated in
the TODO.

## Task file format

Every task uses `tasks/template.md`. The required sections are: Status,
Objective, Context, Dependencies, Scope, Out of Scope, Acceptance Criteria,
Required Verification, and — filled on completion — Implementation Result,
Verification Result, Decisions, Follow-ups, and Completion. Do not turn task
files into verbose work diaries; preserve useful engineering context only.

## Naming convention

Task IDs use a prefix per project area, and filenames are
`<TASK-ID>-<short-kebab-case-name>.md`.

| Prefix   | Area                                   |
| -------- | -------------------------------------- |
| `H-*`    | Harness / development infra            |
| `A-*`    | Authentication                         |
| `CAT-*`  | Catalogue                              |
| `CART-*` | Shopping cart                          |
| `CHK-*`  | Checkout                               |
| `OPS-*`  | Production infrastructure / operations |

`OPS-*` tasks describe production infrastructure and operations work. That work
is owned and implemented in `sm-oracle-infra`; this repository only tracks its
roadmap status (see `tasks/TODO.md`). `OPS-*` history is not recorded in
`tasks/done/` here.

Examples:

```text
H-003-establish-task-workflow.md
A-001-auth-domain-model.md
```

Introduce a new prefix only when a new project area requires it. Completed files
retain the same name. Dates are not required in filenames — git history and the
task's completion metadata provide chronology.

## Lifecycle rules

### Before implementation

1. Read `AGENTS.md`.
2. Read `tasks/TODO.md`.
3. Read the relevant architecture/testing documentation (`docs/`).
4. Read the current task file in `tasks/current/`.
5. Confirm its dependencies are satisfied from repository state.
6. Work only within the task scope.

### During implementation

- Do not make unrelated changes.
- Do not silently expand scope.
- Do not perform speculative refactors.
- Do not create premature abstractions.
- Do not add dependencies without concrete justification.
- Preserve existing architecture boundaries.
- Record newly discovered work as a follow-up (task file and/or `tasks/TODO.md`)
  rather than silently including it.

### Before completion

1. Verify every acceptance criterion.
2. Run the task-specific checks.
3. Run the project-wide gate:

   ```bash
   pnpm verify
   ```

   A task may skip the full gate only if the task file documents a legitimate
   reason it cannot run, and the reason is reported.

4. Run:

   ```bash
   git diff --check
   git status --short
   ```

5. Review the changed file list for unrelated modifications.

### On completion

1. Set the task status to `DONE`.
2. Fill in Implementation Result.
3. Fill in Verification Result.
4. Record relevant Decisions.
5. Record Follow-ups.
6. Move the file from `tasks/current/` to `tasks/done/`.
7. Update `tasks/TODO.md` to reflect the new state.
8. Provide a concise completion report.

A task is not complete until its verification passes.

## Change discipline

When repository facts materially contradict the task assumptions, stop and
report the contradiction instead of forcing the task through. Newly discovered
work normally becomes a follow-up task, not an unannounced addition to the
current one.

## Commit convention

Commit messages are task-oriented for traceability:

```text
<TASK-ID>: <imperative summary>
```

Examples:

```text
H-001: establish project verification gate
A-001: add authentication domain model
```

The traceability chain is:

```text
TODO → task → changes → verification → commit
```

Completing a task and committing it are separate actions. **Do not commit or push
unless explicitly requested.**
