---
name: pr-review
description: Pn 규칙(P1-P5) 기반 GitHub PR 라인별 코드 리뷰. Use when the user says "pr-review", "리뷰", "review", "코드 리뷰", "PR 리뷰", or wants to review pull requests.
---

Pn 규칙 기반 GitHub PR 라인별 리뷰를 수행한다.

## Pn 규칙 (뱅크샐러드 코드 리뷰 문화)

| 레벨 | 의미                     | 리뷰어 의도                              |
| ---- | ------------------------ | ---------------------------------------- |
| P1   | 꼭 반영해 주세요         | 머지 전 필수 수정                        |
| P2   | 적극적으로 고려해 주세요 | 권장, 합리적 이유 있으면 패스 가능       |
| P3   | 고려해 주세요            | 의견 제시, 무시 가능                     |
| P4   | 사소한 것 (Nit)          | 오타, 스타일 등                          |
| P5   | 칭찬·질문·의견           | 잘한 점 인정 / 가벼운 질문 / 비강제 의견 |

## Steps

### 1. 리뷰 대상 파악

```bash
# 열린 PR 목록 확인
gh pr list --state open --json number,title,author,headRefName --jq '.[] | {number, title, author: .author.login, branch: .headRefName}'

# 현재 사용자 확인
gh api user --jq '.login'
```

사용자가 특정 PR 번호를 지정하면 해당 PR만 리뷰. 지정하지 않으면 내가 올린 PR을 제외한 모든 열린 PR을 대상으로 한다.

**⚠️ 리뷰어 지정 필수**: PR의 요청된 리뷰어(`reviewRequests`) 목록에 현재 사용자(`gh api user --jq '.login'`)가 포함되지 않은 경우 **리뷰하지 않는다.** 명시적으로 나를 지목한 PR만 리뷰한다. 결과 테이블에 `SKIPPED (리뷰어 아님)`으로 표시.

```bash
# 내가 리뷰어로 지정됐는지 확인
gh pr view <number> --json reviewRequests --jq '.reviewRequests[].login' | grep -Fx "$(gh api user --jq '.login')"
```

**⚠️ 자기 PR 리뷰 절대 금지**: PR의 `author.login`이 현재 사용자(`gh api user --jq '.login'`)와 같으면 **어떤 경우에도 리뷰하지 않는다.** 사용자가 명시적으로 번호를 지정하더라도 자기 PR이면 스킵하고 결과 테이블에 `SKIPPED (본인 PR)`로 표시한다. 본인이 본인 PR에 approve/request_changes를 다는 것은 셀프 승인이므로 정책적으로 허용하지 않는다.

### 1.5. 이전 리뷰 상태 확인 (중복 리뷰 방지)

각 PR에 대해 이전에 내가 작성한 리뷰가 있는지, 그 이후로 변경이 있었는지 확인한다.

```bash
# 내가 쓴 가장 최근 리뷰의 commit_id 조회
MY_LOGIN=$(gh api user --jq '.login')
LAST_REVIEWED_SHA=$(gh api repos/{owner}/{repo}/pulls/<number>/reviews \
  --jq "[.[] | select(.user.login==\"$MY_LOGIN\")] | last | .commit_id")

# 현재 PR HEAD SHA
CURRENT_SHA=$(gh pr view <number> --json headRefOid --jq '.headRefOid')
```

- `LAST_REVIEWED_SHA == CURRENT_SHA` → 마지막 리뷰 이후 변경 없음 → **해당 PR 리뷰 스킵**, 결과 테이블에 `SKIPPED (변경 없음)` 표시. Step 9로 이동.
- `LAST_REVIEWED_SHA` 없음 (첫 리뷰) 또는 SHA가 다름 → Step 2로 진행.

### 1.6. PR 스킬 준수 여부 점검

리뷰 시작 전 PR이 `pr` 스킬 표준에 맞게 만들어졌는지 확인한다. 위반 시 작성자에게 `pr` 스킬 사용을 권장하는 일반 코멘트(이슈 코멘트, 라인 X)를 1회 남긴다. 이미 동일 안내 코멘트가 있으면 중복 등록하지 않는다.

```bash
gh pr view <number> --json labels,assignees,reviewRequests,body --jq '{labels:[.labels[].name], assignees:[.assignees[].login], reviewers:[.reviewRequests[].login], body}'
```

**위반 판정 (하나라도 해당):**

