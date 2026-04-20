# 3. Tech Stack

A one-page reference for every dependency that matters.

## Frontend — `apps/web`

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14** (App Router) | All routes under `app/[locale]/…`. |
| Language | **TypeScript 5** | Strict mode enabled via `@oikos/config`. |
| UI runtime | **React 18** | Server Components where possible, `'use client'` only when needed. |
| Styling | **Tailwind CSS 3** | Tokens defined in `tailwind.config.js`; rules in `.claude/rules/design-system.md`. |
| Components | **`@oikos/ui`** | Local package — `Button`, `Input`. Always use instead of raw HTML. |
| Forms | **react-hook-form + Zod** (`@hookform/resolvers/zod`) | Validation mode `onBlur`; schemas with translations are memoized. |
| i18n | **next-intl 4** | Messages in `apps/web/messages/en.json`. |
| Icons | **lucide-react** | Only icon library allowed. |
| Drag & drop | **@dnd-kit/core + @dnd-kit/sortable** | Used in the week planner. |
| Testing | **Vitest + @testing-library/react + jsdom** | Run with `npm run test` in `apps/web`. |

## Backend — `apps/api`

| Concern | Choice | Notes |
|---|---|---|
| Framework | **FastAPI 0.111** | Uvicorn with standard extras. |
| Language | **Python 3.12** | |
| ORM | **SQLAlchemy 2 (async)** | Uses `AsyncSession`. Never introduce the sync API. |
| DB driver | **asyncpg 0.29** | psycopg2-binary is only present for Alembic tooling. |
| Validation | **Pydantic v2 + pydantic-settings** | Response schemas use `model_config = {"from_attributes": True}`. |
| Migrations | **Alembic 1.13** | Auto-run on container start. |
| Auth | **python-jose + passlib[bcrypt]** | bcrypt 4.0.1 pinned. JWT HS256. |
| Rate limiting / cache | **redis 5 (Python client)** | Backed by Redis 7 container. |
| Testing | **pytest 8 + pytest-asyncio + httpx** | Tests hit a real DB — do not mock SQLAlchemy. |

## Data stores

| Service | Version | Role |
|---|---|---|
| PostgreSQL | 16 | Primary data store, async access via asyncpg. |
| Redis | 7 | Rate limits on auth endpoints; future: caching. |

## Tooling

| Tool | Role |
|---|---|
| **Turborepo 2** | Monorepo task graph. See `turbo.json`. |
| **Docker Compose** | Local full stack (`docker-compose.yml`). Prod stub in `docker-compose.prod.yml`. |
| **ESLint + Prettier** | Shared via `@oikos/config`. |
| **npm workspaces** | Dependency hoisting. |

## What we deliberately don't use

- No Redux / Zustand / Jotai — React hooks and `AuthProvider` context are enough today.
- No Axios — plain `fetch` with `credentials: 'include'`.
- No icon library other than `lucide-react`.
- No Authorization headers for auth — cookies only.
- No ORM mocking in tests — the test harness spins up real tables.
