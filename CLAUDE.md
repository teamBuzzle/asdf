# goldeye

An agentic development environment (ADE): a Tauri 2 + React 19 desktop app for
running coding agents such as Claude Code, Codex and Gemini CLI against
repositories in parallel, each in its own git worktree.

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

## ⚠️ Git/PR 작업은 반드시 스킬 경유 (의무)

브랜치 생성·커밋·푸시·PR 생성·리뷰 반영을 직접 `git`/`gh` CLI로 실행하지 않는다.
스킬이 commitlint·브랜치 네이밍·PR 템플릿·리뷰어 자동 지정·라벨 자동 부착·main
보호 가드를 일괄 적용하므로, 직접 호출하면 안전 가드가 무너진다.

| 단계 | 사용해야 할 스킬 |
|---|---|
| 새 브랜치 생성 | `/new` |
| 커밋 + 푸시 | `/commit-push` |
| PR 생성 | `/pr` |
| 리뷰 반영 | `/pr-review-apply` |
| PR 라인별 리뷰 | `/pr-review` |

**main 브랜치에 직접 커밋·푸시하지 않는다.** main에서 커밋 요청이 오면 `/new`로
브랜치를 먼저 만든다. 병합된 PR이 붙은 브랜치에도 추가 푸시하지 않는다.

**예외:** 사용자가 "직접 git 써", "스킬 거치지 말고"라고 명시한 경우만.

정의 위치: `.claude/skills/{new,commit-push,pr,pr-review,pr-review-apply}/SKILL.md`

## 라벨

PR에는 `type:*` 하나와 `mode:*` 하나를 반드시 단다.

- `type:` — feat, fix, refactor, chore, docs, test, style, ci, perf
- `mode:` — `mode:ai`(AI 주도), `mode:human`(사람 주도), `mode:mixed`(공동)

PR 본문은 `.github/pull_request_template.md`를 채운다. 제목과 본문은 한국어.

## 이슈 (GitHub Issues)

이 저장소는 Linear를 쓰지 않는다. 작업 추적은 GitHub Issues로 한다.

- 파일을 고치는 일이면 먼저 이슈를 찾고, 없으면 만든 뒤 시작한다. 묻지 말고 만든다.
- 이슈에도 `type:*` 라벨을 단다. 본문은 `.github/ISSUE_TEMPLATE.md` 형식.
- **PR 본문에 `Ref #12`를 적어 이슈를 연결한다.**
- `Closes #12`는 그 PR이 이슈의 Acceptance를 전부 만족할 때만 쓴다. 부분 작업에
  닫는 낱말을 쓰면 완료 조건 검증 없이 이슈가 닫힌다.

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
