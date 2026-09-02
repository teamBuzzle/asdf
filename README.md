<div align="center">

# goldeye

**An agentic development environment.**

Run Claude Code, Codex, and other CLI coding agents side by side —
each in its own git worktree, each with its own terminal and diff.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](#getting-started)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-CE422B.svg)](https://www.rust-lang.org)
[![Status](https://img.shields.io/badge/status-early%20development-orange.svg)](#status)

</div>

## Status

Early development. The application shell, architecture and quality gates are in
place; the agent-facing features described below are the roadmap, not shipped
behavior. There is no release build yet — run it from source.

## Why an ADE and not an IDE

An IDE assumes a human types every edit. Its primitives follow from that: a
cursor, a file tree, a language server, one working directory.

An agentic development environment assumes agents do the typing and a human does
the reviewing. Different assumption, different primitives:

| | IDE | ADE |
|---|---|---|
| Unit of work | A file you are editing | A task an agent is running |
| Concurrency | One working directory | One worktree per task |
| The human's job | Writing | Reviewing and steering |
| What needs to be visible | Code and errors | What the agent did, and why |

goldeye is built around the second column.

## Planned

- **Worktree per task.** Each agent runs against an isolated checkout, so
  parallel work never collides in a single working directory.
- **Bring your own agent.** Terminal agents run as ordinary child processes.
  No lock-in to one vendor's model or CLI.
- **Terminal and diff together.** Watch an agent work, then review the diff it
  produced without switching windows.
- **Reviewable output.** Diffs annotated with what the agent was asked to do.
- **Native, not a browser tab.** Tauri gives a small binary with real
  filesystem and process access.

### Agents

The intent is that any CLI agent works, because they are just processes:
[Claude Code](https://claude.com/claude-code),
[Codex](https://openai.com/codex/),
[Gemini CLI](https://github.com/google-gemini/gemini-cli),
[opencode](https://opencode.ai), and others.

## Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust) |
| UI | React 19 + Vite 7 + TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui on Base UI (`base-nova` preset) |
| Icons | lucide-react |
| i18n | i18next + react-i18next |
| State helpers | immer |
| Validation | zod |
| Control flow | ts-pattern |
| Rich text | Tiptap 3 |

## Getting started

### Prerequisites

- Node 22+ and [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs) stable, with the `clippy` and `rustfmt` components
- Xcode Command Line Tools (macOS)

```sh
rustup component add clippy rustfmt
```

### Run

```sh
pnpm install
pnpm tauri dev
```

### Build

```sh
pnpm tauri build
```

## Project layout

Layers depend downward only, and the boundaries are enforced by `biome.json`
rather than by convention — a cross-layer import fails `pnpm lint`.

```
src/
├─ app/          shell: routing, providers, global layout, i18n
├─ features/     vertical slices — the unit of deletion
├─ components/   shared presentational components (ui/ is shadcn)
├─ lib/          pure helpers
└─ ipc/          the only module allowed to call Tauri

src-tauri/src/
├─ lib.rs        Builder assembly only
├─ error.rs      one serializable error type
├─ commands/     #[tauri::command] — thin
└─ <domain>/     the actual logic, testable without Tauri
```

Full rules: [`.claude/rules/architecture.md`](.claude/rules/architecture.md).

## Development

```sh
pnpm lint          # biome, including the import boundary rules
pnpm lint:fix      # biome check --write
pnpm typecheck     # tsc --noEmit
pnpm knip          # unused files, exports and dependencies
pnpm rust:fmt      # cargo fmt
pnpm rust:lint     # cargo clippy -D warnings
pnpm rust:test     # cargo test
```

Git hooks run these automatically:

- **pre-commit** — biome and rustfmt on staged files, then `typecheck` and `knip`
- **commit-msg** — [Conventional Commits](https://www.conventionalcommits.org)
- **pre-push** — `cargo clippy -D warnings` and `cargo test`

## Contributing

English is the working language of this repository — commit messages, code
comments, pull requests and issues. See [`CLAUDE.md`](CLAUDE.md) for the full
conventions, including the branch and pull request workflow.

## License

[MIT](LICENSE)
