---
name: oikos-pr
description: Lint-gated PR creation for the Oikos monorepo. Runs ESLint and the Vitest suite before touching git. Auto-fixes what it can, then creates a feature branch from main, commits, pushes, and opens a PR. Use this skill whenever the user wants to ship, submit, open a PR, push code, create a pull request, commit and push, or ship changes. Trigger phrases include "open a PR", "create a PR", "ship this", "push this", "submit for review", "commit and push", "make a PR", "send a PR", "push to main", or any variant asking to get code reviewed or merged.
---

# Oikos PR Creator

Ship code safely: lint → tests → branch → commit → push → PR.
Never create a branch or commit until both lint and tests are green.

---

## Step 0 — Understand what changed

Before anything else, run these three commands in parallel:

```bash
git status                          # what files changed
git diff HEAD                       # what the changes actually are
git log main..HEAD --oneline        # commits not yet on main (may be empty)
```

Use the output to:
- Know which files to stage
- Draft an accurate commit message
- Detect if you are already on a feature branch (don't create a second one)

---

## Step 1 — Run lint

```bash
npx turbo run lint
```

This lints all workspaces (web, ui, types, config) with `--max-warnings 0`.

### If lint passes
Continue to Step 2.

### If lint fails
1. **Attempt auto-fix** for the web workspace (ESLint can fix ~30% of issues):
   ```bash
   cd apps/web && npx eslint . --ext ts,tsx --fix
   ```
2. Re-run the full lint:
   ```bash
   npx turbo run lint
   ```
3. If still failing, **stop**. Report the remaining errors clearly:
   - List each file and the exact error message
   - Explain why you cannot auto-fix it (e.g. logic errors, missing translations, wrong prop types)
   - Ask the user to fix the remaining errors, then invoke the skill again
   - **Do NOT proceed to git operations**

---

## Step 2 — Run web unit tests

```bash
cd apps/web && npx vitest run
```

### If tests pass
Continue to Step 3.

### If tests fail
**Stop.** Report which test files failed and which specific assertions failed.
Do not proceed to git operations until tests are green.

> Skip this step only if the user explicitly says "skip tests" or "lint only".

---

## Step 3 — Determine branch name

If the user provided a branch name in their request, use it exactly.

Otherwise, derive one from the nature of the changes:

| Change type | Prefix | Example |
|-------------|--------|---------|
| New feature / page / component | `feat/` | `feat/e2e-active-curriculums` |
| Bug fix | `fix/` | `fix/lint-children-prop` |
| Tests / CI | `test/` or `ci/` | `ci/github-actions-e2e` |
| Refactor (no behaviour change) | `refactor/` | `refactor/widget-testid` |
| Docs / plan files | `docs/` | `docs/e2e-testing-plan` |
| Chore (deps, config) | `chore/` | `chore/playwright-install` |

Keep the slug short (≤ 5 words, kebab-case, no issue numbers unless provided).

---

## Step 4 — Prepare the branch

### If already on a feature branch (not `main` or `develop`)
Skip branch creation — commit directly to the current branch.

### If on `main` or `develop`
```bash
git checkout main
git pull origin main
git checkout -b <branch-name>
```

---

## Step 5 — Stage and commit

Stage only the files relevant to this change. Prefer explicit file lists over
`git add -A` — avoid accidentally staging `.env`, `*.json` lock file noise,
or unrelated work-in-progress files.

```bash
git add <file1> <file2> ...
```

**Commit message format** (Conventional Commits):

```
<type>(<scope>): <short summary in present tense>

<optional body — what and why, not how>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Rules:
- Type: `feat`, `fix`, `test`, `ci`, `docs`, `refactor`, `chore`
- Scope: the feature area, e.g. `e2e`, `calendar`, `auth`, `ci`
- Summary: ≤ 72 characters, imperative mood ("add", "fix", "remove" — not "added")
- Body: include only if the why isn't obvious from the summary
- Always include the `Co-Authored-By` trailer

Use a heredoc to avoid shell quoting issues:
```bash
git commit -m "$(cat <<'EOF'
feat(e2e): add active-curriculums Playwright spec

Implements §6 of the E2E testing plan. Seeds two active and one
archived curriculum, then asserts the dashboard widget shows only
the active ones and that the row count matches the live API.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Step 6 — Push

```bash
git push -u origin <branch-name>
```

---

## Step 7 — Open the PR

```bash
gh pr create \
  --title "<type>(<scope>): <same summary as commit>" \
  --body "$(cat <<'EOF'
## What changed
<!-- 2-4 bullet points describing the changes -->

## Why
<!-- The motivation: bug fix, new feature, CI requirement, etc. -->

## Test plan
- [ ] `npx turbo run lint` passes (run by skill before creating this PR)
- [ ] `cd apps/web && npx vitest run` passes (run by skill before creating this PR)
- [ ] Manually tested in browser / Docker stack (if applicable)

## Related
<!-- Link to issues, plan docs, or prior PRs if relevant -->

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

**PR title** must match the commit subject line exactly.

---

## Guardrails — never do these

- **Never skip lint or tests** to save time. If they fail, stop and report.
- **Never force-push** to `main` or `develop`.
- **Never use `git add -A` or `git add .`** without reviewing what would be staged.
- **Never commit `.env` files**, `*.local`, or anything matching `.gitignore`.
- **Never amend the previous commit** when a pre-commit hook fails — create a new commit.
- **Never bypass hooks** with `--no-verify`.
- **Never open a draft PR without telling the user** — ask first if unsure.

---

## Error reporting format

When stopping due to lint or test failures, always output:

```
🚫 Cannot create PR — <lint|tests> failed.

Errors:
  <file>:<line>  <rule>  <message>
  ...

Auto-fix was <attempted and reduced X errors / not applicable>.
Please fix the remaining errors and run the skill again.
```
