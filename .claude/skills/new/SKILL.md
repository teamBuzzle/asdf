---
name: new
description: Create a new git branch from main with auto-generated name based on task description. Use when the user says "new", "새 브랜치", "새 작업", "브랜치 만들어", or wants to start new work.
---

Create a new git branch from the latest `main` branch, with an auto-generated branch name based on the user's task description.

## Steps

### 1. Determine task context

Check if there are uncommitted changes:

```bash
git status
git diff
git diff --cached
```

**Case A — 변경사항이 있는 경우:**

- 변경사항을 분석하여 어떤 작업인지 자동으로 파악한다.
- 분석 결과를 바탕으로 브랜치명을 자동 생성한다.
- 사용자에게 질문하지 않고 바로 진행한다.

**Case B — 변경사항이 없는 경우:**

- 사용자에게 질문한다:

> 어떤 작업을 진행하실 건가요?

- 사용자의 응답을 받은 후 진행한다.

### 2. Generate branch name

Based on the changes analysis or user's description, generate a branch name in the format:

```
<type>/<kebab-case-summary>
```

**Type prefixes:**

| Type       | When to use                                        |
| ---------- | -------------------------------------------------- |
| `feature`  | New functionality or user-facing value             |
| `fix`      | Bug fix for broken behavior                        |
| `refactor` | Internal structure improvement, no behavior change |
| `chore`    | Config, dependencies, CI, maintenance              |
| `docs`     | Documentation changes                              |
| `test`     | Test code additions or improvements                |

**Summary rules:**

- English, lowercase, kebab-case
- 2-4 words max, concise and descriptive
- Describe the what, not the how
- Examples: `add-teacher-search`, `fix-login-redirect`, `update-prisma-schema`

### 3. Create the branch from latest main

Uncommitted changes are automatically carried over to the new branch — no confirmation needed.

```bash
# Fetch latest remote
git fetch origin main

# Create and switch to new branch from origin/main
git checkout -b <type>/<summary> origin/main
```

### 4. Report result

Output:

- Created branch name
- Base point (origin/main at which commit)
- Remind the user what they said they'd work on

Example:

> `feature/add-teacher-search` 브랜치를 생성했습니다. (base: origin/main @ abc1234)
>
> 작업을 시작하세요!

## Important rules

- If there are uncommitted changes, auto-detect the task from changes and generate branch name without asking
- If there are NO changes, ask the user what they want to work on
- ALWAYS branch from `origin/main` (fetch first)
- ALWAYS use the `<type>/<kebab-case-summary>` format
- Keep summary short: 2-4 words in English kebab-case
- If the branch name already exists, append a number suffix (e.g., `feature/add-search-2`)
- Do NOT push the branch — just create it locally
- **NEVER commit directly to main** — 커밋/푸시 요청이 main 브랜치에서 들어오면, 반드시 새 브랜치를 먼저 생성한 후 진행하라. main에 직접 커밋하는 것은 절대 허용하지 않는다.
