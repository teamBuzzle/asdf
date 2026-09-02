# goldeye

Tauri 2 + React 19 desktop app. An AI development environment.

@.claude/rules/architecture.md

## Commands

```sh
pnpm tauri dev                # run the app
pnpm lint / lint:fix          # biome, includes the layer boundary rules
pnpm typecheck                # tsc --noEmit
pnpm knip                     # unused files, exports, dependencies
pnpm rust:lint                # cargo clippy -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Gates

pre-commit runs `lint-staged`: biome → rustfmt → `pnpm typecheck` → `pnpm knip`,
serially, on the staged snapshot. commit-msg runs commitlint (Conventional
Commits). pre-push runs clippy. All of these must stay green; do not add
`--no-verify` to a workflow.

## Conventions

- Package manager is pnpm. Never use npm or yarn here.
- Add shadcn components with `npx shadcn@latest add <name>` — do not hand-write
  them into `src/components/ui`.
- Base UI composes with a `render` prop, not Radix's `asChild`.
- Tailwind v4 owns `src/index.css`; biome does not lint CSS.
