# goldeye

Tauri-based AI development environment.

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
- Rust stable (`rustup`), with `clippy` and `rustfmt` components
- Xcode Command Line Tools (macOS)

## Commands

```sh
pnpm install
pnpm tauri dev        # run the desktop app
pnpm tauri build      # bundle a release build

pnpm lint             # biome check
pnpm lint:fix         # biome check --write
pnpm typecheck        # tsc --noEmit
pnpm knip             # unused files, exports and dependencies
pnpm rust:fmt         # cargo fmt
pnpm rust:lint        # cargo clippy -D warnings
```

## Quality gates

Git hooks are managed by husky.

- **pre-commit** — `lint-staged`: biome on staged JS/TS/JSON/HTML, rustfmt on staged Rust, then a project-wide `typecheck` and `knip`.
- **commit-msg** — commitlint, Conventional Commits.
- **pre-push** — `cargo clippy` with warnings denied.

## Notes

- Tailwind v4 owns `src/index.css`; biome does not lint CSS because it cannot parse `@theme` / `@custom-variant`.
- `src/components/ui/**` is excluded from knip: shadcn components are a library surface and are expected to be unused until needed.
- Base UI composes via a `render` prop, not Radix's `asChild`.
