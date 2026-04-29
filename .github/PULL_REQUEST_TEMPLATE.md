## What does this PR do?

<!-- A clear, one-paragraph description of the change. What problem does it solve or what feature does it add? -->

## Type of change

<!-- Check all that apply -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that changes existing behaviour)
- [ ] ♻️ Refactor (no behaviour change)
- [ ] 🧪 Tests (adding or improving test coverage)
- [ ] 🔧 CI / tooling / configuration
- [ ] 📝 Documentation

## How to test it

<!-- Tell reviewers exactly how to verify this works.
     Be specific: which page to visit, which action to take, what to expect. -->

```
# Example:
# 1. Start the stack: docker compose up -d
# 2. Go to http://localhost:3000/dashboard
# 3. Check that the "Active Curriculums" widget shows only curricula with status = active
```

## Screenshots / recordings

<!-- For any UI change, paste a before/after screenshot or a short screen recording.
     Drag and drop images directly into this text box.
     Skip this section for backend-only or CI changes. -->

| Before | After |
|--------|-------|
| _n/a_ | _n/a_ |

## Checklist

<!-- Please tick every box. If something does not apply, tick it and add "N/A — <reason>". -->

**Code quality**
- [ ] `npx turbo run lint` passes with zero warnings
- [ ] `cd apps/web && npx vitest run` passes (515+ tests green)
- [ ] No hardcoded user-facing strings — all text goes through `useTranslations` / `messages/en.json`
- [ ] New required form fields display a red asterisk (see `CLAUDE.md` form guidelines)

**API changes** _(skip if frontend-only)_
- [ ] New endpoints have `Depends(get_current_user)` where required
- [ ] New/changed schemas have `model_config = {"from_attributes": True}` on response models
- [ ] A new Alembic migration was created if models changed (`/oikos-db-migration`)
- [ ] `cd apps/api && pytest` passes against a live database

**Tests**
- [ ] New behaviour is covered by at least one test
- [ ] No existing tests were deleted without a documented reason

**Docs / i18n**
- [ ] New translation keys were added to `messages/en.json`
- [ ] Any new protected routes were added to `PROTECTED_PATHS` in `middleware.ts`

## Related issues / PRs

<!-- Closes #<issue-number> -->
<!-- Refs #<issue-number> -->

---

_By submitting this PR you confirm that your contribution is made under the project's open-source licence and that you have the right to submit it._
