# 6. Backend (`apps/api`)

FastAPI + async SQLAlchemy + Pydantic v2. Strict three-layer separation.

## Directory layout

```
apps/api/
├── app/
│   ├── main.py                 FastAPI app, router registration, CORS, lifespan
│   ├── core/
│   │   ├── config.py           pydantic-settings for env vars
│   │   ├── database.py         async engine + session factory + get_db
│   │   └── security.py         JWT, password hashing, get_current_user
│   ├── routers/                HTTP layer — thin
│   │   ├── auth.py
│   │   ├── families.py
│   │   ├── subjects.py
│   │   ├── curriculums.py
│   │   ├── week_planner.py
│   │   ├── resources.py
│   │   └── projects.py
│   ├── services/               Business logic
│   │   ├── auth_service.py
│   │   ├── family_service.py
│   │   ├── subject_service.py
│   │   ├── curriculum_service.py
│   │   ├── week_planner_service.py
│   │   ├── resource_service.py
│   │   └── project_service.py
│   ├── models/                 SQLAlchemy ORM
│   │   ├── user.py
│   │   ├── family.py
│   │   ├── child.py
│   │   ├── subject.py
│   │   ├── curriculum.py
│   │   ├── week_planner.py
│   │   ├── resource.py
│   │   └── project.py
│   ├── schemas/                Pydantic v2 request/response
│   └── seeds/                  Seed data helpers
├── alembic/
│   ├── env.py
│   └── versions/               Migrations (see 05-database.md)
├── tests/                      pytest-asyncio, real DB
└── requirements.txt
```

## Layering rules

Enforced by [.claude/rules/api-conventions.md](../.claude/rules/api-conventions.md).

### Router
- Thin handler: validate → call service → return response.
- Dependencies: `db: AsyncSession = Depends(get_db)`, `current_user: User = Depends(get_current_user)`, and any service factory.
- Error handling: `HTTPException(status_code, detail)`. Common codes: `401`, `404`, `409`, `429`.
- POST creation uses `status_code=status.HTTP_201_CREATED`.
- Mount in `app/main.py` under `prefix="/api/v1"`.

### Service
- Takes an `AsyncSession` and domain arguments. Never sees `Request` / `Response`.
- Keeps all SQL here. Routers do not build queries.
- After mutations: `await db.commit()` then `await db.refresh(obj)`.

### Model
- UUID PKs, timezone-aware timestamps, CASCADE deletes.
- Index FKs and hot columns.
- Arrays for lists; JSON for blobs.

### Schema
- Pydantic v2. Response classes: `model_config = {"from_attributes": True}`.

## Key files

- [apps/api/app/main.py](../apps/api/app/main.py) — app factory, CORS, router registration, lifespan.
- [apps/api/app/core/security.py](../apps/api/app/core/security.py) — `create_access_token`, `create_refresh_token`, `get_current_user`, password hashing, cookie names.
- [apps/api/app/core/database.py](../apps/api/app/core/database.py) — async engine, `get_db` dependency.
- [apps/api/app/core/config.py](../apps/api/app/core/config.py) — `Settings` (DATABASE_URL, REDIS_URL, JWT_SECRET_KEY, token TTLs, CORS origins).

## API surface

All routes mounted under `/api/v1`. In dev, Next.js rewrites `/api/*` to the FastAPI host.

| Router | Representative endpoints |
|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`, `POST /auth/refresh` |
| `families` | `POST /families`, `GET /families/me`, `PATCH /families/me`, `GET/POST /families/me/children`, `PATCH/DELETE /families/me/children/{id}` |
| `subjects` | `GET/POST /subjects`, `GET/PATCH/DELETE /subjects/{id}` |
| `curriculums` | `GET/POST /curriculums`, `GET/PATCH/DELETE /curriculums/{id}`, subject/child assignment endpoints |
| `week_planner` | `GET/POST /week-templates`, `GET/PATCH/DELETE /week-templates/{id}`, `GET/POST /routine-entries`, `PATCH/DELETE /routine-entries/{id}` |
| `resources` | `GET/POST /resources`, `GET/PATCH/DELETE /resources/{id}` |
| `projects` | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}`, milestone and portfolio subresources, achievement award |

Exact paths live in the router files — treat those as the source of truth.

## Testing

- [apps/api/tests/](../apps/api/tests/) — pytest + pytest-asyncio + httpx `AsyncClient`.
- `conftest.py` creates and drops tables against the configured `DATABASE_URL`. Tests are **not** mocked.
- Run a single file:
  ```bash
  cd apps/api && pytest tests/test_auth.py
  ```

## Adding a new endpoint

The typical flow — see also the `/oikos-new-endpoint` skill:

1. Add or extend a **model** in `app/models/`. Ship a migration (`alembic revision --autogenerate`).
2. Add **schemas** in `app/schemas/` (request + response, `from_attributes=True`).
3. Add **service** functions in `app/services/` that take `AsyncSession` and do the work.
4. Add a **router** in `app/routers/` that wires HTTP to the service.
5. Register the router in `app/main.py`.
6. Add a **test** hitting the new route through `httpx.AsyncClient`.

## Common pitfalls

- Forgetting to `await db.commit()` — mutations silently don't persist.
- Returning ORM objects directly from a router without a response schema — leaks internals.
- Putting business logic in a router — violates layering, breaks reuse and tests.
- Adding an `Authorization: Bearer` flow — **don't**. Cookies only.