- `type:*` 라벨이 정확히 1개가 아님 (없거나 2개 이상)
- `mode:*` 라벨이 정확히 1개가 아님
- assignee가 비어있음 (작성자 self-assign 미적용)
- reviewer가 비어있음 (리뷰 요청 누락)
- 본문이 PR 템플릿(Summary / Impact / Checks / Review Focus 섹션)을 따르지 않음

**안내 코멘트 예시 (이슈 코멘트로 등록):**

```bash
gh api repos/{owner}/{repo}/issues/<number>/comments -X POST -f body="이 PR은 \`/pr\` 스킬을 사용해서 만든 흔적이 없어 보입니다. 다음 항목이 누락/이상합니다: <목록>. 다음부터는 PR 생성 시 \`/pr\` 스킬을 사용해 주세요. 이번 PR은 \`gh pr edit\` 또는 GitHub UI에서 라벨/assignee/리뷰어/본문 템플릿을 보정 부탁드립니다."
```

체크 결과는 결과 테이블의 `pr-skill` 컬럼에 `OK` / `WARN(N개 누락)` 으로 표기.

### 1.7. 프로젝트 룰 로드

해당 레포의 `.claude/rules/**/*.mdc` (또는 `*.md`)를 **리뷰 시작 전에 반드시 읽는다**. 룰이 있으면 리뷰 판단 기준에 함께 적용한다.

```bash
ls .claude/rules/ 2>/dev/null
# 파일이 있으면 전부 cat/Read로 로드
```

- 룰 파일이 없는 레포(예: `buzzle-system`)는 스킵 — 프로젝트 CLAUDE.md/AGENTS.md만 참고
- 룰 파일이 있으면 **각 룰의 요구사항을 P1~P3 판정 근거로 활용**한다. 룰 위반이 머지 블록급이면 P1, 권장 수준이면 P2, 의견 제시면 P3
- 라인 코멘트에 룰을 인용할 땐 룰 이름을 명시 (예: `[P2] predictability.mdc 위반 — ...`)

### 2. PR diff 분석

각 PR에 대해:

```bash
# 커밋 SHA
gh pr view <number> --json headRefOid --jq '.headRefOid'

# 변경 파일 목록
gh pr diff <number> --name-only

# 전체 diff
gh pr diff <number>
```

diff를 읽고 다음을 파악한다:

- 무엇이 변경되었고 왜
- 기존 프로젝트 패턴과의 일관성
- 잠재적 버그나 엣지케이스

### 3. 리뷰 판단 기준

**중요: 억지로 문제를 찾지 않는다.** 진짜 문제만 지적한다.

- 실제 버그, 기능 회귀 → P1
- 컨벤션 위반 (ESLint 룰 실패 등) → P1 또는 P2
- 패턴 불일치, 개선 권장 → P2 또는 P3
- 코드 중복, 리팩토링 제안 → P3
- 오타, 네이밍, 스타일 → P4
- 잘 작성된 코드, 좋은 설계 → P5 (칭찬)
- 단순 호기심·맥락 확인 질문 ("이 부분 X 때문에 그렇게 하신 건가요?", "Y 패턴 고려해보셨어요?") → P5 (질문)
- 변경 강제 아닌 가벼운 의견 ("이런 방향도 가능할 것 같아요", "다음 PR에서 한 번 봐주시면 좋을 것 같아요") → P5 (의견)

**P5 칭찬 코멘트를 반드시 포함한다.** 잘한 점을 인정하는 것도 리뷰의 중요한 부분이다. P5 질문/의견은 선택 — 칭찬만 달리는 게 부담스러우면 자연스러운 질문이나 가벼운 의견으로 채워도 좋다. 단 변경을 요구하는 어조면 P3 이상으로 올려야 한다 (P5의 핵심: 변경 강제 없음).

### 4. 리뷰 결과 판정

