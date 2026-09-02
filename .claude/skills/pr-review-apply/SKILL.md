---
name: pr-review-apply
description: 본인 PR이 받은 리뷰 코멘트를 분석해 반영·반박 중 하나로 자동 처리하고 rebase로 기존 커밋을 직접 수정. 워크스페이스 루트에서 인자 없이 호출되면 모든 sub-repo의 본인 OPEN PR을 자동 발견해 리뷰가 있는 PR을 자동 처리. 사람 개입 지점 없이 끝까지 자동 진행. Use when the user says "pr-review-apply", "리뷰 반영", "리뷰 반영해", "review apply", "PR 리뷰 반영", "모든 PR 리뷰 반영".
---

본인 PR이 받은 리뷰 코멘트를 코드 재분석 후 처리하고, rebase로 관련 커밋을 직접 수정한다.

## 핵심 원칙

- **사람 개입 지점 없음** — 자동/단일 모드 모두 끝까지 자동 진행. BLOCKED·HOLD·"사용자 판단 대기" 같은 정지 지점은 두지 않는다. 정책상 모호한 케이스는 정해진 자동 결정 규칙(§1.5.1 timestamp tie-break, §3 근거 부족 시 APPLY 전환, §5.1 라운드 한도 종결)으로 무조건 결정한다.
- **본인 PR만 대상** — author가 현재 사용자가 아니면 그 PR만 스킵 (전체 모드는 계속)
- **각 코멘트마다 자율 판단** — 반영(APPLY) / 반박(REBUT) 중 하나. "보류(HOLD)"는 사용하지 않는다 (즉시 결정).
- **반박 시 근거 자료 필수** — 코드 인용, 라인 번호, 패턴 참조, 문서 링크 중 2개 이상. 부족하면 자동으로 반영(APPLY)으로 전환.
- **rebase로 커밋 직접 수정** — 새 "fix" 커밋 추가 금지. fixup + autosquash로 원래 커밋에 합친다
- **반응 이모지로 동의도 표현** — `pr-review` 스킬의 이모지 정책 준용
- **다중 프로젝트 자동 스캔(§0)** — 본인 PR 외 처리 금지, main/master force-push 금지. rebase 충돌은 §1.5.1로 자동 해결, 충돌 PR은 결과 보고에만 표기하고 다음 PR로 진행.
- **충돌 시 최신 내용 우선** — rebase 충돌은 §1.5.1의 timestamp tie-break로 더 최근 commit 쪽을 자동 채택. 보안·인증·migration·CI 같은 민감 경로도 동일 정책으로 자동 결정하되, 회고록(§9.5)에 "민감 경로 자동 머지" 항목으로 반드시 기록해 사용자가 사후 확인할 수 있게 한다.

## Steps

### 0. 다중 프로젝트 자동 스캔 모드 (auto-discover)

**진입 조건 (셋 중 하나 — 사용자 확인 없이 즉시 자동 모드 진입):**

- PR 번호 인자가 없고 현재 디렉토리가 Git 리포가 아님 (워크스페이스 루트)
- 사용자가 "모든 PR", "전체 PR", "all", "all PR" 같은 키워드로 호출
- 호출 컨텍스트가 워크스페이스 멀티 레포 (`CLAUDE.md` 상단에 "멀티 레포 작업 공간" 명시)

**스캔 절차:**

1. 워크스페이스 루트의 Git 리포 sub-디렉토리 자동 발견

    ```bash
    WORKSPACE_ROOT=$(pwd)
    REPOS=$(find . -mindepth 2 -maxdepth 2 -type d -name ".git" \
      | xargs -n1 dirname | sed 's|^\./||' | sort -u)
    ```

    또는 워크스페이스 `CLAUDE.md`의 Sub-Projects 테이블에서 디렉토리 명을 파싱한다.

2. 각 리포에서 본인 OPEN PR 목록 수집 (병렬 권장)

    ```bash
    ME=$(gh api user --jq '.login')
    for repo in $REPOS; do
      ( cd "$WORKSPACE_ROOT/$repo" && \
        gh pr list --author "@me" --state open \
          --json number,title,headRefName,isDraft \
          --jq ".[] | . + {repo:\"$repo\"}" )
    done
    ```

    - `gh` 인증 안 된 리포 / `gh` 호출 실패 → 그 리포만 스킵, 결과 보고에 `SKIPPED (gh error)` 기록
    - PR이 0건이면 그 리포는 조용히 스킵

3. PR마다 미해결 리뷰 스레드 존재 여부 확인 (§2 GraphQL 쿼리 활용)
    - `reviewThreads.nodes` 중 `isResolved == false` 이고 첫 코멘트 작성자 ≠ 본인이고 마지막 코멘트 작성자 ≠ 본인인 스레드가 1건 이상이면 처리 큐에 추가
    - 0건이면 스킵 (조용히, 결과 보고에 `NO_REVIEW` 한 줄)

4. 처리 큐의 각 PR을 순서대로 §1~§10 자동 실행
    - 각 PR 처리 전 `cd "$WORKSPACE_ROOT/$repo"` 로 이동
    - 각 PR마다 §1의 PR 번호와 브랜치 checkout을 자동 수행 (사용자 확인 없음)
    - **BLOCKED 발생 시 그 PR만 스킵하고 다음 PR로 진행** (전체 모드를 중단하지 않음)
    - PR이 base보다 뒤쳐졌으면 §1.5로 자동 최신화. rebase 충돌은 §1.5.1 자동 해결 시도(timestamp tie-break 포함). 보안 가드 매칭(`auth`/`secret`/`token`/`migration`/CI)만 그 PR 스킵하고 다음 PR로 진행 (충돌 PR은 사용자 보고용 큐에 적재)

5. 모든 PR 처리 완료 후 통합 결과 보고 (§10 형식의 PR별 행 + 전체 요약 라인)

**환경 자동 정리 (각 sub-repo 진입 직전):**

