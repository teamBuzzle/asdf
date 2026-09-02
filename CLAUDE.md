# asdf

An agentic development environment (ADE): a Tauri 2 + React 19 desktop app for
running coding agents such as Claude Code, Codex and Gemini CLI against
repositories in parallel, each in its own git worktree.

@.claude/rules/architecture.md

## Language

**Everything written into this repository is in English.** This is a public
repository with a global audience, so a Korean artifact is a wall for most
readers.

| Artifact | Language |
|---|---|
| Commit messages | English |
| Code comments and doc comments | English |
| Pull request titles and bodies | English |
| Issue titles and bodies | English |
| README, CLAUDE.md, rules, ADRs | English |
| Branch names | English |
| UI strings | Neither — they go in `src/app/i18n.ts` as translation resources |

Chat with the user stays in whatever language the user writes. Only artifacts
that land in the repository or on GitHub are English.

Never hardcode user-facing text in a component. Add a key to `src/app/i18n.ts`
and read it with `t()`. That file is the one place non-English strings belong.

## Commands

```sh
pnpm tauri dev                # run the app
pnpm lint / lint:fix          # biome, includes the layer boundary rules
pnpm typecheck                # tsc --noEmit
pnpm knip                     # unused files, exports, dependencies
pnpm rust:lint                # cargo clippy -D warnings
pnpm rust:test                # cargo test
```

## Git and pull requests must go through the skills

Do not run `git` or `gh` directly for branch creation, commit, push, or pull
request creation. The skills apply commitlint, branch
naming, the PR template, reviewer assignment, label assignment and the main
branch guard in one step; calling the CLI directly bypasses all of it.

| Task | Skill |
|---|---|
| New branch | `/new` |
| Commit and push | `/commit-push` |
| Create a pull request | `/pr` |

**Never commit or push to `main`.** It is protected on GitHub: pull requests are
required, force pushes and deletions are blocked, and the rule applies to
administrators. If a commit is requested while on `main`, create a branch with
`/new` first. Do not push to a branch whose pull request is already merged.

**Exception:** only when the user explicitly says to bypass the skills.

Definitions live in `.claude/skills/{new,commit-push,pr}/SKILL.md`.

## Labels

Every pull request carries exactly one `type:*` and one `mode:*` label.

- `type:` — feat, fix, refactor, chore, docs, test, style, ci, perf
- `mode:` — `mode:ai` (AI drove the work), `mode:human` (a human drove it),
  `mode:mixed` (both contributed substantially)

Pull request bodies fill in `.github/pull_request_template.md`.

## Issues

This repository does not use Linear. Work is tracked in GitHub Issues.

- If a change touches files, find the issue first; if none exists, create one
  and start. Do not ask — create it.
- Issues carry a `type:*` label and follow `.github/ISSUE_TEMPLATE.md`.
- **Link the issue from the pull request body with `Ref #12`.**
- Use `Closes #12` only when the pull request satisfies every acceptance item on
  that issue. A closing keyword on partial work closes the issue without anyone
  checking the acceptance criteria.

## Gates

pre-commit runs `lint-staged`: biome → rustfmt → `pnpm typecheck` → `pnpm knip`,
serially, on the staged snapshot. commit-msg runs commitlint. pre-push runs
clippy and `cargo test`. All of these must stay green; never add `--no-verify`
to a workflow.

## Conventions

- The package manager is pnpm. Never use npm or yarn here.
- Add shadcn components with `npx shadcn@latest add <name>` — do not hand-write
  them into `src/components/ui`.
- Base UI composes with a `render` prop, not Radix's `asChild`.
- Tailwind v4 owns `src/index.css`; biome does not lint CSS.
