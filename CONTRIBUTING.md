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
- Xcode Command Line Tools (macOS) or Visual Studio Build Tools 2022 with the
  "Desktop development with C++" workload (Windows), so node-pty can compile
- Xcode Command Line Tools (macOS)

```sh
pnpm install
pnpm dev
```

## Before you open a pull request

```sh
pnpm lint
pnpm typecheck
pnpm knip
pnpm test
pnpm build
```

The git hooks run most of this for you, and CI runs all of it. Do not use
`--no-verify`.

## Architecture

Layers depend downward only and the boundaries are enforced by `biome.json`, so
a cross-layer import fails `pnpm lint` rather than being caught in review. Read
[`.claude/rules/architecture.md`](.claude/rules/architecture.md) before adding a
directory — in particular, features never import each other, and only
`src/ipc/**` may reach the main process.

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

## Releases

Versioning is automatic and driven by your commit messages, so the type prefix
is not decoration:

| Commit | Version effect |
|---|---|
| `fix:` | patch — `0.1.0` → `0.1.1` |
| `feat:` | minor — `0.1.0` → `0.2.0` |
| `feat!:` or a `BREAKING CHANGE:` footer | minor while below 1.0, major after |
| `chore:`, `docs:`, `ci:`, `style:`, `test:` | none |

[release-please](https://github.com/googleapis/release-please) keeps a
`chore(main): release x.y.z` pull request open and rewrites it as commits land
on `main`. It bumps `package.json` and writes `CHANGELOG.md`.

Nothing ships until a human merges that pull request. Merging it tags the
release and publishes a GitHub release; a matrix build then attaches installers
for macOS (Apple Silicon and Intel), Windows and Linux, along with the signed
`latest.json` the in-app updater reads.

You never edit a version number by hand.

## Reporting bugs

Use the issue forms. A version or commit hash and an operating system make the
difference between a report someone can act on and one that sits open.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
