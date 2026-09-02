---
name: commit-push
description: Commit and push changes with commitlint-compliant messages. Blocks direct commits to main branch — automatically creates a new branch first via the "new" skill. Use when the user says "커밋", "푸시", "commit", "push", "커밋푸시", "올려줘", or wants to commit and push changes.
---

Commit staged/unstaged changes with a commitlint-compliant message and push to remote.

**CRITICAL: main 브랜치 보호** — main 브랜치에서는 절대로 커밋/푸시하지 않는다. main에서 감지되면 자동으로 `/new` 스킬을 실행하여 브랜치를 먼저 생성한다.

## Steps

### 1. Check current branch and PR status

```bash
# 현재 브랜치 확인
git rev-parse --abbrev-ref HEAD

# 현재 브랜치에 열린 PR이 있는지 확인
gh pr view --json state,url --jq '.state' 2>/dev/null
```

**다음 경우 `/new` 스킬을 먼저 실행한다:**

**Case A — main 브랜치인 경우:**

> ⚠️ 현재 `main` 브랜치입니다. main에 직접 커밋/푸시할 수 없습니다. 새 브랜치를 생성합니다.

**Case B — 이미 병합된 PR이 있는 브랜치인 경우 (state가 `MERGED`):**

> ⚠️ 현재 브랜치의 PR이 이미 병합되었습니다. 새 브랜치를 생성합니다.

**Note:** PR이 `OPEN` 상태인 경우에는 추가 커밋/푸시를 허용한다. 병합 전까지는 같은 브랜치에서 작업을 계속할 수 있다.

두 경우 모두:

1. `/new` 스킬을 실행하여 새 브랜치를 생성한다. (변경사항이 있으면 자동으로 분석하여 브랜치명을 결정한다)
2. 브랜치 생성이 완료되면 아래 Step 2부터 계속 진행한다.

**그 외:** 바로 Step 2로 진행한다.

### 2. Gather current state

Run these commands in parallel:

```bash
# Check working tree status
git status

# See staged and unstaged changes
git diff
git diff --cached

# Recent commit messages for style reference
git log --oneline -10
```

If there are no changes (clean working tree), inform the user:

> 변경사항이 없습니다. 커밋할 내용이 없어요.

And stop here.

### 3. Stage changes

모든 변경사항을 자동으로 스테이징한다. 사용자에게 확인을 묻지 않는다.

- Stage all changed/untracked files using `git add <specific files>` (avoid `git add -A` or `git add .`)
- 사용자가 별도로 제외를 지시하지 않는 한 모든 파일을 스테이징한다. 바이너리, 생성 파일 등도 포함.
- `.env` 파일만 자동 제외하고 경고한다.

### 4. Generate commit message

Analyze the staged changes and generate a commitlint-compliant commit message.

**Format (Conventional Commits):**

```
<type>(<optional scope>): <description>

<optional body>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Type prefixes:**

| Type       | When to use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature or user-facing functionality |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Formatting, no code logic change         |
| `refactor` | Code restructuring, no behavior change   |
| `perf`     | Performance improvement                  |
| `test`     | Adding or updating tests                 |
| `chore`    | Build, CI, dependencies, maintenance     |

**Commit message rules:**

- Description in English, lowercase start (after the type prefix)
- Keep the subject line under 100 characters
- Imperative mood: "add", not "added" or "adds"
- Scope is optional but recommended for clarity (e.g. `feat(workspace): add recent list`)
- Body is optional — use for complex changes that need explanation
- Always end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

**Examples:**

```
feat: add workspace recent list
fix(ipc): normalize thrown errors into IpcResult
refactor: move terminal state out of React
chore: bump tauri to 2.11
docs: describe the layer boundaries in README
```

생성된 커밋 메시지를 표시하고 바로 진행한다. 확인을 묻지 않는다.

### 5. Quality checks (타입 / 린트 / 빌드)

커밋 전에 반드시 다음 3가지 검사를 **병렬로** 실행한다:

```bash
# 1. TypeScript 타입 검사
pnpm typecheck

# 2. Biome 린트 (레이어 경계 규칙 포함)
pnpm lint

# 3. 미사용 파일/의존성 검사
pnpm knip

# 4. Rust 린트 + 테스트
pnpm rust:lint
pnpm rust:test

# 5. 프로덕션 빌드
pnpm build
```

**CRITICAL: 에러가 하나라도 있으면 절대 커밋하지 않는다.** "기존 코드의 에러", "이번 변경과 무관한 에러" 등의 이유로 에러를 무시하는 것은 금지한다. 모든 에러를 0으로 만든 후에만 커밋을 진행한다.

**결과 처리:**

- **모두 통과 (에러 0개):** Step 6으로 진행한다. warning도 0개여야 한다.
- **하나라도 실패:**
    1. 실패한 검사와 에러 내용을 사용자에게 보여준다:

    > ❌ 품질 검사 실패
    >
    > - TypeScript: ✅ / ❌ (에러 내용)
    > - Biome: ✅ / ❌ (에러 내용)
    > - Knip: ✅ / ❌ (에러 내용)
    > - Clippy / cargo test: ✅ / ❌ (에러 내용)
    > - Build: ✅ / ❌ (에러 내용)
    >
    > 2. 에러를 자동으로 수정한다. 변경된 파일뿐 아니라 프로젝트 전체 에러를 수정해야 한다.
    > 3. 수정 후 실패한 검사만 다시 실행한다.
    > 4. 모두 통과할 때까지 반복한다. (최대 3회 시도)
    > 5. 3회 시도 후에도 실패하면 사용자에게 알리고 **커밋을 중단**한다:

    > ⚠️ 품질 검사를 통과하지 못했습니다. 수동으로 확인해주세요.

### 6. Commit

```bash
git commit -m "$(cat <<'EOF'
<confirmed commit message>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

If the commit fails due to pre-commit hooks (lint-staged), fix the issues and retry with a NEW commit (do NOT use `--amend`).

### 7. Push

```bash
# Push with upstream tracking
git push -u origin $(git rev-parse --abbrev-ref HEAD)
```

### 8. Report result

Output:

- Branch name
- Commit hash (short)
- Commit message
- Push status

Example:

> ✅ 커밋 & 푸시 완료!
>
> - 브랜치: `feature/add-teacher-search`
> - 커밋: `abc1234` — feat: 교사 검색 기능 추가
> - 푸시: `origin/feature/add-teacher-search`

## Important rules

- **NEVER commit or push to `main` branch** — 항상 브랜치 확인 후 진행. main이면 `/new` 스킬로 브랜치 생성 먼저.
- **NEVER push to a branch with a MERGED PR** — PR이 이미 병합된 브랜치에는 추가 커밋/푸시 금지. `/new` 스킬로 새 브랜치 생성 먼저. OPEN 상태 PR은 추가 커밋 허용.
- ALWAYS generate commitlint-compliant messages (Conventional Commits)
- Auto-stage all changes and auto-generate commit message without asking — proceed immediately
- ALWAYS use specific file names with `git add`, never `git add -A` or `git add .`
- NEVER stage `.env` files — warn the user if detected. 그 외 모든 파일은 사용자 지시 없으면 전부 스테이징
- NEVER use `--no-verify` to skip hooks
- NEVER use `--amend` — always create new commits
- If pre-commit hook fails, fix the issue and create a NEW commit
- English only. Commit messages are public and permanent; see the Language section of CLAUDE.md
