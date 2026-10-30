<div align="center">

# evalex

**A typed formula language for TypeScript apps — parse it, evaluate it, keep it reactive.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/rushelex/evalex/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/rushelex/evalex/actions/workflows/ci.yml?query=branch%3Amain+event%3Apush)
[![Coverage](https://codecov.io/gh/rushelex/evalex/graph/badge.svg)](https://codecov.io/gh/rushelex/evalex)

</div>

---

evalex lets the people using your product write formulas like `price * quantity * (1 - discount)`, and gives your code a safe way to run them and an editor to write them in.

## Packages

| Package | What it does | Docs |
| --- | --- | --- |
| [`evalex`](./packages/evalex) | Parses and evaluates formulas, and answers formula editors as a formula is typed | [README](./packages/evalex/README.md) |
| [`@evalexjs/codemirror`](./packages/codemirror) | Makes a CodeMirror 6 editor an editor of formulas: colors, errors, fixes, completion and tooltips | [README](./packages/codemirror/README.md) |
| [`@evalexjs/prosemirror`](./packages/prosemirror) | Puts formulas into a ProseMirror document, inline or as blocks, with the same colors, errors, fixes, completion and tooltips | [README](./packages/prosemirror/README.md) |
| [`@evalexjs/tiptap`](./packages/tiptap) | Puts the formulas of `@evalexjs/prosemirror` into a Tiptap editor as one extension | [README](./packages/tiptap/README.md) |

All packages are released together, with one version.

## Development

You need Node.js 26 and pnpm 12. `.nvmrc` names the Node.js version for nvm or fnm, and pnpm downloads it on its own when it is missing.

| Command | What it does |
| --- | --- |
| `pnpm build` | Bundles every package into its `dist/` with tsdown |
| `pnpm test` | Runs the Vitest suite, the unit tests both on the native `Temporal` and on `temporal-polyfill` |
| `pnpm bench` | Builds, then runs benchmarks in Node and in headless Chromium |
| `pnpm typecheck` | Type-checks without emitting |
| `pnpm lint` / `pnpm lint:fix` | Lints, or lints and fixes |

Tests, type-checking and lint run once over the whole repository; a package imports another from its source, so a change shows in every package without a build. Git hooks run type-checking and lint on commit, and `pnpm audit` plus tests on push. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## License

[MIT](./LICENSE) © Aleksey Shelementev
