"""
Shared pytest fixtures for the API test suite.

The DB fixtures hit a real PostgreSQL — see `apps/api/.env` (or `apps/api/pyproject.toml`
for pytest config). Tables are dropped + recreated once per session, then truncated
between tests for isolation. Tests should NOT be run against the production database.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

import app.core.database as core_db
from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.child import Child
from app.models.subject import Subject


# ── Engine ──────────────────────────────────────────────────────────────────

engine = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


# Replace the engine the app uses at import time so `get_current_user` (which
# opens its own AsyncSessionLocal from app.core.database) shares this engine.
core_db.engine = engine
core_db.AsyncSessionLocal = TestingSessionLocal


# ── DB lifecycle ────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session")
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# Order-sensitive: child tables first, parents last. We TRUNCATE … CASCADE so we
# don't have to maintain a perfect order, but keeping it explicit avoids surprises.
TRUNCATE_TABLES_SQL = """
TRUNCATE TABLE
    teaching_logs,
    routine_entries,
    week_templates,
    portfolio_entries,
    child_achievements,
    milestone_completions,
    project_milestones,
    project_resources,
    project_subjects,
    project_children,
    projects,
    subject_resources,
    resources,
    calendar_events,
    notes,
    child_curriculums,
    curriculum_subjects,
    curriculums,
    children,
    subjects,
    family_invitations,
    family_members,
    families,
    users
RESTART IDENTITY CASCADE;
"""


@pytest_asyncio.fixture(autouse=True)
async def _truncate_between_tests(setup_db):
    yield
    async with engine.begin() as conn:
        await conn.execute(text(TRUNCATE_TABLES_SQL))


# ── Sessions ────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db():
    """A standalone session for tests that interact with the DB directly.

    Note: routes invoked through the `client` fixture get their OWN session via
    FastAPI's dependency injection. Don't expect changes made through this fixture
    to be visible inside an in-flight request that hasn't committed yet, and vice
    versa — commit before/after to keep things deterministic.
    """
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def make_client():
    """Build an HTTP client for a given user. Returns an async factory."""
    clients: list = []

    async def _make(user: User) -> AsyncClient:
        token = create_access_token(str(user.id))
        transport = ASGITransport(app=app)
        ac = AsyncClient(transport=transport, base_url="http://test")
        ac.cookies.set("access_token", token)
        await ac.__aenter__()
        clients.append(ac)
        return ac

    yield _make
    for ac in clients:
        await ac.__aexit__(None, None, None)


@pytest_asyncio.fixture
async def fresh_session():
    """A factory that opens a fresh session each call. Useful for re-reading
    rows after a request committed them — avoids identity-map staleness from `db`."""
    sessions: list = []
    async def _open() -> AsyncSession:
        s = TestingSessionLocal()
        sessions.append(s)
        return s
    yield _open
    for s in sessions:
        await s.close()


# ── HTTP clients ────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def authed_client(db: AsyncSession) -> tuple[AsyncClient, User]:
    """A client with a logged-in user (cookie + freshly committed user row).

    Bypasses the actual auth flow so tests don't depend on rate-limiting state or
    the password verification path; both are covered separately in test_auth.py.
    """
    user = User(
        email=f"user-{uuid.uuid4().hex[:8]}@example.com",
        first_name="Test",
        last_name="User",
        hashed_password=get_password_hash("Password123!"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.set("access_token", token)
        yield ac, user


@pytest_asyncio.fixture
async def authed_with_family(authed_client, db: AsyncSession):
    """A client + user that already has a family. Returns (client, user, family)."""
    client, user = authed_client
    family = Family(
        account_id=user.id,
        family_name="Smith",
        family_name_slug=f"smith-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
        education_methods=[],
        current_curriculum=[],
    )
    db.add(family)
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role="primary"))
    user.has_family = True
    await db.commit()
    await db.refresh(family)
    yield client, user, family


# ── Factories ───────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def make_user(db: AsyncSession):
    async def _make(email: str | None = None, **overrides) -> User:
        user = User(
            email=email or f"user-{uuid.uuid4().hex[:8]}@example.com",
            first_name=overrides.pop("first_name", "Co"),
            last_name=overrides.pop("last_name", "Parent"),
            hashed_password=get_password_hash(overrides.pop("password", "Password123!")),
            **overrides,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    return _make


@pytest_asyncio.fixture
async def make_child(db: AsyncSession):
    async def _make(family_id: uuid.UUID, **overrides) -> Child:
        child = Child(
            family_id=family_id,
            first_name=overrides.pop("first_name", "Alice"),
            **overrides,
        )
        db.add(child)
        await db.commit()
        await db.refresh(child)
        return child
    return _make


@pytest_asyncio.fixture
async def make_subject(db: AsyncSession):
    async def _make(family_id: uuid.UUID | None = None, **overrides) -> Subject:
        name = overrides.pop("name", f"Math {uuid.uuid4().hex[:4]}")
        subject = Subject(
            family_id=family_id,
            name=name,
            slug=overrides.pop("slug", name.lower().replace(" ", "-")),
            category=overrides.pop("category", "core_academic"),
            color=overrides.pop("color", "#6366F1"),
            is_platform_subject=overrides.pop("is_platform_subject", False),
            is_public=overrides.pop("is_public", False),
            **overrides,
        )
        db.add(subject)
        await db.commit()
        await db.refresh(subject)
        return subject
    return _make


# ── Mock the rate limiter so tests don't depend on Redis state ──────────────

@pytest.fixture(autouse=True)
def mock_rate_limit(monkeypatch):
    async def _noop(*args, **kwargs):
        return None

    import app.services.auth_service as auth_service
    import app.routers.auth as auth_router

    monkeypatch.setattr(auth_service, "check_rate_limit", _noop)
    monkeypatch.setattr(auth_router, "check_rate_limit", _noop)