뱅크샐러드 코드 리뷰 문화(https://blog.banksalad.com/tech/banksalad-code-review-culture/) 기준을 따른다.

- **P1·P2·P3 중 하나라도 있으면** → `REQUEST_CHANGES`
- **P4·P5만 있거나 아무 이슈도 없으면** → `APPROVE`

즉 `APPROVE`는 "P4/P5만 존재하는 경우"에만 허용된다. P2(적극 고려)·P3(고려)가 남아있으면 무조건 `REQUEST_CHANGES` — 작성자가 반영 또는 의견 교환 후 재리뷰받도록 한다.

### 5. GitHub 리뷰 생성

`gh api`로 라인별 코멘트가 포함된 리뷰를 생성한다.

```bash
gh api repos/{owner}/{repo}/pulls/{number}/reviews \
  --method POST \
  -f commit_id="<SHA>" \
  -f body="<리뷰 요약>" \
  -f event="<REQUEST_CHANGES|APPROVE>" \
  -f 'comments[0][path]=<file>' \
  -f 'comments[0][line]=<line_number>' \
  -f 'comments[0][side]=RIGHT' \
  -f 'comments[0][body]=[P1] 설명...'
```

**`line`은 변경 후 파일의 실제 라인 번호**이다. diff의 `+` 라인에서 `@@ -a,b +c,d @@` 헤더를 기준으로 계산한다.

**⚠️ 모든 Pn 코멘트(P1~P5)는 반드시 라인 코멘트로 등록한다.** body에 나열해 두는 것은 금지. 라인 번호 계산은 리뷰어의 책임이며 건너뛰어서는 안 된다. P5 칭찬·질문·의견 모두 그 대상 코드/라인에 달아야 한다.

- 라인 번호 계산법:
    1. `gh pr diff <n>` 에서 해당 파일 hunk의 `@@ -a,b +c,d @@` 헤더를 찾는다
    2. `c`부터 시작해서 hunk 내 ` `(context) 및 `+`(added) 라인을 세며 대상 라인까지 내려간다 (`-`는 카운트 안 함)
    3. 그 숫자가 `line` 값
- diff에 나타나지 않은(변경 없는) 라인을 가리켜야 하는 경우에는 `line`이 허용되지 않는다. 이 경우 **가장 가까운 변경 라인**을 지정하고 코멘트 본문에서 "참고: L123 근처"처럼 명시한다
- 다중 라인 범위가 필요하면 `start_line` + `line` + `start_side=RIGHT` + `side=RIGHT` 사용
- 라인 단위로 붙일 수 없는 **구조적/전체적 논평**(예: 파일 구성, 아키텍처)만 body에 둔다. 구체 코드에 대한 지적은 반드시 라인 코멘트

### 6. 리뷰 본문(body) 형식

```
### 리뷰 요약
(잘한 점과 개선 사항을 간결하게 — P5 먼저, 이슈 나중)
```

### 7. 라인 코멘트 형식

각 코멘트는 `[Pn]` 접두사로 시작한다:

```
[P1] 설명 — 왜 문제인지, 어떻게 고치면 좋은지
[P5] 🎉 칭찬 — 구체적으로 무엇이 좋은지
[P5] 질문 — <맥락 확인 질문, 답변 강제 아님>
[P5] 💡 의견 — <비강제 제안, 무시 가능>
```

- 한글로 작성
- 문제 코멘트: 원인 + 개선 방안 상세 설명
- **P5 칭찬**: 구체적으로 무엇이 좋은지 설명. **본문에 반드시 이모지를 1개 이상 포함한다** (예: 🎉 👏 ✨ 🔥 💯 🙌 👍 🚀). 분위기에 맞게 자연스럽게 섞어 쓴다.
- **P5 질문**: 맥락이나 결정 배경이 궁금할 때 사용. 답변을 강제하지 않으며, 작성자가 답하지 않아도 머지에 영향 없음. 톤은 차분하고 비공격적 (예: "이 부분 X로 한 이유가 있을까요?", "Y 케이스도 고려하셨나요?"). 변경을 요구하는 뉘앙스면 P3로 올려야 함.
- **P5 의견**: 변경 강제하지 않는 가벼운 제안. "이런 방향도 가능", "다음 PR에서 봐주시면" 정도. 작성자가 무시해도 OK. 강한 권장이면 P3.

**로직 수정 제안 시 Before/After 코드 필수**

코드 로직 변경을 제안하는 모든 P1·P2·P3 코멘트에는 아래 형식으로 **변경 전/후 코드 블록**을 반드시 포함한다. 단순 네이밍/오타(P4)나 칭찬(P5)은 제외.

````markdown
[P2] <설명 — 무엇이 문제이고 왜 바뀌어야 하는지>

**Before**

```ts
const foo = items.filter((i) => i.active).map((i) => i.id)[0];
```

**After**

```ts
const foo = items.find((i) => i.active)?.id;
```

<선택: 추가 설명, 트레이드오프, 대안>
````

- 언어 태그는 실제 파일 확장자에 맞춘다 (`ts`, `tsx`, `js`, `jsx`, `css`, `prisma` 등)
- Before는 현재 PR의 해당 라인을 **그대로** 인용한다 (임의 생략/단순화 금지)
- After는 실제로 동작하는 코드여야 한다 — 타입/임포트/시그니처가 프로젝트 패턴과 일치하는지 확인
- GitHub [suggestion 블록](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request#adding-line-comments-to-a-pull-request)( ` ```suggestion `)을 쓸 수 있는 케이스(단일 라인 대체)면 After 대신 suggestion 블록을 사용해도 좋다

### 8. 이모지 반응

PR 본문(작성자의 글)에 이모지 반응을 추가한다:

```bash
# APPROVE한 PR
gh api repos/{owner}/{repo}/issues/{number}/reactions --method POST -f content="+1"
gh api repos/{owner}/{repo}/issues/{number}/reactions --method POST -f content="rocket"

# REQUEST_CHANGES한 PR
gh api repos/{owner}/{repo}/issues/{number}/reactions --method POST -f content="eyes"
```

**자기 코멘트에 자기가 이모지를 달지 않는다.** 상대방의 글(PR 본문)에만 반응한다.

### 8.3. 내 리뷰에 달린 답글 대응 (토론 이어가기)

내가 남긴 리뷰 코멘트에 **다른 사람이 질문하거나 반박**한 스레드가 있으면, 코드를 다시 정밀 분석하고 답글을 단다.

```bash
# 1) 모든 리뷰 스레드 + 코멘트 작성자/내용 조회
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
                createdAt
                path
                line
              }
            }
          }
        }
      }
    }
  }' -F owner={owner} -F repo={repo} -F number=<number>
```

**대응 대상 스레드 판별:**

- `isResolved == false` **그리고** `isOutdated == false`
- 스레드 첫 코멘트 작성자 == 나 (내가 시작한 스레드)
- **마지막 코멘트 작성자 ≠ 나** (상대가 마지막으로 말했고 내가 아직 답하지 않음)
- 상대 코멘트 본문이 질문(`?`, "왜", "근거", "이유", "확인", "맞나요" 등) 또는 반박("아닙니다", "이게 맞", "의도한", "필요", "다름", "하지만" 등)으로 해석됨

**재분석 후 답글 작성:**

1. 해당 파일·라인과 주변 맥락을 다시 읽는다 (`gh pr diff` + 필요하면 원본 파일 fetch).
2. 상대 의견이 타당한지 판단한다.
    - **타당하면**: 내 이전 판단을 철회하고 인정한다. 이후 해당 스레드는 resolve 해도 된다.
    - **타당하지 않으면**: 구체적 근거(라인 번호, 코드 인용, 패턴 참조)를 들어 재반박한다.
    - **정보 부족**: "판단 보류" 분기는 사용하지 않는다. 추가 정보가 필요해 보여도 즉시 결정한다 — 정보 부족 → 안전하게 인정·철회 (작성자 입장 존중) 또는 §8.3.1 라운드 한도 종결로 마무리.
3. 답글은 스레드에 댓글로 추가 (리뷰 이벤트가 아닌 개별 댓글):

```bash
gh api repos/{owner}/{repo}/pulls/<number>/comments/<comment_id>/replies \
  --method POST \
  -f body="<답글 본문>"
```

**답글 톤 & 형식:**

- 한글, 존댓말, 차분하고 근거 중심
- 인정할 때는 명확히 인정 (`말씀대로 ~ 맞습니다. 제 이전 코멘트는 철회합니다.`)
- 반박할 때는 `[Pn]` 접두사 사용하지 않음 (리뷰 등급이 아닌 토론)
- 감정적 표현, 단정적 어조 피함
- 필요시 관련 파일/라인 인용으로 근거 제시

**하지 않는 일:**

- 타인이 시작한 스레드에는 묻지 않은 이상 끼어들지 않는다
- 내 스레드라도 상대가 아직 답하지 않았는데 먼저 추가 코멘트를 달지 않는다
- 반박할 때 같은 코드를 피상적으로 다시 설명만 하지 않는다 — **반드시 재분석 후** 근거 보강
- **무대응 금지** — 작성자가 REBUT 답글을 보낸 상태(작성자가 resolve 안 한 케이스)에서 내버려두면 auto-merge가 트리거되지 않는다. 반드시 동의·재반박·종결 셋 중 하나로 처리. 작성자가 APPLY/REBUT_FINAL로 자기 resolve까지 끝낸 케이스는 별도 대응 필요 없음 (필요 시 unresolve로 다시 열기)

답글 처리한 스레드 수는 결과 보고에 포함한다.

### 8.3.1. 의견 충돌 종결 프로토콜 (작성자 우선)

토론이 길어지면 무한 왕복 대신 **회차 한도에서 작성자 판단을 존중**하며 종결한다.

**라운드 한도**

§8.3에서 조회한 `reviewThreads.comments`로 각 스레드의 발언자별 코멘트 수를 센다.

- **리뷰어(나)의 발언 ≤ 2회** — 시작 코멘트 + 재반박 1회까지만
- **작성자의 답글 ≤ 2회**

내 발언이 이미 2회에 도달했는데 작성자가 동의하지 않은 상태로 답글을 또 보내왔다면, **새로운 반박을 만들지 않는다.** 종결 답글 1회 + resolve로 마친다.

**종결 답글 형식**

```
근거는 앞서 드린 답글에 정리돼 있고, 이번 PR에서 추가로 보강할 자료는 없습니다. 작성자 판단을 존중하고 이 스레드는 종결하겠습니다. 추가 논의는 별도 이슈로 이어가도 좋겠습니다.
```

- 한글, 존댓말, 차분한 톤
- `[Pn]` 접두사 사용 안 함
- 답글 직후 해당 스레드를 **resolve** (내가 단 스레드이므로 §8.4 원칙 안에서 허용)
- 등급 자동 다운그레이드 없음 — 이번 PR 한정 종결만

**P1·보안·CI 우려도 자동 종결 (BLOCKED 폐지)**

이전 버전에는 P1·보안·CI 우려는 BLOCKED로 사용자에게 보고했다. 새 정책(사람 개입 지점 없음)에서는 이 분기를 두지 않는다. 동일하게 §8.3.1 종결 답글 + resolve로 마무리하고, **결과 테이블의 `Yielded` 컬럼과 별도로 `sensitive_yield` 표기**를 남겨 사용자가 사후에 진단할 수 있게 한다. (P1/보안/CI 키워드가 매칭됐을 때 자동 카운트.)

**작성자가 REBUT_FINAL을 보낸 경우 (apply §5.1)**

작성자가 종결 답글(`현재 구현을 유지하고 머지하겠습니다`)을 보냈다면 자동으로 처리되지 않고 **리뷰어가 명시적으로 후속 액션을 한다**:

1. 답글의 근거를 다시 읽고 동의 여부 판단
2. 판단에 따른 처리:

| 판단                                    | 처리                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| 작성자 입장 타당                        | 인정 답글 + resolve (자기 의견 철회)                                                      |
| 부당하지만 내 발언 ≥ 2회 (등급 무관)    | 본 §8.3.1 종결 답글 + resolve. P1·보안·CI 매칭이면 결과 테이블에 `sensitive_yield` 카운트 |
| 부당하지만 내 발언 < 2회 + 새 근거 있음 | 재반박 (라운드 한도 내)                                                                   |

**resolve를 빠뜨리지 말 것** — 작성자가 APPLY/REBUT_FINAL 직후 resolve하는 게 원칙(§8.4)이지만, 작성자가 REBUT으로 답글만 보낸 상태(아직 합의 미정)라면 그 스레드는 작성자가 resolve하지 않는다. 이 표의 처리에 따라 리뷰어가 동의·재반박·종결 후 resolve까지 끝내야 auto-merge가 트리거된다.

**처리 흐름 요약**

```
재분석 → 상대 의견 타당 → 인정·철회·resolve (§8.3)
재분석 → 부당 + 내 발언 < 2회 → 근거 보강 재반박
재분석 → 부당 + 내 발언 ≥ 2회 → 종결 답글 + resolve (P1/보안/CI여도 동일, sensitive_yield 카운트)
```

종결로 resolve한 스레드 수는 결과 보고의 `Yielded` 컬럼에 포함한다.

### 8.4. Resolve 기준 (Conversation 해결 처리)

GitHub PR 스레드의 "Resolve conversation"은 해당 코멘트가 실제로 해결되었는지에 대한 판단이다. **원칙은 작성자가 resolve한다** — 작성자가 반영(또는 REBUT_FINAL 종결)을 끝내는 즉시 자기 PR 스레드를 resolve해 흐름을 막지 않는다. 리뷰어는 잘못된 resolve를 발견하면 unresolve로 돌리고 새 답글로 이어가면 된다 (영구적 결정 아님).

**원칙: 작성자가 resolve (자기 PR의 스레드)**

- 작성자가 APPLY 처리 → 답글(SHA 인용) → 즉시 resolve
- 작성자가 §5.1 REBUT_FINAL 답글 → 즉시 resolve (라운드 한도 종결)
- REBUT 진행 중인 스레드는 resolve 보류 (리뷰어 응답 대기)

**리뷰어가 resolve하는 케이스**

- 리뷰어 본인이 단 코멘트가 outdated(라인 변경됨)인 경우 → 자동 resolve (§8.5)
- §8.3.1 의견 충돌 종결로 작성자 우선 적용해 종결할 때 → 종결 답글 + 리뷰어 resolve (자기가 시작한 스레드라 자기 종결 OK)
- 작성자가 잘못 resolve해서 다시 봐야 할 때 → unresolve + 새 답글

**지양 패턴 (하면 안 됨)**

- ❌ 다른 사람(타 리뷰어)이 단 스레드를 임의로 resolve — 코멘트 주인 우선
- ❌ REBUT(반박 진행 중)인 스레드를 작성자가 resolve — 토론 중인데 닫는 건 무대응으로 보임
- ❌ 작성자가 resolve했다고 무시 — 리뷰어가 잘못된 반영을 발견하면 unresolve로 다시 열기

**스킬 동작 규칙 (리뷰어 역할 수행 시)**

1. 내가 단 스레드 중 **outdated(라인 변경됨)** 인 경우 → 자동 resolve (§8.5)
2. 작성자가 이미 스스로 resolve한 스레드(`isResolved == true` + 마지막 resolver가 작성자) → 내가 코멘트 주인이면 재분석해서 실제 해결됐는지 확인. 미반영이거나 해석 차이가 있으면 **unresolve + 답글**, 정확히 반영됐으면 그대로 둠
3. 내가 안 단 스레드 → 건드리지 않음 (판단권은 코멘트 주인)
4. 의견 충돌 종결(§8.3.1) 시 자기가 단 스레드는 종결 답글 후 리뷰어 자신이 resolve

### 8.7. 병합 (Merge) 조건

**원칙: 검증한 사람이 배포 트리거를 건다.** 리뷰어가 직접 병합하는 것을 표준으로 삼는다. 단 모든 조건을 만족할 때만 가능하다.

**병합 허용 조건 (모두 만족해야 함):**

1. **이번 리뷰 결과가 `APPROVE`** — REQUEST_CHANGES면 절대 금지
2. **모든 리뷰 스레드가 resolved** — 내 것뿐 아니라 다른 리뷰어/작성자가 단 스레드 전부 `isResolved == true`
3. **CI 전부 통과** — `gh pr checks <number>` 결과 fail/pending 0개
4. **PR이 mergeable 상태** — `gh pr view <n> --json mergeable,mergeStateStatus` 가 `MERGEABLE` + `CLEAN`/`HAS_HOOKS`
5. **다른 리뷰어가 모두 approve** (있는 경우) — 추가 리뷰어가 지정돼 있는데 아직 approve 안 했으면 대기
6. **approve 이후 새 커밋 없음** — approve 시점 SHA == 현재 headRefOid. 다르면 재리뷰 필요
7. **본인 PR 아님** — 자기 PR은 절대 self-merge 금지 (§1 자기 PR 리뷰 금지 규칙과 동일)

**조건 확인 명령:**

```bash
PR=<number>
APPROVED=$(gh api repos/{owner}/{repo}/pulls/$PR/reviews --jq "[.[] | select(.user.login==\"$(gh api user --jq .login)\" and .state==\"APPROVED\")] | last | .commit_id")
HEAD=$(gh pr view $PR --json headRefOid --jq .headRefOid)
CHECKS=$(gh pr checks $PR --json state --jq '[.[] | select(.state!="SUCCESS" and .state!="NEUTRAL" and .state!="SKIPPED")] | length')
MERGEABLE=$(gh pr view $PR --json mergeable,mergeStateStatus --jq "[.mergeable, .mergeStateStatus] | @tsv")
UNRESOLVED=$(gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved}}}}}' -F o={owner} -F r={repo} -F n=$PR --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved==false)] | length')

# 모든 조건 만족 시
if [ "$APPROVED" = "$HEAD" ] && [ "$CHECKS" = "0" ] && [ "$UNRESOLVED" = "0" ]; then
  gh pr merge $PR --squash --delete-branch
fi
```

**병합 방식:** 기본 `--squash`(commit history 단순화). 레포 정책이 다르면 따른다 (`--merge` / `--rebase`).

**금지:**

- ❌ 조건 하나라도 불충족 시 병합 — 절대 금지
- ❌ 본인 PR self-merge — 권한 있어도 금지
- ❌ approve 없이 작성자 권유로 merge — "확인 안 한 사람이 배포 트리거 당김" 문제
- ❌ 리뷰 진행 중인데 merge — 다른 리뷰어 의견 차단

**예외:** 사용자가 명시적으로 "merge 하지 마"라고 한 경우(예: 기능 플래그 대기, 일정 조율) 조건 만족해도 merge 보류하고 결과 테이블에 `MERGE_HELD (사유)` 표기.

병합한 PR은 결과 테이블의 `Merged` 컬럼에 `✓` 로 표기.

### 8.5. 오래된 리뷰 스레드 자동 정리 (outdated resolve)

코드 변경으로 더 이상 유효하지 않은 **내 이전 리뷰 코멘트**를 자동 resolve 한다. 다른 사람의 스레드는 건드리지 않는다.

```bash
# 1) PR의 모든 리뷰 스레드를 GraphQL로 조회 (outdated/resolved/author 정보 포함)
gh api graphql -f query='
  query($owner:String!, $repo:String!, $number:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$number) {
        reviewThreads(first:100) {
          nodes {
            id
            isResolved
            isOutdated
            comments(first:1) { nodes { author { login } } }
          }
        }
      }
    }
  }' -F owner={owner} -F repo={repo} -F number=<number>

# 2) 내가 쓴 & isOutdated=true & isResolved=false 인 스레드의 id 추출
# 3) 각 스레드를 resolve
gh api graphql -f query='
  mutation($threadId:ID!) {
    resolveReviewThread(input:{threadId:$threadId}) {
      thread { id isResolved }
    }
  }' -F threadId=<thread_id>
```

**판단 기준:**

- `isOutdated == true` → 해당 라인이 이후 변경됨 → 내 이전 코멘트가 더 이상 유효하지 않음 → **resolve**
- `isOutdated == false` → 라인이 그대로 → 아직 유효 → 건드리지 않음
- `isResolved == true` → 이미 resolve → 스킵
- 내가 쓴 스레드가 아님 → 건드리지 않음 (**타인 리뷰 임의 resolve 금지**)

**삭제는 하지 않는다.** Resolve 처리만 한다 (이력 보존).

Resolve한 스레드 수를 결과 보고에 포함한다.

### 9. 결과 보고

리뷰 완료 후 요약 테이블을 출력한다:

```
| PR | 결과 | pr-skill | P1 | P5 | Replied | Resolved | Merged | 링크 |
|---|---|---|---|---|---|---|---|---|
| #N (작성자) | APPROVE / REQUEST_CHANGES / SKIPPED | OK / WARN(N) | N건 | N건 | N건 | N개 | ✓ / – / HELD | 리뷰 링크 |
```

- `SKIPPED`는 "마지막 리뷰 이후 변경 없음" 또는 "본인 PR" 케이스
- `Replied`는 이번 실행에서 재분석 후 답글을 단 내 이전 스레드 개수
- `Resolved`는 이번 실행에서 outdated로 판단되어 자동 resolve된 내 이전 스레드 개수

## Important Rules

- **ALWAYS 로직 수정 제안(P1~P3)에는 Before/After 코드 블록을 포함한다** — 단순 네이밍·오타(P4), 칭찬(P5) 제외
- **ALWAYS 해당 레포의 `.claude/rules/**/\*.mdc`를 리뷰 전에 로드하고 판정 근거로 인용한다\*\* — 룰 파일이 없는 레포는 CLAUDE.md/AGENTS.md만 참고
- **NEVER 내가 안 단 스레드를 resolve하지 않는다** — resolve 판단권은 코멘트 주인의 몫. 리뷰어 측 자동 resolve는 내가 단 스레드 + outdated(§8.5) 또는 §8.3.1 종결 케이스 한정. 작성자가 자기 PR 스레드를 resolve한 것은 새 정책상 정상이므로 unresolve 권한만 행사 (잘못된 반영 발견 시)
- **NEVER 리뷰어로 지정되지 않은 PR은 리뷰하지 않는다** — PR `reviewRequests`에 현재 사용자가 포함된 경우에만 리뷰. 아니면 스킵.
- **NEVER 자기 PR은 리뷰하지 않는다** — PR `author.login`이 현재 사용자와 같으면 명시 지정되었더라도 스킵. 셀프 approve/request_changes 금지.
- **MERGE 조건부 허용** — 다음 모든 조건을 만족할 때만 리뷰어가 직접 `gh pr merge` 한다(§8.7): ①이번 리뷰 APPROVE, ②모든 스레드 resolved, ③CI 전부 SUCCESS, ④mergeable=MERGEABLE, ⑤다른 리뷰어 전원 approve, ⑥approve 이후 새 커밋 없음, ⑦본인 PR 아님. 하나라도 불충족이면 절대 merge 금지. 사용자가 "merge 하지 마"라고 명시한 경우 보류.
- **ALWAYS PR 스킬 준수 점검** — 리뷰 시작 전 `/pr` 스킬 표준(`type:*`/`mode:*` 라벨 각 1개, assignee, reviewer, 본문 템플릿) 점검(§1.6). 누락 시 작성자에게 일반 코멘트로 `/pr` 스킬 사용 권장 메시지를 1회 등록(중복 방지). 결과 테이블 `pr-skill` 컬럼에 OK/WARN 표기.
- **NEVER** CRITICAL/HIGH/MEDIUM/LOW 등급 사용 — 반드시 P1~P5만 사용
- **NEVER** 억지로 문제를 만들어내지 않는다 — 문제 없으면 P5만 달고 APPROVE
- **ALWAYS** P5 코멘트(칭찬·질문·의견 중 하나 이상)를 포함한다 — 칭찬만 반복되는 게 부담스러우면 가벼운 질문이나 의견으로 채워도 됨. 단 변경 강제 어조면 P3 이상으로 올려야 함
- **ALWAYS** 라인별 코멘트를 사용한다 — **P1~P5 모든 Pn 코멘트**를 예외 없이 `comments[]`의 라인 코멘트로 등록한다. P5 칭찬도 해당 라인에 단다. 리뷰 body에 나열 금지. 라인 번호 계산 부담을 이유로 body에 몰아넣지 않는다. body는 총평(P5로 시작하는 요약 + 이슈 요약)만 담는다
- **ALWAYS** 한글로 작성한다
- **ALWAYS** PR 본문에 이모지 반응을 추가한다
- **NEVER** 자기 코멘트에 자기가 이모지를 달지 않는다
- P1 판정은 신중하게 — 실제로 머지하면 안 되는 이유가 있을 때만
- AI 생성 코드 리뷰 시 할루시네이션(존재하지 않는 API/타입 사용)과 기존 패턴 무시를 중점으로 확인
- **NEVER 사람 개입 지점 만들기** — BLOCKED, "사용자 보고", "수동 검토 요청" 같은 정지 지점을 두지 않는다. P1·보안·CI 우려도 §8.3.1 라운드 한도 종결로 자동 마무리하고 결과 보고에 `sensitive_yield` 카운트로만 남긴다. 사용자가 사후 진단 가능하게 정보는 남기되, 흐름은 절대 막지 않는다.
- **ALWAYS 의견 충돌 종결 프로토콜** — 같은 스레드에서 내 발언이 2회에 도달했는데도 합의 안 되면, 새 반박 대신 "작성자 판단을 존중하겠습니다" 종결 답글 1회 + resolve로 마무리(§8.3.1). 등급/키워드와 무관하게 동일 정책 적용
- **ALWAYS 작성자 답글에 대응** — 작성자가 답글(반박/REBUT_FINAL 포함)을 보냈으면 동의·재반박·종결 셋 중 하나로 반드시 처리하고 resolve까지 끝낸다(§8.3, §8.3.1). 무대응 시 auto-merge 트리거 안 됨