`pr-review-apply`는 사람 개입 지점을 두지 않는다. 호출 시점에 sub-repo가 다음 상태라도 자동으로 비파괴 정리한다.

| 발견 상태                                                                    | 자동 정리 절차                                                                                                          | 정리 시점                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| working tree dirty (modified · untracked)                                    | `git stash push -u -m "pr-review-apply auto: preserve <ts>"`                                                            | 진입 직전                    |
| OMC 런타임이 계속 쓰는 modified (`.omc/state/*.json` 등 stash 후에도 재발생) | 해당 파일들에 `git update-index --skip-worktree` 적용                                                                   | stash 후에도 dirty 유지될 때 |
| `.git/rebase-merge/` 잔여물 (이전 미완료 rebase)                             | `_pra-rescue/<branch>-<unix-ts>` 임시 브랜치를 `ORIG_HEAD` 또는 현재 detached HEAD에 생성해 보존 → `git rebase --abort` | 잔여물 발견 시               |
| 같은 브랜치를 메인이 점유 중인 PR (worktree add 불가)                        | 메인을 잠시 main 브랜치로 이동 → PR 브랜치는 worktree에서 처리 → 처리 후 메인을 원래 브랜치로 복귀                      | 해당 PR 진입 직전            |
| OMC `.omc/sessions/` 등 untracked 디렉토리                                   | `.git/info/exclude` 에 패턴 추가(append-only). 사용자의 `.gitignore`는 건드리지 않음                                    | 진입 직전                    |

**복원 절차 (전체 자동 모드 종료 직전, 또는 단일 PR 처리 종료 직전):**

```bash
# 1. skip-worktree 해제
git ls-files -v | awk '/^S/ {print $2}' | while read f; do git update-index --no-skip-worktree "$f"; done
# 2. stash pop (해당 stash가 살아있다면)
git stash list | grep -F "pr-review-apply auto: preserve" | head -1 | sed 's/:.*//' | xargs -I{} git stash pop {}
# 3. _pra-rescue/* 브랜치는 그대로 둠 — 결과 보고에 위치만 표기 (사용자가 사후에 cherry-pick / 삭제 결정)
```

복원 단계는 **사용자에게 묻지 않는다**. 모든 환경 자동 정리는 결과 보고의 "환경 자동 정리 로그" 섹션(§10)에 적혀, 사용자가 사후에 `_pra-rescue/*` 임시 브랜치 등을 살펴볼 수 있다.

**자동 모드에서 유지되는 안전 가드:**

- 본인 PR 외 절대 처리 안 함 (§1)
- main/master force-push 금지 (§4-4)
- `--no-verify`, `git push --force` 금지 (§4-4)
- BLOCKED 케이스(§5.1 예외) 발생 시 해당 PR만 스킵, 사용자 보고
- draft PR은 auto-merge 자동 스킵 (§9)
- PR이 base보다 뒤쳐진 경우 자동 최신화 의무 (§1.5)
- rebase 충돌은 §1.5.1 패턴별 자동 해결 시도 (1~4번 패턴 → 5번 timestamp tie-break) → 보안 가드 매칭만 사용자 보고
- `git rebase --skip` 절대 금지 (데이터 손실 위험)

**자동 모드 비활성 케이스 (단일 PR 모드로 fallback):**

- 사용자가 PR 번호를 명시적으로 지정 → §1로 직행
- 현재 디렉토리가 단일 Git 리포 + 인자 없음 → 현재 브랜치의 PR 1건만 처리 (§1로 직행)

### 1. 대상 PR 확인 및 권한 검증

```bash
# 자동 모드(§0)면 큐에서 다음 PR을, 단일 모드면 인자 또는 현재 브랜치 PR
PR=${1:-$(gh pr view --json number --jq .number)}
ME=$(gh api user --jq '.login')
AUTHOR=$(gh pr view $PR --json author --jq '.author.login')
```

**중단 조건:**

- `AUTHOR != ME` → "본인 PR만 처리합니다" 출력 후 종료 (자동 모드면 그 PR만 스킵)
- PR 상태가 `MERGED`/`CLOSED` → "이미 닫힌 PR입니다" 출력 후 종료 (자동 모드면 스킵)
- 현재 브랜치가 PR HEAD 브랜치와 다름 → 자동 checkout 시도, 실패 시 그 PR 스킵

### 1.5. PR 최신화 (sync with base) — 의무

PR이 base 브랜치(보통 `main`)에서 뒤쳐졌으면 작업 시작 전 **자동 최신화한다**. 옵션이 아니라 의무.

```bash
BASE=$(gh pr view $PR --json baseRefName --jq .baseRefName)
MERGE_STATE=$(gh pr view $PR --json mergeStateStatus --jq .mergeStateStatus)
```

- `BEHIND` / `DIRTY` / `BLOCKED` → 최신화 필요
- `CLEAN` / `HAS_HOOKS` / `UNSTABLE` → 이미 최신, §2로 진행

**최신화 절차:**

```bash
git fetch origin "$BASE"
GIT_SEQUENCE_EDITOR=: git rebase "origin/$BASE"
```

깔끔히 끝나면 §1.5.2(force-push)로. 충돌 발생 시 §1.5.1.

#### 1.5.1. rebase 충돌 자동 해결 (스킬 의무)

충돌이 났다고 무조건 사용자에게 던지지 않는다. **안전한 패턴은 자동 해결하고**, 정말 의미가 부딪히는 경우만 보고한다.

**자동 해결 패턴 (시도 순서):**

