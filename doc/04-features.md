# 4. Features

This is a feature-by-feature catalogue of what exists in the codebase today. Use it as a map before working on a new task.

Status legend: ✅ implemented · 🟡 partial / wired up but thin · ⛔ placeholder only.

## Authentication ✅
- Register, login, logout.
- Forgot-password + reset-password with SHA-256 hashed one-time tokens (1-hour expiry).
- Account lock-out after repeated failed logins (`users.failed_login_attempts`, `users.locked_until`).
- Rate limiting via Redis on auth endpoints.
- JWT access + refresh tokens stored as **httpOnly cookies**.

Routes: `apps/api/app/routers/auth.py` · Pages: `apps/web/app/[locale]/(auth)/`.

## Family onboarding ✅
- `/onboarding/family` — family name, location, faith tradition, education purpose, methods, curriculum labels, diet, screen policy, home languages, visibility.
- `/onboarding/children` — add the first batch of children.
- `/onboarding/coat-of-arms` — design the family shield (rendered across the app).
- `users.has_family` and `users.has_coat_of_arms` flags drive the redirect logic in `AuthProvider`.

## Family profile & shield ✅
- `/family` — edit the family profile.
- Shield config lives in `families.shield_config` (JSON).
- Components: [apps/web/components/onboarding/ShieldBuilder.tsx](../apps/web/components/onboarding/ShieldBuilder.tsx), [ShieldPreview.tsx](../apps/web/components/onboarding/ShieldPreview.tsx).

## Children management ✅
- `/children` lists active children; archived children are hidden (`children.is_active`, `children.archived_at`).
- `/children/[child_id]` child profile: personality, interests, learning styles, motivators, learning differences, accommodations.
- Children can be assigned to curriculums, projects, routine entries.

## Subjects ✅
- `/subjects` CRUD with category, color, icon, age/grade guidance, priority (1–3), learning objectives, skills targeted.
- Categories: `core_academic`, `language`, `scripture_theology`, `arts`, `physical`, `practical_life`, `logic_rhetoric`, `technology`, `elective`, `co_op`, `other`.
- Subjects are family-scoped; platform-level seed subjects are supported via `subjects.is_platform_subject`.

## Curriculum ✅
- `/curriculums` CRUD.
- Period types: `monthly`, `quarterly`, `semester`, `annual`, `custom`.
- Status: `draft`, `active`, `paused`, `completed`, `archived`, `template`.
- `curriculum_subjects` links a subject into a curriculum with weekly frequency, session duration, scheduled days, preferred time slot, and goals-for-period.
- `child_curriculums` assigns children to a curriculum.

## Week planner ✅
- `/planner` — drag-and-drop weekly grid powered by `@dnd-kit`.
- `week_templates` are reusable per family (`is_active` flag marks the current one).
- `routine_entries` have `day_of_week`, `start_minute`, `duration_minutes`, optional subject, `child_ids[]` array, priority, color, notes, and an `is_free_time` flag.
- Printable view: [apps/web/components/planner/PrintablePlanner.tsx](../apps/web/components/planner/PrintablePlanner.tsx).

## Projects ✅
- `/projects` CRUD with title, description, purpose, due date, status (`draft`, `active`, `complete`, `archived`).
- Many-to-many with children (`project_children`) and subjects (`project_subjects`).
- Milestones (`project_milestones`) with sort order and due dates.
- Milestone completions per child (`milestone_completions`, unique per milestone+child).
- Portfolio entries (`portfolio_entries`) — reflection, parent notes, score 1–10, media URLs, unique per project+child.
- Achievements (`child_achievements`) — certificate number + awarded_at, printable at `/projects/[projectId]/certificate/[childId]`.

## Resources ✅
- `/resources` CRUD for books, articles, videos, courses, podcasts, documentaries, printables, websites, curriculum, other.
- Link to subjects (`subject_resources`) or projects (`project_resources`), each with notes.

## Dashboard ✅
- `/dashboard` — home view with family activity overview.

## Internationalisation ✅
- Every page uses `useTranslations`. Current locale: `en`. Adding locales is a JSON drop-in.

## Placeholder / upcoming
- `/calendar` ⛔ — calendar view.
- `/journal` ⛔ — learning journal.
- `/progress` ⛔ — progress analytics.
- `/assistant` ⛔ — AI assistant.
- `/community` ⛔ — family-to-family sharing.
- `/settings` 🟡 — account settings (partial).

When building a new feature, check [04-features.md](04-features.md) (this doc), [05-database.md](05-database.md), and the relevant rule file in `.claude/rules/` before starting.
