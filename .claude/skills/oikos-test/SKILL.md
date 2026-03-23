---
name: oikos-test
description: Run tests for the Oikos monorepo — frontend (Vitest) or backend (pytest) or both. Use this skill whenever the user wants to run, execute, check, or debug tests in the Oikos project. Trigger on any mention of "test", "vitest", "pytest", "frontend tests", "api tests", "backend tests", "run tests", "check tests", or when a specific component or module name is mentioned alongside testing (e.g., "test the auth flow", "run auth tests", "check if the register endpoint works"). Also trigger when the user asks to verify something works and tests are the natural way to check.
---

# Oikos Test Runner

This monorepo has two distinct test suites with different requirements. Choose the right one based on what the user is asking about.

## Test suites

| Suite | Location | Runner | External deps |
|-------|----------|--------|---------------|
| Frontend | `apps/web` | Vitest + jsdom + Testing Library | None |
| Backend | `apps/api` | pytest + pytest-asyncio | Live PostgreSQL (real DB, not mocked) |

## Determine scope

- Mentions React, component, page, form, UI, login form, register form, or frontend → **frontend**
- Mentions endpoint, router, service, Python, FastAPI, database, auth endpoint → **backend**
- Mentions a specific file: check its extension (`.ts`/`.tsx` → frontend, `.py` → backend)
- "all tests", "run tests" with no qualifier, or both concerns → **both** (frontend first, then backend)

## Running frontend tests

```bash
cd apps/web && npm run test
```

Target a specific file:
```bash
cd apps/web && npm run test -- tests/auth.test.ts
```

No external services needed. Runs entirely in-process with jsdom.

## Running backend tests

> Backend tests hit a **real PostgreSQL database**. If you get a connection error, the database isn't running. Fix: `docker compose up -d db redis` from the repo root.

```bash
cd apps/api && pytest
```

Target a specific file:
```bash
cd apps/api && pytest tests/test_auth.py -v
```

Verbose output (recommended when investigating a failure):
```bash
cd apps/api && pytest -v
```

## Running all tests

Either sequence both suites manually, or use Turborepo from the repo root:

```bash
npm run test
```

## After running

- Report pass/fail counts for each suite
- For failures: show the test name and the specific assertion or error message — not just the count
- If backend tests fail with `asyncpg` / `sqlalchemy` / connection errors → remind the user to start Docker first
- If frontend tests fail → show which component/test and what assertion failed
