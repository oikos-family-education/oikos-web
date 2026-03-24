---
globs: apps/api/**/*.py
---

# API Conventions

## Layered architecture — always follow this separation
- **Routers** (`app/routers/`): Thin HTTP handlers. Validate input, call service, return response. No business logic.
- **Services** (`app/services/`): Business logic. Receive `AsyncSession`. No HTTP concerns (no Request/Response objects).
- **Models** (`app/models/`): SQLAlchemy ORM. UUID PKs, `created_at`/`updated_at` timestamps, CASCADE deletes.
- **Schemas** (`app/schemas/`): Pydantic v2 models. Use `model_config = {"from_attributes": True}` on response schemas.

## Router patterns
- Dependency injection: `Depends(get_db)`, `Depends(get_current_user)`
- Services as dependencies: define `get_<name>_service` factory
- Protected endpoints: `current_user: User = Depends(get_current_user)`
- POST creation: use `status_code=status.HTTP_201_CREATED`
- Register new routers in `app/main.py` with `prefix="/api/v1"`

## Error handling
- `HTTPException(status_code, detail)` for all errors
- 401: Not authenticated / invalid token
- 404: Resource not found
- 409: Conflict (duplicate resource)
- 429: Rate limited

## Database patterns
- Async sessions with `asyncpg`
- Queries: `select()` with `.where()` clauses
- After mutations: `await db.commit()` then `await db.refresh(obj)`
- Single result: `result.scalars().first()`
- List results: `result.scalars().all()`

## Model conventions
- UUID primary keys: `Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`
- Timestamps: `created_at` and `updated_at` with `timezone=True`
- Foreign keys with `ondelete="CASCADE"`
- Index foreign keys and frequently queried columns
- List fields: `ARRAY(String)`, structured data: `JSON`
