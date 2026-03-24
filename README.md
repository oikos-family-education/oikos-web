# Oikos — Open Source Family Education Platform

> A modern, open source platform to help families organize and enrich their children's education journey.

[![CI](https://github.com/oikos-family/oikos-web/actions/workflows/ci.yml/badge.svg)](https://github.com/oikos-family/oikos-web/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## What is Oikos?

**Oikos** (Greek: οἶκος, "household") is an open source platform for family education. It gives families a central space to track children's learning progress, manage educational activities, and stay organized — built with privacy and simplicity in mind.

This repository is the full-stack monorepo: a **Next.js 14** frontend, a **FastAPI** backend, and shared packages, all orchestrated with **Turborepo**.

---

## Features

- **Family onboarding** — create a family profile and add children in minutes
- **Dashboard** — a unified view of your family's educational activity
- **Authentication** — secure, cookie-based JWT auth with refresh token rotation
- **Rate limiting** — Redis-backed protection on sensitive endpoints
- **Internationalization** — built-in i18n support via `next-intl`
- **Fully typed** — TypeScript on the frontend, Pydantic v2 on the backend

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2 (async) |
| Database | PostgreSQL 16 |
| Cache / Rate Limiting | Redis 7 |
| Migrations | Alembic |
| Monorepo | Turborepo |
| Auth | JWT via httpOnly cookies |
| Forms | react-hook-form + Zod |
| Styling | Tailwind CSS |
| Testing (FE) | Vitest + Testing Library |
| Testing (BE) | pytest + pytest-asyncio |

---

## Repository Structure

```
oikos-web/
├── apps/
│   ├── api/          # FastAPI backend (Python 3.12)
│   └── web/          # Next.js 14 frontend
├── packages/
│   ├── config/       # Shared ESLint / TypeScript config
│   ├── types/        # Shared TypeScript types (@oikos/types)
│   └── ui/           # Shared React component library (@oikos/ui)
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── docker-compose.yml
└── turbo.json
```

---

## Getting Started

### Prerequisites

- [Node.js 20 LTS](https://nodejs.org/)
- [Python 3.12](https://www.python.org/)
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- npm 10+ (included with Node.js 20)

### Option A — Docker (Recommended)

The fastest way to get a full working stack:

```bash
# 1. Clone the repo
git clone https://github.com/oikos-family/oikos-web.git
cd oikos-web

# 2. Set up environment variables
cp .env.example .env

# 3. Start the full stack (PostgreSQL, Redis, API, Web)
docker compose up -d
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Alembic migrations run automatically on API startup.

### Option B — Host Development (Better Hot-Reload)

Run the backing services in Docker, then run the app processes on your host:

```bash
# 1. Clone and configure
git clone https://github.com/oikos-family/oikos-web.git
cd oikos-web
cp .env.example .env

# 2. Start backing services only
docker compose up -d db redis

# 3. Install Node dependencies
npm install

# 4. Set up the Python virtual environment
cd apps/api
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..

# 5. Apply database migrations
cd apps/api
source venv/bin/activate
alembic upgrade head
cd ../..

# 6. Start both the frontend and API together
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8000

---

## Development Commands

### Monorepo (root)

```bash
npm run dev          # Start all apps in watch mode
npm run build        # Build all apps and packages
npm run lint         # Lint all packages
npm run test         # Run all tests
npm run type-check   # TypeScript check all packages
```

### Frontend only (`apps/web`)

```bash
cd apps/web
npm run dev    # next dev on port 3000
npm run test   # vitest run
npm run lint   # eslint
```

### API only (`apps/api`)

```bash
cd apps/api
source venv/bin/activate
uvicorn app.main:app --reload   # dev server on port 8000
pytest                          # run all tests
pytest tests/test_auth.py       # run a single test file
alembic upgrade head            # apply pending migrations
alembic revision --autogenerate -m "description"  # create a new migration
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Async PostgreSQL connection string |
| `DATABASE_SYNC_URL` | Sync connection string (used by Alembic) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens |
| `APP_BASE_URL` | Public URL of the application |
| `ENVIRONMENT` | `development`, `staging`, or `production` |

See `.env.example` for the full list including optional email provider settings.

---

## Architecture

```
Browser
  │
  ▼
Next.js (port 3000)
  │  /api/* → proxied to FastAPI
  ▼
FastAPI (port 8000)
  │
  ├── Routers   (HTTP handling, input validation)
  ├── Services  (business logic)
  ├── Models    (SQLAlchemy ORM)
  └── Schemas   (Pydantic request/response)
        │
        ├── PostgreSQL (data)
        └── Redis (rate limiting, cache)
```

Authentication uses **httpOnly cookies** (no Authorization headers). The Next.js middleware protects dashboard routes by checking for the `access_token` cookie.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Quick start:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes following [Conventional Commits](CONTRIBUTING.md#commit-messages)
4. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide including coding standards, testing requirements, and the PR process.

---

## Reporting Issues

- **Bug reports** — use the [Bug Report template](https://github.com/oikos-family/oikos-web/issues/new?template=bug_report.yml)
- **Feature requests** — use the [Feature Request template](https://github.com/oikos-family/oikos-web/issues/new?template=feature_request.yml)
- **Security vulnerabilities** — see [SECURITY.md](SECURITY.md) (do not open public issues)

---

## Community

- [GitHub Discussions](https://github.com/oikos-family/oikos-web/discussions) — questions, ideas, general chat
- [Issues](https://github.com/oikos-family/oikos-web/issues) — bug reports and feature requests

---

## License

Oikos is open source software licensed under the [GNU General Public License v3.0](LICENSE).
