# 5. Database

PostgreSQL 16, accessed through async SQLAlchemy 2 via `asyncpg`. Schema owned by Alembic.

## Conventions

- **UUID primary keys** (`Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`).
- **Timestamps with timezone** on every table (`created_at`, `updated_at` where mutable).
- **Foreign keys** use `ondelete="CASCADE"` by default. Children follow parents into the grave.
- **Arrays** for simple lists (`ARRAY(String)`); **JSON** for structured blobs (e.g. `families.shield_config`).
- **Indexes** on every foreign key and on columns that drive queries (e.g. `users.email`).

## Tables

### `users`
Account identity.
- `id` UUID PK
- `email` unique, indexed
- `hashed_password` (bcrypt)
- `is_active`, `is_verified` booleans
- `has_family`, `has_coat_of_arms` — drive onboarding redirects
- `last_login_at`, `failed_login_attempts`, `locked_until`
- `password_reset_token` (sha256 hash), `password_reset_expires_at`

One account owns one family today (`families.account_id`).

### `families`
The household profile.
- `account_id` FK → `users`
- `family_name`
- `shield_config` JSON — coat-of-arms design
- `location_*`, `faith_tradition`, `faith_notes`
- `education_purpose` text
- `education_methods` `ARRAY(String)` — e.g. `['classical', 'charlotte_mason']`
- `current_curriculum` `ARRAY(String)` — informal labels
- `diet`, `screen_policy`
- `home_languages` `ARRAY(String)`
- `visibility` — controls future community sharing

### `children`
- `family_id` FK → `families`
- `first_name`, `nickname`, `gender`, `birthdate`, `grade_level`
- `learning_styles` `ARRAY(String)`
- `personality_*`, `interests` `ARRAY(String)`, `motivators`
- `learning_differences` `ARRAY(String)`, `accommodations` text
- `is_active` boolean, `archived_at` timestamp

### `subjects`
- `family_id` FK nullable (NULL = platform-level subject)
- `name`, `category` enum, `color`, `icon`
- `min_age`, `max_age`, `grade_guidance`
- `priority` 1–3
- `learning_objectives` `ARRAY(String)`, `skills_targeted` `ARRAY(String)`
- `is_platform_subject`, `is_public`
- `created_by_user_id` FK → `users`

### `curriculums`
- `family_id` FK
- `name`, `period_type` enum (`monthly`/`quarterly`/`semester`/`annual`/`custom`)
- `start_date`, `end_date`
- `status` enum (`draft`/`active`/`paused`/`completed`/`archived`/`template`)
- `overall_goals` `ARRAY(String)`

### `curriculum_subjects`
Join of curriculum ↔ subject with scheduling metadata.
- `curriculum_id`, `subject_id`
- `weekly_frequency`, `session_duration_minutes`
- `scheduled_days` `ARRAY(String)`
- `preferred_time_slot`
- `goals_for_period` `ARRAY(String)`

### `child_curriculums`
- `child_id`, `curriculum_id`, `joined_at`

### `week_templates`
- `family_id`, `name`, `is_active`

### `routine_entries`
- `template_id` FK, `family_id` FK
- `subject_id` FK nullable
- `is_free_time` boolean
- `child_ids` UUID `ARRAY`
- `day_of_week`, `start_minute`, `duration_minutes`
- `priority`, `color`, `notes`

### `projects`
- `family_id`
- `title`, `description`, `purpose`, `due_date`
- `status` enum (`draft`/`active`/`complete`/`archived`)
- `created_at`, `completed_at`, `archived_at`

### `project_children`, `project_subjects`, `project_resources`
Pure join tables. `project_resources` has `added_at` and `notes`.

### `project_milestones`
- `project_id`, `title`, `description`, `sort_order`, `due_date`

### `milestone_completions`
- `milestone_id`, `child_id`, `completed_at`, `notes`
- **Unique** on `(milestone_id, child_id)`.

### `portfolio_entries`
- `project_id`, `child_id`
- `title`, `reflection`, `parent_notes`, `score` (1–10), `media_urls` `ARRAY(String)`
- **Unique** on `(project_id, child_id)`.

### `child_achievements`
- `child_id`, `project_id`, `awarded_at`, `certificate_number`, `acknowledged_at`
- **Unique** on `(project_id, child_id)`.

### `resources`
- `family_id`, `title`, `type` enum, `author`, `url`, `description`

### `subject_resources`
- `subject_id`, `resource_id`, `progress_notes`

## Relationship map

```
users ─1:1─▶ families
             │
             ├─1:N─▶ children ───┐
             ├─1:N─▶ subjects    │
             ├─1:N─▶ curriculums │
             │        │          │
             │        ├─N:M─ subjects (curriculum_subjects)
             │        └─N:M─ children (child_curriculums)
             ├─1:N─▶ week_templates ──1:N─▶ routine_entries
             ├─1:N─▶ resources ──N:M─ subjects (subject_resources)
             │                 └──N:M─ projects (project_resources)
             └─1:N─▶ projects
                        ├─N:M─ children (project_children)
                        ├─N:M─ subjects (project_subjects)
                        ├─1:N─▶ project_milestones ──1:N─▶ milestone_completions ◀─ children
                        ├─1:N─▶ portfolio_entries ◀─ children
                        └─1:N─▶ child_achievements ◀─ children
```

## Migrations

All migrations live in [apps/api/alembic/versions/](../apps/api/alembic/versions/). Current chain:

| Revision | Purpose |
|---|---|
| `0001_initial` | `users` table |
| `b9ff05469e24` | `families` + `children` |
| `c3a1f8e92b01` | add `education_purpose` to `families` |
| `d4b2c9f01e37` | drop `lifestyle_tags` from `families` |
| `e5a3d7f12c48` | `subjects` + `curriculums` + join tables |
| `f6b4e8a23d59` | add `priority` to `subjects` |
| `g7c5f9b34e60` | `week_templates` + `routine_entries` |
| `h8d6g0c45f71` | `resources` + `subject_resources` |
| `i9e7h1d56g82` | add `has_coat_of_arms` to `users` |
| `j0f8i2e67h93` | add `archived_at` to `children` |
| `k1g9j3f78i04` | `projects` + milestones + portfolio + achievements |

### Creating a migration

```bash
cd apps/api
alembic revision --autogenerate -m "short description"
# Review the generated file. Edit if needed. Then:
alembic upgrade head
```

Docker users can run: `docker compose exec api alembic upgrade head`.

Never edit a migration that has already shipped — write a new one.
