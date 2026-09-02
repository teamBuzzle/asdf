---
name: pr
description: Create a GitHub Pull Request with auto-detected base branch, type/mode labels, self-assign, and auto-reviewer selection. Use when the user says "pr", "PR 만들어", "풀리퀘", or wants to create a pull request.
---

Create a GitHub Pull Request for the current branch with full automation.

## Steps

### 1. Gather branch info

Run these commands in parallel:

```bash
# Current branch name
git rev-parse --abbrev-ref HEAD

# Detect the base branch (where this branch was created from)
git log --oneline --decorate --all --ancestry-path HEAD..main --merges 2>/dev/null | head -1
# Fallback: find the merge-base with main
git merge-base HEAD main

# Get the current user's GitHub username
gh api user --jq '.login'

# Pick the reviewer: one of the review pool at random, excluding yourself
gh api repos/{owner}/{repo}/collaborators --jq '.[].login'

# Check if there are unpushed commits
git status
git log --oneline origin/$(git rev-parse --abbrev-ref HEAD)..HEAD 2>/dev/null
```

Determine the **base branch**: Use `git merge-base --fork-point main HEAD` or `git merge-base main HEAD` to find where the current branch diverged from. The base branch is `main` unless the branch was created from another feature branch (detect via branch naming or merge-base).

### 2. Analyze changes

```bash
# All commits on this branch since diverging from base
git log --oneline $(git merge-base main HEAD)..HEAD

# Full diff against base
git diff $(git merge-base main HEAD)..HEAD --stat
git diff $(git merge-base main HEAD)..HEAD
```

Read all the commits and the diff carefully to understand:

- What was changed and why
- The scope and risk of the changes
- Whether tests, lint, or build were affected

### 3. Select labels

Based on the commit messages and changes, select exactly **one `type:*` label** and **one `mode:*` label**.

**Type labels** (pick one):
| Label | When to use |
|---|---|
| `type:fix` | Fixes broken expected behavior |
| `type:feat` | Adds new functionality or user value |
| `type:refactor` | Improves internal structure without behavior change |
| `type:chore` | Config, dependencies, CI, maintenance |
| `type:docs` | Documentation changes |
| `type:test` | Test code additions or improvements |
| `type:style` | Formatting, no code logic change |
| `type:ci` | CI/CD pipeline changes |
| `type:perf` | Performance improvement |

**Mode labels** (pick one):
| Label | When to use |
|---|---|
| `mode:ai` | AI drove the work |
| `mode:human` | Human drove the work |
| `mode:mixed` | Both AI and human contributed substantially |

Determine the mode label by examining commit messages and the conversation context. If commits contain `Co-Authored-By: Claude` or similar AI indicators, lean toward `mode:ai` or `mode:mixed`. If unsure, ask the user.

### 4. Fill PR template

Use the repository's PR template at `.github/pull_request_template.md`:

```markdown
## Summary

<!-- English. Describe what this PR changes and why. -->
<!-- Link the issue with `Ref #12`. Use `Closes #12` only when this PR
     satisfies every acceptance item on that issue. -->

<details>
<summary>🇰🇷 한국어</summary>

<!-- The same explanation in Korean. -->

</details>

## Impact

- Scope: <!-- affected area, e.g. ipc layer, workspace feature, Tauri shell -->
- Risk: <!-- low / medium / high -->
- Rollback: <!-- how to revert if needed -->

## Checks

- Tests: <!-- pass / fail / not applicable -->
- Lint/Build: <!-- pass / fail -->
- Preview: <!-- link or N/A -->
- Evidence: <!-- screenshots, test output, etc. -->

## Review Focus

- <!-- Key areas reviewers should focus on -->
```

Fill in all sections based on your analysis.

**The Summary section is bilingual. Everything else is English only.**

GitHub markdown has no tabs, so the Korean version goes in a `<details>` block
directly under the English one — collapsed by default, one click to open.

- Write the English summary first, then the Korean one.
- The Korean block is not a translation of the English sentences; it is the same
  explanation written natively in Korean. Same facts, same structure, same level
  of detail. Do not let one side carry information the other lacks.
- Keep the `<summary>🇰🇷 한국어</summary>` line exactly as it is, so every pull
  request looks the same.
- Leave a blank line after `<details>` and before `</details>`, or GitHub will
  not render the markdown inside the block.
- Title, Impact, Checks and Review Focus stay English only.

### 5. Push and create PR

```bash
# Push current branch if needed (with upstream tracking)
git push -u origin $(git rev-parse --abbrev-ref HEAD)

# Create PR with:
# - base branch = detected base
# - labels = one type + one mode
# - assignee = current user (self)
# - reviewer = collaborators excluding self (if available)
gh pr create \
  --base <base-branch> \
  --title "<concise title in English, under 70 chars>" \
  --body "$(cat <<'EOF'
<filled template content>
EOF
)" \
  --label "type:<type>" \
  --label "mode:<mode>" \
  --assignee "@me" \
  --reviewer "$REVIEWER"
```

**Reviewer selection rules:**

The review pool is fixed:

```
devxian96
Hayoung0708
```

- Drop the pull request author from the pool. A person cannot review their own
  pull request, and `main` requires one approving review, so assigning the
  author would deadlock the merge.
- Pick **one** name from what is left, at random. Do not always pick the first.
- Assign exactly that one reviewer. Do not add the rest of the repository's
  collaborators — they are not on the review rota.
- If the pool is empty after dropping the author, skip the `--reviewer` flag and
  say so in the report, because the pull request cannot be merged until someone
  outside the pool approves it.

```bash
# Pool minus the author, one at random
POOL=$(printf 'devxian96\nHayoung0708\n' | grep -vx "$(gh api user --jq .login)")
REVIEWER=$(printf '%s\n' "$POOL" | sort -R | head -1)
```

### 6. Report result

After creating the PR, output:

- PR URL
- Selected labels
- Assigned reviewers
- A brief summary of what was included

## Important rules

- ALWAYS detect the base branch from git history, do not assume `main`
- ALWAYS select exactly one `type:` and one `mode:` label
- ALWAYS assign self as assignee
- ALWAYS assign exactly one reviewer, chosen at random from the review pool minus the author
- ALWAYS use the PR template from `.github/pull_request_template.md`
- ALWAYS write the PR title in English
- ALWAYS write the Summary section twice: English, then Korean inside the
  `<details>` block. Every other section is English only
- Link the GitHub issue with `Ref #<n>` in the body. Use `Closes #<n>` only when the PR satisfies every acceptance item on that issue
- If the branch has no commits ahead of base, warn the user and do not create the PR
- If there are uncommitted changes, warn the user before proceeding
