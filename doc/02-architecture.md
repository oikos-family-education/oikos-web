# 2. Architecture

Oikos is a **Turborepo monorepo** with two runnable apps and three shared packages.

## Repository layout

```
oikos-web/
├── apps/
│   ├── web/            Next.js 14 frontend (App Router, TS, Tailwind)
│   └── api/            FastAPI backend (Python 3.12, async SQLAlchemy)
├── packages/
│   ├── ui/             Shared React components (@oikos/ui)
│   ├── types/          Shared TypeScript types (@oikos/types)
│   └── config/         Shared ESLint / Tailwind / tsconfig (@oikos/config)
├── specs/              Feature specs
├── doc/                This documentation
├── docker-compose.yml  Local dev stack (postgres, redis, migrate, api, web)
├── turbo.json          Turborepo pipeline
└── package.json        Root scripts
```

## High-level request flow

```
┌─────────┐       ┌───────────────────┐       ┌──────────────────┐
│ Browser │──────▶│ Next.js (web:3000)│──────▶│ FastAPI (api:8000)│
└─────────┘       │                   │ /api/*│                  │
                  │ - App Router      │       │ - Routers        │
                  │ - next-intl i18n  │       │ - Services       │
                  │ - middleware.ts   │       │ - SQLAlchemy ORM │
                  │   (auth + locale) │       │ - Pydantic v2    │
                  └───────────────────┘       └─────────┬────────┘
                                                        │
                                         ┌──────────────┼─────────────┐
                                         ▼              ▼             ▼
                                   ┌──────────┐   ┌──────────┐   ┌────────┐
                                   │PostgreSQL│   │  Redis   │   │Alembic │
                                   │   16     │   │ (rate    │   │(migra- │
                                   │ asyncpg  │   │  limits) │   │ tions) │
                                   └──────────┘   └──────────┘   └────────┘
```

The Next.js app proxies `/api/*` to FastAPI via `next.config.js` rewrites. In Docker Compose, the host `api` resolves to the FastAPI container; for host-mode dev, the rewrite target is set via environment.

## Authentication model

- **JWT access + refresh tokens** are issued by FastAPI and stored as **httpOnly cookies** (`access_token`, `refresh_token`).
- The frontend never touches the tokens directly — it sends `credentials: 'include'` on every fetch, and the browser attaches the cookies.
- There are **no Authorization headers**. Do not introduce them.
- `apps/api/app/core/security.py` → `get_current_user` is the single dependency that validates the cookie and resolves the ORM `User`.
- `apps/web/middleware.ts` checks for the `access_token` cookie and redirects to `/login` for protected paths.

See [09-security.md](09-security.md) for the full auth and rate-limiting picture.

## Backend layering

Strict three-layer separation, enforced by project rules:

1. **Router** (`app/routers/`) — thin HTTP handlers. Parse input, call a service, return a response.
2. **Service** (`app/services/`) — business logic. Receives an `AsyncSession`. Knows nothing about HTTP.
3. **Model / Schema** — SQLAlchemy ORM (`app/models/`) and Pydantic v2 (`app/schemas/`).

See [06-backend.md](06-backend.md).

## Frontend layering

- **Routes** under `apps/web/app/[locale]/` — locale is always the first segment.
- **Route groups**:
  - `(auth)` — login, register, password reset. Public.
  - `(dashboard)` — everything behind login. Protected by middleware and by `AuthProvider`.
  - `onboarding` — first-run setup, partially protected.
- **Components** by feature under `apps/web/components/<feature>/`.
- **Providers** (`apps/web/providers/`) wrap the tree with auth context.

See [07-frontend.md](07-frontend.md).

## Shared packages

| Package | Import | Contents |
|---|---|---|
| `@oikos/ui` | `packages/ui/` | `Button`, `Input`, and future primitives. Transpiled by Next via `transpilePackages`. |
| `@oikos/types` | `packages/types/` | TS types mirrored from backend Pydantic schemas (`auth`, `family`, `child`, …). |
| `@oikos/config` | `packages/config/` | Shared ESLint, Tailwind, and tsconfig presets. |

## Data and migrations

- PostgreSQL 16 over **async SQLAlchemy + asyncpg**.
- Schema is owned by **Alembic** migrations in [apps/api/alembic/versions/](../apps/api/alembic/versions/).
- Migrations run automatically when the `migrate` service in `docker-compose.yml` starts.
- Always create a migration for any model change; never hand-edit the DB.

See [05-database.md](05-database.md).

## Internationalisation

- `next-intl` with messages in [apps/web/messages/](../apps/web/messages/).
- All user-facing strings come from `useTranslations('Namespace')`.
- See [10-i18n.md](10-i18n.md).

## Deployment shape (intended)

Today the project runs as `docker compose` locally. For production, the same two images (`web`, `api`) are expected behind a reverse proxy with a managed Postgres and Redis. `docker-compose.prod.yml` is the starting point.
