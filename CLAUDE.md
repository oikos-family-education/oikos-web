# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Oikos is an open source family education platform. This is a **Turborepo monorepo** with:
- `apps/web` — Next.js 14 frontend
- `apps/api` — FastAPI backend (Python 3.12)
- `packages/ui` — Shared React component library (`@oikos/ui`)
- `packages/types` — Shared TypeScript types (`@oikos/types`)
- `packages/config` — Shared ESLint/Tailwind/TypeScript configs (`@oikos/config`)

## Commands

### Monorepo (root)
```bash
npm run dev          # Start all apps via Turborepo
npm run build        # Build all apps
npm run lint         # Lint all packages
npm run test         # Run all tests
npm run type-check   # TypeScript check all packages
```

### Docker (preferred for local dev)
```bash
docker compose up -d           # Full stack (PostgreSQL, Redis, API, Web)
docker compose up -d db redis  # Backing services only (for host dev)
```

### Frontend (`apps/web`)
```bash
cd apps/web
npm run dev    # next dev (port 3000)
npm run test   # vitest run
npm run lint   # eslint
```

### API (`apps/api`)
```bash
cd apps/api
# Requires a Python venv with requirements.txt installed
uvicorn app.main:app --reload   # dev server (port 8000)
pytest                          # run all tests
pytest tests/test_auth.py       # run a single test file
```

## Architecture

### Request Flow
The Next.js frontend proxies all `/api/*` requests to the FastAPI backend at `http://api:8000` (via `next.config.js` rewrites). In Docker, `api` resolves to the FastAPI container; in host dev, update `.env` accordingly.

### Authentication
- JWT tokens stored as **httponly cookies** (`access_token`, `refresh_token`)
- Auth is cookie-based — no Authorization headers
- `get_current_user` dependency in `app/core/security.py` validates the cookie and returns the ORM User object
- Rate limiting is applied via Redis on login attempts

### API Layer (`apps/api`)
Organized as:
- `app/routers/` — FastAPI route handlers (thin, delegate to services)
- `app/services/` — Business logic (`auth_service.py`, `family_service.py`)
- `app/models/` — SQLAlchemy async ORM models
- `app/schemas/` — Pydantic request/response schemas
- `app/core/` — Config (pydantic-settings), database session, security utilities

Database uses **async SQLAlchemy** with `asyncpg`. Migrations managed by **Alembic** (`apps/api/alembic/`), applied automatically on container start.

### Frontend Layer (`apps/web`)
- Next.js App Router with **locale-based routing** — all routes are under `app/[locale]/`
- Internationalization via `next-intl`; currently only `en` locale, messages in `messages/en.json`
- Route groups: `(auth)` for login/register/password flows, `onboarding` for family/children setup
- UI components imported from `@oikos/ui` (local package, transpiled via `transpilePackages`)
- Forms use `react-hook-form` + `zod` validation

### API Tests (`apps/api/tests`)
Tests use a real async database (not mocked). The `conftest.py` creates/drops tables against the actual `DATABASE_URL` configured in `.env`. Run with a live PostgreSQL instance or via Docker.

### Frontend Tests (`apps/web/tests`)
Vitest + jsdom + `@testing-library/react`. Run with `npm run test` from `apps/web`.
