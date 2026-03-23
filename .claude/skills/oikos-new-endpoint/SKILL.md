---
name: oikos-new-endpoint
description: Scaffold a new FastAPI endpoint in the Oikos API following the project's layered architecture (router → service → schema → model). Use this skill whenever the user wants to add a new API route, endpoint, resource, or CRUD operation to apps/api. Trigger on phrases like "add an endpoint", "create a new route", "add a new API", "scaffold a resource", "add CRUD for X", "create a [noun] endpoint", or when the user describes a new feature that clearly needs a backend API endpoint. Also trigger when the user wants to add a new database model or schema.
---

# Oikos New Endpoint Scaffolder

The Oikos API follows a strict layered architecture. Every new endpoint touches these layers in order:

```
app/schemas/     ← Pydantic request/response shapes
app/models/      ← SQLAlchemy ORM model (if new DB table needed)
app/services/    ← Business logic (pure Python, no HTTP concerns)
app/routers/     ← FastAPI route handler (thin, delegates to service)
app/main.py      ← Router registration (if new router file)
```

Always create in this order — schemas first, models second, service third, router last.

## Step 1: Clarify before writing

Ask the user if anything is unclear:
- What is the resource name? (e.g., `lesson`, `grade`, `notification`)
- What operations are needed? (list, get, create, update, delete)
- Does it need a new DB table, or does it operate on existing models?
- Should it be authenticated (behind `get_current_user`)?

## Step 2: Schemas (`app/schemas/<resource>.py`)

Create request and response Pydantic models. Pattern from existing schemas:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LessonBase(BaseModel):
    title: str
    description: Optional[str] = None

class LessonCreate(LessonBase):
    pass

class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class LessonResponse(LessonBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

## Step 3: Model (`app/models/<resource>.py`) — only if new DB table

Pattern from existing models (async SQLAlchemy):

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

After adding a model, **always remind the user to create an Alembic migration**:
```bash
cd apps/api
alembic revision --autogenerate -m "add_lessons_table"
alembic upgrade head
```

## Step 4: Service (`app/services/<resource>_service.py`)

Business logic only — no `Request`/`Response` objects here. Receives an async `AsyncSession`:

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.lesson import Lesson
from app.schemas.lesson import LessonCreate

async def get_lessons(db: AsyncSession) -> list[Lesson]:
    result = await db.execute(select(Lesson))
    return result.scalars().all()

async def create_lesson(db: AsyncSession, data: LessonCreate) -> Lesson:
    lesson = Lesson(**data.model_dump())
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson
```

## Step 5: Router (`app/routers/<resource>.py`)

Thin handlers — validate, call service, return response. Pattern:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.lesson import LessonCreate, LessonResponse
from app.services import lesson_service

router = APIRouter(prefix="/lessons", tags=["lessons"])

@router.get("/", response_model=list[LessonResponse])
async def list_lessons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lesson_service.get_lessons(db)

@router.post("/", response_model=LessonResponse, status_code=201)
async def create_lesson(
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lesson_service.create_lesson(db, data)
```

## Step 6: Register the router in `app/main.py`

```python
from app.routers import lessons  # add this import
app.include_router(lessons.router, prefix="/api")  # add this line
```

## Step 7: Checklist

After scaffolding, confirm with the user:
- [ ] Schemas created in `app/schemas/`
- [ ] Model created in `app/models/` (if new table)
- [ ] Service created in `app/services/`
- [ ] Router created in `app/routers/`
- [ ] Router registered in `app/main.py`
- [ ] Alembic migration created and applied (if new model)
- [ ] Test file created in `apps/api/tests/` (offer to scaffold it)
