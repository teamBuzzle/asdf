# Contributing to asdf

Thanks for taking the time. This document covers what you need to send a change
that can be merged.

## Language

English, for everything that lands in the repository: commit messages, code
comments, pull requests and issues. The one exception is the Summary section of
a pull request, which carries a Korean translation in a collapsible block
alongside the English — the maintainers are Korean-speaking, the audience is
not, and this way neither side has to read a machine translation.

UI copy is different: it never goes in a component. Add the key to
`src/app/locales/en.json` and translate it in the other locale files.

## Setup

- Node 22+ and [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs) stable with `clippy` and `rustfmt`
- Xcode Command Line Tools (macOS)

```sh
rustup component add clippy rustfmt
pnpm install
pnpm tauri dev
```

## Before you open a pull request

```sh
pnpm lint
pnpm typecheck
pnpm knip
pnpm build
pnpm rust:lint
pnpm rust:test
```

The git hooks run most of this for you, and CI runs all of it. Do not use
`--no-verify`.

## Architecture

Layers depend downward only and the boundaries are enforced by `biome.json`, so
a cross-layer import fails `pnpm lint` rather than being caught in review. Read
[`.claude/rules/architecture.md`](.claude/rules/architecture.md) before adding a
directory — in particular, features never import each other, and only
`src/ipc/**` may call Tauri.

## Commits

[Conventional Commits](https://www.conventionalcommits.org), enforced by
commitlint:

```
feat(workspace): add recent list
fix(ipc): normalize thrown errors into IpcResult
```

## Pull requests

- Branch from `main` as `<type>/<kebab-case-summary>`.
- Fill in the template. Link the issue with `Ref #12`; use `Closes #12` only if
  the pull request satisfies every acceptance item on that issue.
- One `type:*` label and one `mode:*` label. `mode:` records who drove the work:
  `mode:ai`, `mode:human`, or `mode:mixed`.
- `main` requires one approving review and a green CI run. Force pushes and
  branch deletion are blocked.

## Reporting bugs

Use the issue forms. A version or commit hash and an operating system make the
difference between a report someone can act on and one that sits open.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
