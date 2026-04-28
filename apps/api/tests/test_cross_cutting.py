"""Smoke tests for cross-cutting concerns: config, main app, schema imports, models."""
import importlib
import pytest

from app.core.config import settings


# ── Config ─────────────────────────────────────────────────────────────────

def test_settings_required_fields_present():
    assert settings.DATABASE_URL
    assert settings.DATABASE_SYNC_URL
    assert settings.REDIS_URL
    assert settings.JWT_SECRET_KEY


def test_settings_defaults():
    assert settings.JWT_ALGORITHM == "HS256"
    assert settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0
    assert settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS > 0


# ── Health endpoint ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ── Validation handler returns 422 with detail ─────────────────────────────

@pytest.mark.asyncio
async def test_validation_handler_returns_detail(client):
    """Send a payload that fails request validation and verify the body shape."""
    resp = await client.post("/api/v1/auth/register", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)


# ── Schema imports (catches drift between models and schemas) ─────────────

SCHEMA_MODULES = [
    "app.schemas.auth",
    "app.schemas.calendar",
    "app.schemas.child",
    "app.schemas.curriculum",
    "app.schemas.family",
    "app.schemas.note",
    "app.schemas.progress",
    "app.schemas.project",
    "app.schemas.resource",
    "app.schemas.subject",
    "app.schemas.week_planner",
]


@pytest.mark.parametrize("module_name", SCHEMA_MODULES)
def test_schema_module_imports(module_name):
    mod = importlib.import_module(module_name)
    assert mod is not None


# ── Model imports (catches alembic-vs-model drift before integration runs) ─

MODEL_MODULES = [
    "app.models.calendar",
    "app.models.child",
    "app.models.curriculum",
    "app.models.family",
    "app.models.family_member",
    "app.models.note",
    "app.models.project",
    "app.models.resource",
    "app.models.subject",
    "app.models.teaching_log",
    "app.models.user",
    "app.models.week_planner",
]


@pytest.mark.parametrize("module_name", MODEL_MODULES)
def test_model_module_imports(module_name):
    mod = importlib.import_module(module_name)
    assert mod is not None


# ── Main app routers registered ────────────────────────────────────────────

def test_main_routers_registered():
    from app.main import app
    paths = [route.path for route in app.routes]
    expected_prefixes = [
        "/api/v1/auth",
        "/api/v1/families",
        "/api/v1/invitations",
        "/api/v1/subjects",
        "/api/v1/curriculums",
        "/api/v1/week-planner",
        "/api/v1/resources",
        "/api/v1/projects",
        "/api/v1/calendar",
        "/api/v1/progress",
        "/api/v1/notes",
    ]
    for prefix in expected_prefixes:
        assert any(p.startswith(prefix) for p in paths), f"missing {prefix}"