1. **락 파일** (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock*`, `Cargo.lock` 등) → base 우선 후 재생성

    ```bash
    git checkout --theirs "$LOCKFILE"
    git add "$LOCKFILE"
    # rebase 완료 후 패키지 매니저로 lock 재생성
    ```

2. **import-only / export-only 충돌** (양쪽이 서로 다른 import 라인만 추가) → 양쪽 모두 채택. 충돌 마커 사이의 두 hunk를 한 블록으로 합친 뒤 중복 제거.

3. **whitespace / formatting only** (실제 토큰 변경 없음 — diff에 빈 줄·들여쓰기 차이만) → base 우선 (`git checkout --theirs`)

4. **서로 다른 라인 hunk** (양쪽 hunk의 라인 범위가 겹치지 않음) → 양쪽 모두 적용

5. **나머지 모든 충돌 — 최신 내용 우선 (timestamp tie-break)** ⚠️ 보안 가드 동반 필수

    add/add 전체 파일 충돌, 같은 라인 양쪽 수정, 시그니처+호출부 결합 충돌 등 1~4번 패턴으로 안전 결정이 안 되는 경우에도 **충돌 양쪽 commit의 author/committer date를 비교해 더 최근 쪽을 자동 채택**한다. 사용자 정책: "충돌 시 항상 최신 내용 기준".

    파일 단위 (add/add·전체 파일 교체):

    ```bash
    FILE="<conflicted file>"
    OURS_TS=$(git log -1 --format=%ct HEAD -- "$FILE" 2>/dev/null || echo 0)
    THEIRS_TS=$(git log -1 --format=%ct REBASE_HEAD -- "$FILE" 2>/dev/null || echo 0)
    if [ "$THEIRS_TS" -ge "$OURS_TS" ]; then
      git checkout --theirs -- "$FILE"   # rebase 컨텍스트: theirs = 적용 중인 PR commit
    else
      git checkout --ours -- "$FILE"     # ours = base 쪽
    fi
    git add "$FILE"
    ```

    hunk 단위 (같은 라인 충돌):

    ```bash
    # 양쪽 commit의 그 파일에 대한 마지막 author date를 비교해 hunk별로 한쪽 선택
    # 단순 fallback: 파일 단위와 동일하게 더 최근 쪽 전체 채택
    ```

    **민감 경로(`auth`/`secret`/`token`/`crypto`/`webauthn`/`password`/`session`/migration/CI/Dockerfile)도 동일 timestamp 정책으로 자동 결정한다.** 사람 개입 지점을 두지 않는다는 핵심 원칙에 따라 BLOCKED 경로로 빠져나가지 않는다. 다만 **회고록(§9.5)에 \`민감 경로 자동 머지\` 항목으로 기록**해 사용자가 사후에 진단할 수 있게 한다. 회고록 엔트리에는 충돌 파일 경로, 양쪽 commit SHA, timestamp, 채택한 쪽을 명시한다.

    > **안전망 전제:** 본 자동 결정 정책은 회고록(§9.5)의 사후 진단을 1차 안전망으로 삼는다. 민감 경로의 회귀 탐지는 회고록 검토 + 그 경로를 커버하는 CI(e2e/integration) + 운영 모니터링의 조합으로 보완할 것을 권장한다. CI 커버리지가 약한 레포에서는 자동 머지 직후 회고록의 \`민감 경로 자동 머지\` 항목을 즉시 검토하라. CI 부재를 이유로 수동 머지로 회귀하는 분기는 두지 않는다 — 핵심 원칙은 "사람 개입 지점 없음"이고, CI 안전망은 본 스킬의 책임 범위 밖이다.

각 자동 해결 후:

```bash
git add <resolved-files>
# 충돌 마커 잔여 확인 (자동 해결 검증)
git diff --check
grep -nE '^(<{7}|={7}|>{7}) ' <resolved-files> && { echo "ERROR: leftover conflict marker"; exit 1; }
git rebase --continue
```

**자동 해결 실패 → REBASE_DEFER (사용자 결정 필요한 게 아니라 \"이번 자동 사이클에서 더 시도할 게 없음\")**:

1~5번을 모두 시도했는데도 충돌 마커가 남는 극단 케이스(예: `git checkout --ours/--theirs` 명령 자체가 실패하는 손상된 인덱스 등) 한정.

이 경우:

```bash
git rebase --abort
# 결과 테이블에 REBASE_DEFER 표기, 다음 PR로 진행
```

**금지:**

- ❌ `git rebase --skip` — 충돌 hunk 무시는 데이터 손실. 절대 금지
- ❌ **timestamp 비교나 1~4번 패턴 같은 명시 근거 없이** 임의로 `--ours` / `--theirs` 선택 — 코드 회귀. 5번의 timestamp 기반 선택은 허용
- ❌ 충돌 자동 해결 후 결과를 검증하지 않고 push — 자동 해결한 파일은 한 번 더 `git diff --check` + grep으로 충돌 마커(`<<<<<<<`, `=======`, `>>>>>>>`) 잔여 확인 후 push
- ❌ 민감 경로 충돌이라며 BLOCKED로 사용자 보고 — 이 스킬은 사람 개입 지점을 두지 않는다. timestamp 정책으로 자동 결정 + 회고록 기록

#### 1.5.2. 최신화 후 force-push

rebase로 history가 바뀌었으면 즉시 force-with-lease push (§4-4와 동일 절차):

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ] && { echo "ERROR: main 보호"; exit 1; }
git push --force-with-lease origin "$CURRENT_BRANCH"
```

이후 §2로 진행. 최신화 단계에서 push가 발생했어도 별도 답글이나 회고록 작성은 하지 않는다 (리뷰 코멘트 처리 후 한 번만).

### 2. 미해결 리뷰 코멘트 수집

```bash
gh api graphql -f query='
  query($owner:String!, $repo:String!, $number:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$number) {
        reviewThreads(first:100) {
          nodes {
            id
            isResolved
            isOutdated
            comments(first:50) {
              nodes {
                databaseId
                author { login }
                body
                path
                line
                originalLine
                diffHunk
                commit { oid }
              }
            }
          }
        }
      }
    }
  }' -F owner={owner} -F repo={repo} -F number=$PR
```

**처리 대상 필터:**

- `isResolved == false` (이미 해결된 건 스킵)
- 첫 코멘트 작성자 ≠ 본인 (내가 자기 PR에 단 코멘트는 제외)
- 마지막 코멘트 작성자가 본인이 아님 (이미 답한 건 스킵 — 새 답글이 달리면 재처리)

**이미 outdated인 스레드 처리:**

- `isOutdated == true` + 본인이 답하지 않은 경우 → 코드를 다시 보고 실제 반영됐는지 확인
    - 반영됨 → "이미 후속 커밋에서 반영됨 (SHA 인용)" 답글 + resolve
    - 미반영 → 일반 처리 흐름으로 진행

### 3. 각 코멘트 분류 (반영 / 반박)

각 미해결 코멘트마다 코드 재분석 후 분류한다. **보류(HOLD)는 사용하지 않는다** — 정보 부족·외부 합의 대기 같은 케이스도 즉시 결정한다 (정보 부족 → APPLY로 안전하게 반영하거나 REBUT으로 사유 명시).

| 분류            | 판단 기준                                              | 처리                               |
| --------------- | ------------------------------------------------------ | ---------------------------------- |
| **반영(APPLY)** | 지적이 타당하고 변경 비용이 합리적, 또는 분류가 모호함 | 코드 수정 + 답글 + 이모지          |
| **반박(REBUT)** | 지적 근거가 잘못됨, 의도된 동작, 트레이드오프상 부적절 | 답글에 **근거 자료 필수** + 이모지 |

**P5 코멘트 처리 (칭찬·질문·의견)**

P5는 변경 강제가 아니지만 그냥 지나치지 않는다 — 답글로 즉시 결정하고 작성자가 resolve한다. 칭찬·질문·의견 셋 중 어느 톤인지에 따라 처리가 다르다.

| P5 종류 | 판단 기준                                                   | 처리                                                                                          |
| ------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 칭찬    | "🎉/👏/✨" 같은 이모지 + "좋다/탁월하다" 류 표현            | 짧은 감사 답글 (구체적으로 어느 결정이 평가받았는지 한 문장) + `heart`/`+1` + resolve         |
| 질문    | "왜 X로 했나요?", "Y 고려했어요?" 같은 비강제 맥락 질문     | 답변 답글 (의도·트레이드오프 1~2문장) + `+1`/`eyes` + resolve. 코드 변경 없음                 |
| 의견    | "이런 방향도 가능", "다음 PR에서 봐주시면" 같은 비강제 제안 | 즉시 검토 후 두 갈래: 채택→APPLY로 분류 전환(§4), 채택 보류→짧은 사유 답글 + `eyes` + resolve |

**P5 의견 채택 판단 기준 (즉시 결정)**

- **채택(APPLY 전환)**: 변경 비용이 작고(±20라인 내), 본 PR 범위 안에서 마무리 가능, 의견의 방향이 명확함
- **채택 보류**: 변경 범위가 본 PR을 넘어가거나 별도 설계 결정이 얽힌 경우. 답글에 "별도 이슈/PR로 다룸"을 명시하고 가능하면 후속 이슈 링크 첨부

P5 질문/의견에 답할 때도 한글, 존댓말, 차분한 톤 유지. "보류합니다", "필요한 정보" 같은 HOLD 어휘는 사용하지 않는다.

**반박은 근거 자료 의무화**

근거에 다음 중 **2개 이상** 포함:

- 코드 인용 (`path:line` + 코드 블록)
- 기존 패턴 참조 (다른 파일에서 동일 패턴 사용 사례)
- 프로젝트 룰 인용 (`.claude/rules/*.mdc` 항목)
- 외부 문서 링크 (공식 docs, RFC, 표준)
- 트레이드오프 분석 (대안 X, Y 비교)

근거가 부족하면 강제로 분류를 **반영(APPLY)** 으로 전환한다. 사람 개입을 두지 않으므로 "보류 후 재검토" 같은 fallback도 없다.

### 4. 반영(APPLY) 처리 — rebase로 기존 커밋 직접 수정

**새 "fix: review feedback" 커밋을 추가하지 않는다.** 지적된 라인의 원인 커밋을 찾아 그 커밋을 직접 수정한다.

#### 4-1. 원인 커밋 찾기

```bash
# 코멘트가 가리키는 파일+라인의 원인 커밋
TARGET_COMMIT=$(git blame -L <line>,<line> <file> | awk '{print $1}')
# blame 결과가 PR 범위 밖(main 등) 커밋이면 → 새 커밋 필요 (예외)
```

PR 범위 안 커밋이면 그 커밋에 fixup 한다. 범위 밖이면 §4-3로.

#### 4-2. 코드 수정 + fixup 커밋

```bash
# 1) 코드 수정 (Edit 도구로)
# 2) fixup 커밋 생성
git add <file>
git commit --fixup=$TARGET_COMMIT

# 3) PR 베이스 브랜치로부터 autosquash rebase
BASE=$(gh pr view $PR --json baseRefName --jq .baseRefName)
GIT_SEQUENCE_EDITOR=: git rebase --autosquash --interactive origin/$BASE
```

**주의: `GIT_SEQUENCE_EDITOR=:`** — 에디터 안 띄우고 자동 진행. autosquash가 fixup을 원래 커밋에 합친다.

rebase 충돌 발생 시 **§1.5.1 자동 해결 절차를 시도한다.** 락 파일·whitespace·import-only·서로 다른 라인 hunk는 패턴별 자동 해결, 그 밖의 충돌은 5번 timestamp tie-break(더 최근 commit 우선)로 자동 채택. 보안 가드(`auth`/`secret`/`token`/`migration`/CI 설정 등) 매칭 충돌만 사용자 보고. 자동 모드(§0)에서는 보안 가드 매칭 PR만 스킵하고 다음 PR로 진행.

#### 4-3. 원인 커밋이 PR 범위 밖인 경우

main 등 베이스 브랜치 커밋을 수정할 수 없으므로 새 커밋을 만든다 (예외 케이스).

```bash
git add <file>
git commit -m "fix: <리뷰 반영 내용 요약> (review #<comment_id>)"
```

이 케이스는 결과 보고에 `EXCEPTION (base commit)` 으로 표시.

#### 4-4. force push

rebase 후 history가 바뀌므로 force-push 필요. **반드시 `--force-with-lease` 사용** (다른 사람이 푸시한 게 있으면 안전하게 거부됨).

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# main 보호
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "ERROR: main/master 브랜치에는 force-push 금지"
  exit 1
fi

git push --force-with-lease origin $CURRENT_BRANCH
```

**금지:**

- ❌ `git push --force` (단순 force) — 항상 `--force-with-lease`
- ❌ main/master 브랜치 force-push
- ❌ commit hooks 우회 (`--no-verify`)

#### 4-5. 답글 + 이모지

```bash
# 답글 (스레드의 마지막 코멘트에 reply)
gh api repos/{owner}/{repo}/pulls/$PR/comments/<comment_id>/replies -X POST \
  -f body="반영했습니다. <간단한 설명> ($(git rev-parse --short HEAD))"

# 이모지 반응 — 반영 동의 표시
gh api repos/{owner}/{repo}/pulls/comments/<comment_id>/reactions -X POST -f content="+1"
gh api repos/{owner}/{repo}/pulls/comments/<comment_id>/reactions -X POST -f content="rocket"
```

#### 4-6. APPLY 후 즉시 resolve (작성자 책임)

**APPLY 처리는 답글 + 커밋 SHA 인용 + 즉시 resolve로 종결한다.** 반영 책임은 작성자에게 있고, 매 사이클마다 리뷰어가 다시 들어와 resolve해 줄 때까지 기다리면 흐름이 끊긴다. 따라서 작성자가 자기 PR의 스레드를 직접 resolve한다.

```bash
# 답글 후 그 스레드 resolve (GraphQL)
gh api graphql -f query='
  mutation($threadId:ID!) {
    resolveReviewThread(input:{threadId:$threadId}) { thread { id isResolved } }
  }' -f threadId="$THREAD_ID"
```

**자동 resolve 대상:**

- APPLY: 코드 수정 + force-push + 답글까지 끝냈으면 즉시 resolve
- 후속 커밋에서 이미 반영된 outdated 스레드(§2의 isOutdated == true): "이미 후속 커밋에서 반영됨" 답글 후 resolve
- §5.1 REBUT_FINAL: 답글 후 즉시 resolve (라운드 한도 종결)

**resolve하지 않는 경우:**

- §5 REBUT (반박 진행 중): 리뷰어 응답을 기다려야 함. resolve 보류.
- 다른 사람이 단 코멘트 스레드(공동 PR 등): 권한 있어도 건드리지 않음 — 코멘트 주인에게 우선권.

**리뷰어가 다시 열고 싶으면 unresolve로 돌릴 수 있다.** 작성자 resolve가 영구적 결정이 아니므로 부담 없이 진행. 반영이 잘못됐다면 리뷰어가 재오픈 + 새 답글로 이어가면 된다.

### 5. 반박(REBUT) 처리

코드 수정 없음. 답글에 근거 자료 포함.

```bash
gh api repos/{owner}/{repo}/pulls/$PR/comments/<comment_id>/replies -X POST -f body="<답글 본문>"
```

**답글 형식:**

```
<반박 입장 — 한 문장>

**근거**
1. <근거 1: 코드 인용 path:line 또는 패턴 참조>
2. <근거 2: 룰 인용 또는 문서 링크>

<선택: 트레이드오프 / 대안 / 추후 논의 제안>
```

**이모지 — 정중한 부동의:**

```bash
gh api repos/{owner}/{repo}/pulls/comments/<comment_id>/reactions -X POST -f content="eyes"
```

resolve는 **하지 않는다** — 반박 진행 중이라 리뷰어 응답을 기다려야 함. 라운드 한도 도달 시 §5.1 REBUT_FINAL로 종결되면서 그때 작성자가 resolve한다.

### 5.1. 의견 충돌 종결 프로토콜 (작성자 우선)

리뷰어 재반박에 답글 왕복이 길어지면 무한 토론 대신 **회차 한도에서 작성자 입장으로 종결**한다.

**라운드 한도**

§2의 `reviewThreads.comments`로 발언자별 코멘트 수를 센다.

- **나(작성자)의 답글 ≤ 2회**
- **리뷰어 발언 ≤ 2회** (정책 — `pr-review` §8.3.1과 미러)

내 답글이 2회에 도달했는데 리뷰어가 또 답글을 보내왔다면, 그 내용을 **새 근거 평가**만 한 뒤 종결한다.

**REBUT_FINAL 처리**

리뷰어 마지막 답글 평가:

| 결과                                  | 처리                                  |
| ------------------------------------- | ------------------------------------- |
| 새 코드 인용·룰·외부 문서가 있고 타당 | 분류 변경: **반영(APPLY)**, §4로 진행 |
| 같은 주장의 반복이거나 새 근거 부족   | **반박 종결(REBUT_FINAL)** 답글 1회   |

REBUT_FINAL 답글 형식:

```
앞서 드린 답글의 근거에서 추가로 보강할 자료는 없습니다. 이번 PR은 현재 구현을 유지하고 머지하겠습니다. 추가 논의는 별도 이슈로 이어가면 감사하겠습니다.

(선택) **후속**
- <별도 이슈/PR 링크 또는 "별도 이슈 발행 예정">
```

- 한글, 존댓말, 차분한 톤
- 이모지: `eyes` 1개
- **답글 직후 작성자가 resolve** — 라운드 한도 종결이므로 더 이상 토론 라운드를 늘리지 않는다. 리뷰어가 동의 안 하면 unresolve 후 새 답글로 이어가도록 함.

**P1·보안·CI 우려도 자동 결정**

이전 버전에는 `[P1]`/`auth`/`secret`/`compliance`/CI 키워드가 있으면 BLOCKED으로 사용자에게 넘겼다. 새 정책(사람 개입 지점 없음)에서는 BLOCKED 경로를 두지 않는다. 다음과 같이 처리한다:

- **`[P1]` + 새 근거 있음** → 분류 변경: APPLY, §4 진행
- **`[P1]` + 새 근거 없음** → REBUT_FINAL 답글 1회로 마무리 (회고록에 \`P1 자동 종결\` 항목으로 기록해 사용자가 사후 검토 가능)
- **보안·CI 우려 키워드 포함** → 위와 동일. 회고록에 \`민감 키워드 자동 종결\` 항목 추가
- auto-merge는 그대로 활성화 (BLOCKED 조건 자체가 사라졌음)

**처리 흐름 요약**

```
새 근거 있고 타당 → 반영(APPLY) §4
새 근거 없음 + 내 답글 < 2회 → 반박(REBUT) §5 (근거 보강)
새 근거 없음 + 내 답글 ≥ 2회 → REBUT_FINAL 답글 1회, auto-merge 유지
P1/보안/CI 우려 → REBUT_FINAL로 자동 종결 + 회고록 기록 (BLOCKED 경로 없음)
```

### 6. 보류 분류는 사용하지 않음 (자동 결정)

이 스킬은 **HOLD 분류를 사용하지 않는다**. "추가 정보·외부 결정 대기" 같은 사유로 처리를 미루지 않으며, 모든 코멘트는 즉시 APPLY 또는 REBUT으로 분류한다.

- 정보가 부족해 분류 모호 → §3 룰에 따라 **APPLY 로 자동 전환** (코드 수정 후 결과는 회고록에 기록)
- 외부 팀/디자이너 결정이 명시적으로 필요 → 그 결정의 잠정 디폴트를 작성자가 정하고 APPLY (이후 별도 이슈로 추적, 답글에 이슈 링크 포함)

기존 코드/문서에 `### 6. 보류(HOLD) 처리` 류 분기가 있다면 이 절차로 대체한다. 작성자 답글에 \"보류합니다\", \"필요한 정보\" 같은 표현은 사용하지 않는다.

### 7. 이모지 반응 가이드 (동의도)

`pr-review` 스킬의 §8 이모지 정책을 작성자 입장에서 미러링한다.

| 분류                          | 동의도 | 사용 가능 이모지        |
| ----------------------------- | ------ | ----------------------- |
| 반영(APPLY) — 전적 동의       | 높음   | `+1`, `rocket`, `heart` |
| 반영(APPLY) — 일부 변형 반영  | 중간   | `+1`, `eyes`            |
| 반박(REBUT)                   | 낮음   | `eyes` (정중한 부동의)  |
| 반박 종결(REBUT_FINAL)        | 낮음   | `eyes`                  |
| P5 칭찬                       | 감사   | `heart`, `+1`           |
| P5 질문 — 답변 가능           | 응답   | `+1`, `eyes`            |
| P5 의견 — 채택해 APPLY로 전환 | 동의   | `+1`, `rocket`          |
| P5 의견 — 채택 보류           | 검토   | `eyes`                  |

**자율 판단**: 분위기와 PR 톤에 맞게 자연스럽게 선택. 과한 이모지 남발 금지 (코멘트당 최대 2개).

**금지:** `confused`, `-1` 같은 부정적 이모지는 사용하지 않는다 (반박은 답글 본문으로).

### 8. 리뷰어 재요청

반영(APPLY)이 1건 이상 있으면 원 리뷰어를 재요청해서 후속 리뷰를 유도한다.

```bash
ORIG_REVIEWERS=$(gh api repos/{owner}/{repo}/pulls/$PR/reviews --jq '[.[].user.login] | unique | .[]')
for r in $ORIG_REVIEWERS; do
  [ "$r" = "$ME" ] && continue
  gh pr edit $PR --add-reviewer $r
done
```

반박(REBUT/REBUT_FINAL)만 있는 경우 재요청 생략 (리뷰어가 답글 보고 다음 액션 결정).

### 9. Auto-merge 활성화

작성자는 직접 `gh pr merge` 하지 않는다. 대신 **GitHub Auto-merge**를 활성화해서 "모든 조건(리뷰어 approve + 모든 스레드 resolve + CI 통과 + 브랜치 보호 규칙)이 만족되면 자동 병합"되도록 둔다. 작성자가 APPLY/REBUT_FINAL 직후 resolve를 끝내므로(§4-6, §5.1) 보통 머지 트리거는 **리뷰어 approve + CI 통과** 시점에 걸린다.

```bash
# auto-merge 활성화 (squash 방식)
gh pr merge $PR --auto --squash --delete-branch
```

**조건:**

- 이번 실행에 APPLY가 1건 이상 있었거나, 이미 auto-merge 대기 상태가 아닌 경우에만 활성화
- PR이 draft면 활성화하지 않음 (draft 해제 후 수동으로)
- 본인 PR이므로 `author == ME` 이미 §1에서 검증됨
- BLOCKED 조건은 폐지 — 사람 개입 지점을 두지 않으므로 모든 PR에 일관되게 활성화

**레포 정책:**

- `--squash` 가 기본. 레포가 merge commit을 선호하면 `--merge`, rebase 히스토리를 원하면 `--rebase`로 전환
- `--delete-branch` 는 병합 후 브랜치 자동 삭제 (레포 기본 설정과 일치하는지 확인)

**auto-merge가 안 되는 케이스 (경고만 출력, 진행은 계속):**

- 레포 브랜치 보호 규칙에서 auto-merge 비활성화됨 → `Auto-merge is not enabled for this repository` 에러 → 결과 보고에 `AUTO_MERGE_SKIPPED (repo policy)` 표기
- PR이 draft 상태 → 결과 보고에 `AUTO_MERGE_SKIPPED (draft)` 표기

**금지:**

- ❌ `gh pr merge $PR --squash` (즉시 병합, `--auto` 없이) — 작성자 self-merge 금지
- ❌ 조건 미달인데 강제 병합 시도

### 9.5. 회고록 작성 (CLAUDE.local.md)

반영(APPLY)된 리뷰 코멘트는 같은 실수를 반복하지 않도록 **현재 레포의 `CLAUDE.local.md`에 회고록을 누적 작성**한다.

**대상 파일**

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
LOCAL_MD="$REPO_ROOT/CLAUDE.local.md"
[ -f "$LOCAL_MD" ] || touch "$LOCAL_MD"
```

워크스페이스 루트가 아닌 **개별 레포 루트**의 `CLAUDE.local.md`를 사용한다 (예: `buzzle-editor/CLAUDE.local.md`). 자동 모드(§0)에서는 각 PR이 속한 sub-repo 루트가 자동으로 잡힌다.

**기록 대상**

- **반영(APPLY)** 으로 분류된 모든 코멘트 → 필수
- **민감 경로 자동 머지** (§1.5.1 5번이 보안/migration/CI 경로에 적용된 경우) → 필수, 충돌 파일·양쪽 SHA·timestamp·채택한 쪽 기록
- **P1·보안·CI 우려가 REBUT_FINAL로 자동 종결된 항목** → 필수 (사용자 사후 진단용)
- **REBUT / REBUT_FINAL** → 선택 (같은 지적 재발 시 근거 빨리 찾기 위함)

**기록 형식 (append, 새 PR마다 새 섹션)**

```markdown
## 리뷰 회고 — YYYY-MM-DD PR #<번호> (<제목>)

### [P<n>] <파일:라인 또는 짧은 주제>

**받은 지적**

> <리뷰 코멘트 핵심 1~2문장>

**원인**
<왜 이런 코드를 썼는지 — 룰 미숙지·패턴 부재·검토 부족 등 솔직하게>

**적용한 변경**
<무엇을 어떻게 바꿨는지 + 커밋 SHA>

**다음부터**
<체크 가능한 행동 1~2개>
```

**작성 원칙**

- **솔직한 원인** — "단순 실수" 같은 면피성 표현 금지. 구체적 인지 실패 지점을 적는다 (예: "`predictability.mdc` 룰을 안 읽음", "기존 패턴 grep 안 함", "unknown 처리 룰을 모름")
- **체크 가능한 다음 액션** — "조심하겠다" 류 다짐 금지. 행동으로 (예: "PR 작업 전 `.claude/rules/*.mdc` 1회 읽기", "새 컴포넌트 시작 전 `grep -r \"useQuery\" src/components` 실행")
- **append-only** — 기존 회고 수정·삭제 금지. 새 PR마다 끝에 추가
- **PR 브랜치에 커밋하지 않는다** — `.gitignore`에 `CLAUDE.local.md` 포함 여부 확인. 누락 시 1회 안내: "개인 메모이므로 `.gitignore`에 `CLAUDE.local.md` 추가를 권장합니다." (스킬은 자동으로 add 하지 않는다)
- **용량 관리** — 50KB 초과 시 사용자에게 알리고 오래된 회고를 별도 파일(`docs/review-retro/<year>-<quarter>.md` 등)로 옮기도록 제안 (자동 이동 안 함)

**스킵 조건**

- APPLY와 §1.5.1 5번 민감 경로 자동 머지·P1 자동 종결이 모두 0건이면 회고 스킵 가능
- `git rev-parse --show-toplevel` 실패(워크스페이스 루트 등 Git 리포 아님) → 그냥 스킵 (안내 답글 없이). 자동 모드(§0)에서는 sub-repo 안에서 호출되므로 이 케이스가 발생하지 않는다.

회고 작성 결과(추가 엔트리 수, `.gitignore` 안내 발생 여부)는 §10 결과 보고에 포함한다.

### 10. 결과 보고

**단일 PR 모드:**

```
| 스레드 | 분류 | 원인 커밋 | 답글 | 이모지 | resolve | retro |
|---|---|---|---|---|---|---|
| #N (작성자) | APPLY/REBUT/REBUT_FINAL | abc1234 / – | ✓ | +1, rocket | ✓ (APPLY/REBUT_FINAL) / – (REBUT, 리뷰어 대기) | ✓ / – |
```

요약 라인:

```
PR #N | APPLY=N REBUT=N REBUT_FINAL=N | rebase: ✓ | force-push: ✓ | re-request: ✓ | retro: ✓ (N entries) | auto-merge: ✓ / SKIPPED(<reason>)
```

**자동 모드(§0) 통합 보고:**

```
## pr-review-apply 자동 스캔 결과

스캔: <리포 수>개 리포, 본인 OPEN PR <총 PR 수>건, 미해결 리뷰 PR <처리 대상 수>건

| 리포 | PR | 제목 | APPLY | REBUT | REBUT_FINAL | sensitive_auto | auto-merge | retro |
|---|---|---|---|---|---|---|---|---|
| buzzle-editor | #123 | feat: ... | 3 | 1 | 0 | 0 | ✓ | ✓ (3) |
| buzzle-landing | #45 | fix: ... | 0 | 2 | 0 | 0 | – (no APPLY) | – |
| buzzle-system | #67 | refactor: ... | 2 | 0 | 1 | 1 | ✓ | ✓ (3) |

**환경 자동 정리 로그 (사용자 사후 확인용, 별도 액션 불필요):**
- 메인 working tree dirty → `pr-review-apply auto: preserve` 이름으로 stash 저장 후 처리 종료 시 pop
- `.git/rebase-merge` 잔여물 → `_pra-rescue/<branch>-<timestamp>` 임시 브랜치로 보존 후 자동 abort
- `.omc/state/*.json` 같은 런타임 modified 파일 → `git update-index --skip-worktree` 적용 (PR 처리 후 해제)

**민감 경로 자동 머지 (§1.5.1 5번 → 회고록 기록됨):**
- buzzle-system #18 `prisma/migrations/2024-foo.sql` → THEIRS 채택 (timestamp: 1714560000 vs 1714400000)
```

`sensitive_auto` 컬럼은 §1.5.1 5번이 보안/migration/CI 경로에 자동 적용된 횟수. 0이 아니면 회고록(§9.5)에서 사후 확인. **사용자 액션 요청 항목은 없다** — 모든 결정은 자동.

## Important Rules

- **NEVER 사람 개입 지점 만들기** — BLOCKED, HOLD, "사용자 판단 대기", "수동 검토 요청" 같은 정지 지점을 두지 않는다. 모호한 케이스는 정해진 자동 결정 규칙(§1.5.1 timestamp tie-break, §3 근거 부족 → APPLY, §5.1 라운드 한도 종결)으로 무조건 결정한다. 결정 결과는 회고록(§9.5)에 기록해 사용자 사후 진단을 가능하게 한다.
- **NEVER 본인이 아닌 PR 처리** — author가 현재 사용자와 다르면 그 PR만 스킵 (전체 모드는 계속)
- **NEVER `git push --force`** — 항상 `--force-with-lease`
- **NEVER main/master 브랜치 force-push** — 보호 브랜치 절대 금지
- **NEVER `--no-verify`** — pre-commit hook 우회 금지. 실패 시 fix 후 재시도
- **NEVER `git rebase --skip`** — 충돌 hunk 무시는 데이터 손실. 자동 해결은 §1.5.1의 1~5번 패턴(특히 5번 timestamp tie-break) 안에서만 수행
- **ALWAYS PR 최신화 의무** — base 브랜치보다 뒤쳐진 PR(`mergeStateStatus = BEHIND/DIRTY/BLOCKED`)은 작업 시작 전 자동 rebase로 최신화한다(§1.5). 사용자 확인 없이 즉시 진행
- **ALWAYS rebase 충돌 자동 해결** — 모든 충돌은 §1.5.1로 자동 해결한다. 1~4번 안전 패턴이 안 맞으면 5번 timestamp tie-break(더 최근 commit 우선)로 무조건 결정. 민감 경로(`auth`/`secret`/`token`/`migration`/CI)도 동일 정책으로 자동 결정하고 회고록에 기록(§9.5). "충돌이라 사용자 결정 필요" 같은 답변은 금지
- **ALWAYS 자동 모드 진입 조건 충족 시 사용자 확인 없이 즉시 진행** — §0의 진입 조건이면 별도 prompt 없이 스캔/처리. 환경 문제(working tree dirty, `.git/rebase-merge` 잔여물, OMC 런타임이 쓰는 `.omc/state/*` 파일 등)는 §0의 환경 자동 정리 절차로 비파괴적 보존 + 자동 정리 + 처리 끝나면 복원
- **ALWAYS rebase로 원래 커밋 직접 수정** — "fix: review feedback" 류의 추가 커밋 만들지 말 것. 단 원인 커밋이 PR 범위 밖일 때만 예외
- **ALWAYS 반박은 근거 자료 2개 이상** — 부족하면 반영(APPLY)으로 전환. HOLD는 사용하지 않음
- **ALWAYS 답글은 한글, 존댓말, 차분하게** — 감정적 표현 금지
- **ALWAYS 반영 후 답글에 커밋 SHA 인용** — 어느 커밋에 반영됐는지 추적 가능하게
- **ALWAYS `pr-review`의 이모지 정책 준용** — `confused`, `-1` 등 부정 이모지 금지
- **ALWAYS 작성자가 resolve (APPLY/REBUT_FINAL/outdated 반영)** — 작성자가 답글 + 커밋 SHA 인용 + resolve까지 끝낸다(§4-6, §5.1). 리뷰어가 다시 봐야 한다고 판단하면 unresolve로 돌리면 되므로 영구적 결정이 아님. REBUT 진행 중인 스레드는 resolve 보류 (리뷰어 응답 대기)
- **NEVER 직접 merge** — `gh pr merge --squash` 류 즉시 병합 금지. 병합은 리뷰어 approve + 조건 만족으로 트리거되는 auto-merge로만 이뤄진다
- **ALWAYS auto-merge 활성화** — APPLY가 1건 이상이거나 이미 auto-merge 대기 상태가 아닌 경우 §9 `gh pr merge --auto --squash --delete-branch` 로 예약. draft PR이면 스킵. 레포가 auto-merge 비활성이면 결과 보고에 `AUTO_MERGE_SKIPPED (repo policy)` 표기. BLOCKED 경로는 폐지됐으므로 별도 스킵 조건 없음
- **ALWAYS 의견 충돌 종결 프로토콜** — 같은 스레드에서 내 답글이 2회에 도달했는데 합의 안 되면 REBUT_FINAL 답글 1회 + 작성자 resolve로 자동 종결(§5.1). P1·보안·데이터 손실·CI 우려도 동일 — 사용자 보고 없이 REBUT_FINAL 종결 + 회고록(§9.5)에 사후 진단 항목으로 기록. 리뷰어가 동의 안 하면 unresolve로 돌려 새 답글로 이어가면 됨
- **ALWAYS APPLY·민감 경로 자동 머지·P1 자동 종결은 CLAUDE.local.md 회고록에 기록** — 같은 실수 반복 방지 + 자동 결정의 사후 진단(§9.5). 솔직한 원인 + 체크 가능한 다음 액션 필수. Git 리포가 아니면(워크스페이스 루트) 스킵 — 자동 모드에서는 sub-repo 안에서 처리되므로 항상 기록됨
