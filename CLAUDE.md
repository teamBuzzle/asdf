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
| Pull request titles and bodies | English — except the Summary section, which carries a Korean version in a `<details>` block |
| Issue titles and bodies | English |
| README, CLAUDE.md, rules, ADRs | English |
| Branch names | English |
| UI strings | Neither — they go in `src/app/i18n.ts` as translation resources |

Chat with the user stays in whatever language the user writes. Only artifacts
that land in the repository or on GitHub are English.

Never hardcode user-facing text in a component. Add a key to
`src/app/locales/en.json`, translate it in the other locale files, and read it
with `t()`. Those files are the only place non-English text belongs.

### Shipped locales

| Locale | Why |
|---|---|
| `en` | Default and fallback. Also covers India, the second-largest developer population, which works in English. |
| `ko` | Team language |
| `zh-CN` | China — top 5 developer population |
| `ja` | Japan |
| `es` | Spanish |
| `pt-BR` | Brazil — top 5 developer population |
| `ru` | Russia — top 5 developer population |

That set is closed. The rule was: English, Korean, Chinese, Japanese, Spanish,
plus whatever the five countries with the most developers need. Those five are
the United States, India, China, Brazil and Russia, which the list above covers,
so no further language is added without a new decision.

Regional variants are resolved by i18next rather than shipped: `en-GB` falls to
`en` via `nonExplicitSupportedLngs`, and `pt-PT` and `zh-TW` are mapped onto
`pt-BR` and `zh-CN` by the `fallbackLng` map in `src/app/i18n.ts`. Every locale
file must carry the same key set as `en.json`.

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

| Step | Task | Skill |
|---|---|---|
| 1 | Open the issue | `gh issue create` |
| 2 | New branch | `/new` |
| 3 | Commit and push | `/commit-push` |
| 4 | Create a pull request | `/pr` |

Run them in that order. Step 1 is not a skill because there is nothing to
automate around it — but it is not optional either, and skipping it is the
failure this table exists to prevent.

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

## Review

`main` requires **one approving review**. Force pushes and deletions are
blocked, conversations must be resolved, and the rule applies to administrators.

The review pool is `devxian96` and `Hayoung0708`. `/pr` assigns exactly one of
them at random, minus the author — a person cannot approve their own pull
request, so assigning the author would deadlock the merge. Other collaborators
are not on the rota and are not auto-assigned.

## Issues

This repository does not use Linear. Work is tracked in GitHub Issues.

- **Before the first edit**, search for the issue that covers the work. If none
  exists, write one and start. Do not ask, do not defer it to the end of the
  task, and do not skip it because the change looks small — the issue is what
  says why the change happened, and nobody reconstructs that from a diff a
  month later.
- One issue per concern. A branch that fixes two unrelated things gets two
  issues, and the pull request links both.
- Write the issue as if the reader has not seen the diff: what is wrong today,
  what should be true instead, and an `Acceptance` list specific enough that
  someone else could tell whether it is done.
- Issues use the forms in `.github/ISSUE_TEMPLATE/`, which apply the `type:*` label automatically.
- **Link the issue from the pull request body with `Ref #12`.**
- Use `Closes #12` only when the pull request satisfies every acceptance item on
  that issue. A closing keyword on partial work closes the issue without anyone
  checking the acceptance criteria.

## Open source hygiene

The repository is public, so it carries the files people look for:
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1),
`SECURITY.md`, issue forms and `.github/CODEOWNERS`. Keep them accurate when the
workflow changes — a stale contributing guide is worse than none.

`.github/workflows/ci.yml` runs the full gate set on every pull request and is a
required status check. Never weaken it to make a change pass.

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
