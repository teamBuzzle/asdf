# goldeye

An **agentic development environment** (ADE) — a desktop workspace for running
coding agents like Claude Code, Codex, and Gemini CLI against your repositories,
in parallel, each in its own isolated worktree.

An IDE assumes a human types every edit. An ADE assumes agents do the typing and
a human does the reviewing, so it is built around a different set of primitives:

- **Worktree per task.** Each agent gets an isolated checkout, so parallel work
  never collides in one working directory.
- **Bring your own agent.** Claude Code, Codex, Gemini CLI and other terminal
  agents run as ordinary child processes. No lock-in to a single vendor.
- **Terminal and diff side by side.** Watch what an agent is doing, then review
  the diff it produced without leaving the window.
- **Native, not a browser tab.** Tauri gives a small binary with real filesystem
  and process access.

> Status: early. The shell, quality gates and architecture are in place; the
> feature surface is not yet.

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

## Prerequisites

- Node 22+ and pnpm
- Rust stable (`rustup`), with the `clippy` and `rustfmt` components
- Xcode Command Line Tools (macOS)

## Commands

```sh
pnpm install
pnpm tauri dev        # run the desktop app
pnpm tauri build      # bundle a release build

pnpm lint             # biome check, including the import boundary rules
pnpm lint:fix         # biome check --write
pnpm typecheck        # tsc --noEmit
pnpm knip             # unused files, exports and dependencies
pnpm rust:fmt         # cargo fmt
pnpm rust:lint        # cargo clippy -D warnings
pnpm rust:test        # cargo test
```

## Architecture

Layers depend downward only, and the boundaries are enforced by `biome.json`
rather than by convention — a cross-layer import fails `pnpm lint`.

```
app/          shell: routing, providers, global layout, i18n
  ↓
features/     vertical slices — the unit of deletion
  ↓
components/   shared presentational components (ui/ is shadcn)
  ↓
lib/          pure helpers
ipc/          the only module allowed to call Tauri
```

On the Rust side, `commands/` stays thin and the logic lives in domain modules,
so it can be tested without a Tauri runtime.

Full rules: [`.claude/rules/architecture.md`](.claude/rules/architecture.md).

## Quality gates

Git hooks are managed by husky.

- **pre-commit** — `lint-staged`: biome on staged JS/TS/JSON/HTML, rustfmt on
  staged Rust, then a project-wide `typecheck` and `knip`.
- **commit-msg** — commitlint, Conventional Commits.
- **pre-push** — `cargo clippy -D warnings` and `cargo test`.

## Notes

- Tailwind v4 owns `src/index.css`; biome does not lint CSS because it cannot
  parse `@theme` / `@custom-variant`.
- `src/components/ui/**` is excluded from knip: shadcn components are a library
  surface and are expected to be unused until needed.
- Base UI composes via a `render` prop, not Radix's `asChild`.

## License

MIT
