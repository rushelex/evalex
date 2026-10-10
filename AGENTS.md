# AGENTS.md

Rules for working in this repository. Each module under `src/` has its own `AGENTS.md` with rules specific to it.

## Product principles

- A formula can only read what the host passes in. No access to globals, no `eval` or `Function`, no I/O, no timers, no network.
- Apart from reading the current time, the same formula with the same input produces the same result on every machine. Results never depend on the host locale or time zone.
- Where evalex differs from familiar formula tools, it differs only by doing more: richer syntax or extra optional arguments. For input those tools accept, evalex never does less or something different. The one exception is precision: a numeric result may be more exact than theirs, never less.
- Never name other formula products, including the ones evalex is modeled on, in code, examples, tests, docs or commit messages.
- Everything a user can trigger with formula text fails with a `SyntaxError` or a `FormulaError` that points at the part of the formula at fault. A plain `Error` reaching the user is a bug.

## Public API

- The package root export is the only public surface. Adding, renaming or removing an export is an API decision: propose it, don't just do it.
- The library runs in browsers. No Node.js built-ins in `src/`, outside tests and benchmarks.
- No new runtime dependencies without the owner's approval. Development dependencies need approval too.

## Issues

- Before writing any code, check the open GitHub issues (`gh issue list --state open`) for every one that touches the task. There can be several.
- Compare what each of them asks for with what the task asks for, and with each other. Resolve every difference before writing code; if the right choice isn't clear, ask the owner.
- A commit says `Fixes #N` in its body for each issue it fully resolves, so pushing it closes them. For an issue it covers only in part, it says `Refs #N`, and that issue stays open.

## Changes and tests

- Every behavior change comes with tests. A failing case is pinned by a test that was seen failing first.
- Changing the expectation of an existing test is a behavior change. Get approval before doing it.
- When behavior visible to users changes, update the README of the affected module in the same commit.

## Language

- Code, comments, tests, docs and commit messages are in English, American spelling.

## Git

- Work on `main` directly. No feature branches or pull requests unless asked.
- Commits follow Conventional Commits, imperative mood, at most seven words in the subject.
- Never bypass git hooks. If a hook fails, fix the cause.
- `pnpm audit` must stay clean. Fix a vulnerable transitive dependency by updating its parent first. Only if that fails, add a caret-range override in `pnpm-workspace.yaml` with a comment explaining why.
