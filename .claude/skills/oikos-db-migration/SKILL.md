---
name: oikos-db-migration
description: Create and manage Alembic database migrations for the Oikos API. Use this skill whenever adding new models, modifying existing tables, or managing migration state. Trigger on phrases like "create a migration", "add a column", "database migration", "alembic", "alter table", "new model needs a migration", "add a field to the database", "modify the schema".
---

# Oikos Database Migration Manager

Migrations use Alembic with async SQLAlchemy and PostgreSQL (`asyncpg`).

## Directory structure

```
apps/api/
  alembic/
    env.py              ← Async migration runner (imports all models)
    versions/           ← Migration files
  app/
    models/             ← SQLAlchemy ORM models
    core/database.py    ← Base, engine, session factory
```

## Prerequisites

The database must be running:
```bash
docker compose up -d db redis
```

## Creating a migration

### Step 1: Create or modify the model

Models live in `apps/api/app/models/`. Follow this pattern:

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class ModelName(Base):
    __tablename__ = "table_name"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    # ... other fields ...
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
```

Model conventions:
- UUID primary keys (not integer auto-increment)
- `created_at` / `updated_at` timestamps on every table
- Foreign keys with `ondelete="CASCADE"`
- `ARRAY(String)` for list fields, `JSON` for structured data
- Index foreign keys and frequently queried columns

### Step 2: Ensure model is imported in Alembic env

Check `apps/api/alembic/env.py` — it must import the new model so autogenerate can detect it. Existing imports cover User, Family, Child. Add new models there.

### Step 3: Generate migration

```bash
cd apps/api && alembic revision --autogenerate -m "descriptive_snake_case_message"
```

Naming convention: descriptive snake_case — e.g., `add_lessons_table`, `add_grade_to_children`, `drop_lifestyle_tags`.

### Step 4: Review the generated migration

ALWAYS review the auto-generated file in `alembic/versions/`. Check:
- `upgrade()` adds the correct columns/tables
- `downgrade()` correctly reverses them
- No accidental drops or modifications to unrelated tables
- Array columns use `postgresql.ARRAY(sa.String())`
- UUID columns use `postgresql.UUID(as_uuid=True)`

### Step 5: Apply the migration

```bash
cd apps/api && alembic upgrade head
```

## Common operations

| Task | Command |
|------|---------|
| Generate migration | `cd apps/api && alembic revision --autogenerate -m "message"` |
| Apply all pending | `cd apps/api && alembic upgrade head` |
| Check current state | `cd apps/api && alembic current` |
| View history | `cd apps/api && alembic history` |
| Rollback one step | `cd apps/api && alembic downgrade -1` |

## Checklist

- [ ] Model created/modified in `app/models/`
- [ ] Model imported in `alembic/env.py`
- [ ] Migration generated with `--autogenerate`
- [ ] Migration file reviewed manually
- [ ] Migration applied with `alembic upgrade head`
- [ ] API starts without errors
