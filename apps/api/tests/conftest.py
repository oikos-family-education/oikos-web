"""
Shared pytest fixtures for the API test suite.

The DB fixtures hit a real PostgreSQL, but ALWAYS against a SEPARATE test
database (default name: ``oikos_test``) — never the dev/prod DATABASE_URL.

The test DB name is derived from DATABASE_URL by swapping the final
path segment, or can be overridden by setting TEST_DATABASE_URL.

If the test DB does not exist, it is created automatically the first time
the suite runs. Tables are dropped + recreated once per session and then
truncated between tests for isolation.
"""
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse

import psycopg2
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
# Ensure community tables are registered with Base.metadata
from app.models.community import (  # noqa: F401
    Community,
    CommunityMember,
    CommunityInvitation,
    CommunityTopic,
    CommunityReply,
    CommunityReport,
)


# ── Test DB isolation ───────────────────────────────────────────────────────
#
# CRITICAL: tests must never touch the dev DATABASE_URL. We derive a
# separate database name (default `oikos_test`) on the same Postgres
# instance, refuse to run if it collides with DATABASE_URL, and create
# it on demand if missing.

_DEV_URL = settings.DATABASE_URL
_TEST_DB_NAME = os.environ.get("TEST_DB_NAME", "oikos_test")


def _swap_db_name(url: str, new_name: str) -> str:
    """Return ``url`` with its database path component replaced by ``new_name``."""
    parsed = urlparse(url)
    # path is "/<dbname>"; query string is preserved.
    new_path = "/" + new_name.lstrip("/")
    return urlunparse(parsed._replace(path=new_path))


def _strip_async_driver(url: str) -> str:
    """asyncpg URLs aren't usable from psycopg2 — strip the driver suffix."""
    return re.sub(r"\+asyncpg", "", url)


def _looks_like_test_db(db_name: str) -> bool:
    """A name is considered a test DB if it equals TEST_DB_NAME or contains "test"."""
    name = db_name.lower()
    return name == _TEST_DB_NAME.lower() or "test" in name


def _resolve_test_url() -> str:
    """Decide which URL to use for the test database.

    Priority:
      1. Explicit TEST_DATABASE_URL — trust the developer.
      2. If DATABASE_URL already targets a test-like DB (e.g. CI), reuse it
         directly so we don't create a second DB pointlessly.
      3. Otherwise (local dev), derive a sibling DB by swapping the name.
    """
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit

    dev_db_name = urlparse(_DEV_URL).path.lstrip("/")
    if _looks_like_test_db(dev_db_name):
        return _DEV_URL

    return _swap_db_name(_DEV_URL, _TEST_DB_NAME)


_TEST_URL = _resolve_test_url()


def _ensure_test_db_exists() -> None:
    """Create the test database if it does not yet exist.

    Uses a sync psycopg2 connection to the `postgres` maintenance DB on
    the same host, because CREATE DATABASE cannot run inside a transaction
    and asyncpg makes that awkward.

    Safety guard: if we somehow ended up pointed at a clearly non-test DB
    that matches DATABASE_URL, refuse to proceed. In CI/local dev with the
    resolver above, this is never hit — it's a belt-and-braces backstop.
    """
    target_name = urlparse(_TEST_URL).path.lstrip("/")
    dev_name = urlparse(_DEV_URL).path.lstrip("/")
    if (
        _TEST_URL == _DEV_URL
        and not _looks_like_test_db(target_name)
        and not os.environ.get("TEST_DATABASE_URL")
    ):
        sys.stderr.write(
            "\n\033[0;31mREFUSING TO RUN TESTS AGAINST DATABASE_URL "
            f"({dev_name}).\033[0m\n"
            "Set TEST_DATABASE_URL or TEST_DB_NAME to a separate database.\n\n"
        )
        sys.exit(2)

    admin_url = _strip_async_driver(_swap_db_name(_DEV_URL, "postgres"))
    try:
        conn = psycopg2.connect(admin_url)
    except psycopg2.OperationalError:
        # No access to the maintenance DB (some managed Postgres setups) —
        # assume the test DB already exists and let the engine fail loudly
        # later if it doesn't.
        return
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (target_name,))
            if cur.fetchone() is None:
                # Identifier — safe to interpolate because TEST_DB_NAME is
                # developer-controlled, but quote it anyway.
                cur.execute(f'CREATE DATABASE "{target_name}";')
    finally:
        conn.close()


_ensure_test_db_exists()


# ── Engine (test DB only — never DATABASE_URL) ──────────────────────────────

engine = create_async_engine(_TEST_URL, echo=False, poolclass=NullPool)
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
    lesson_blocks,
    lessons,
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
    community_reports,
    community_replies,
    community_topics,
    community_invitations,
    community_members,
    communities,
    children,
    subjects,
    family_invitations,
    family_members,
    families,
    beta_applications,
    admin_allowlist,
    audit_log,
    email_blacklist,
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


# ── Mock Redis so tests don't depend on a live Redis instance ───────────────

@pytest.fixture(autouse=True)
def mock_rate_limit(monkeypatch):
    async def _noop(*args, **kwargs):
        return None

    async def _valid(*args, **kwargs):
        return True

    import app.services.auth_service as auth_service
    import app.routers.auth as auth_router
    import app.routers.beta as beta_router
    import app.routers.admin as admin_router

    monkeypatch.setattr(auth_service, "check_rate_limit", _noop)
    monkeypatch.setattr(auth_router, "check_rate_limit", _noop)
    monkeypatch.setattr(beta_router, "check_rate_limit", _noop)
    monkeypatch.setattr(admin_router, "check_rate_limit", _noop)

    # No-op outbound email
    import app.services.email_service as email_service
    import app.services.beta_service as beta_service
    async def _no_send(**_):
        return None
    monkeypatch.setattr(email_service, "send_email", _no_send)
    monkeypatch.setattr(beta_service, "send_email", _no_send)

    # Token store — no-ops; validate always returns True so refresh tests pass
    for fn, replacement in (
        ("store_refresh_token", _noop),
        ("validate_refresh_token", _valid),
        ("rotate_refresh_token", _noop),
        ("revoke_refresh_token", _noop),
        ("revoke_all_refresh_tokens", _noop),
    ):
        monkeypatch.setattr(auth_service, fn, replacement)
        if hasattr(auth_router, fn):
            monkeypatch.setattr(auth_router, fn, replacement)
