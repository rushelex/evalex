# AGENTS.md

Rules for working in this repository. Each package lives in `packages/`, and each module under `packages/evalex/src/` has its own `AGENTS.md` with rules specific to it.

## Product principles

- A formula can only read what the host passes in. No access to globals, no `eval` or `Function`, no I/O, no timers, no network.
- Apart from reading the current time, the same formula with the same input produces the same result on every machine. evalex never reads the host locale or time zone itself: text a host formatter returns is host input, like the context.
- Everything familiar formula tools can compute, evalex computes too, with the same result. Their syntax is a starting point, not a contract: where another syntax reads better, evalex uses it, so a formula from those tools may need rewriting but never loses a capability. The one exception is precision: a numeric result may be more exact than theirs, never less.
- Never name other formula products, including the ones evalex is modeled on, in code, examples, tests, docs or commit messages. The one exception is comparison benchmarks: they may import the engine they measure against and name it in their code and labels.
- Everything a user can trigger with formula text fails with a `SyntaxError` or a `FormulaError` that points at the part of the formula at fault. A plain `Error` reaching the user is a bug.

## Scope

evalex is a library: the host calls it and keeps its data, storage, rendering and timing. Its job is what formula text means and what it equals on the host's data.

A feature belongs in evalex only when all four hold:

1. It shows in formula text: the formula author writes or reads something differently. Otherwise it belongs to the host.
2. The host cannot do it as well. evalex does better only what needs the parsed formula: dependencies, recalculation order, errors that point into the formula.
3. It works on the shapes JSON has: values, objects and lists. Rows, columns, totals, foreign keys and other domain or storage concepts belong to the host.
4. evalex neither stores nor changes host data.

A feature that fails one of them stays out of the core even when hosts need it. Once two hosts write the same code for it, it may ship outside the core, as a separate entry point or package. Editor adapters are the exception: every host that lets authors write formulas needs an editor, so they ship as packages from the start.

## Public API

- The public surface of `evalex` is its root and `evalex/language`, the entry point for formula editors. Adding, renaming or removing an export, an entry point or a package is an API decision: propose it, don't just do it.
- Every package runs in browsers. No Node.js built-ins in a package's `src/`, outside tests and benchmarks.
- No new runtime dependencies without the owner's approval. Development dependencies need approval too.

## Packages

- All packages share one version and are released together.
- `evalex` is published without a scope, every other package under `@evalexjs`.
- An editor adapter, such as `@evalexjs/codemirror`, turns the language service of `evalex/language` into an extension of one editor and adds no formula behavior of its own. It declares `evalex` and the editor as peer dependencies, so it works on the host's copies of both.
- A package reads another from its source: tests, type-checking and lint run once over the whole repository, without a build.
- An editor adapter has its own `tsconfig.json` with the DOM, and `pnpm typecheck` checks it separately: the root one leaves the DOM out, so evalex never compiles against browser globals.

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
- Until the first release, commits carry no breaking marker (`!`, `BREAKING CHANGE`): the package has no consumers yet.
- Never bypass git hooks. If a hook fails, fix the cause.
- `pnpm audit` must stay clean. Fix a vulnerable transitive dependency by updating its parent first. Only if that fails, add a caret-range override in `pnpm-workspace.yaml` with a comment explaining why.
