import pytest
from httpx import AsyncClient

@pytest.fixture(autouse=True)
def mock_redis(monkeypatch):
    import app.services.auth_service as auth_service
    import app.routers.auth as auth_router
    
    async def mock_check_rate_limit(*args, **kwargs):
        pass
    
    monkeypatch.setattr(auth_service, "check_rate_limit", mock_check_rate_limit)
    monkeypatch.setattr(auth_router, "check_rate_limit", mock_check_rate_limit)

@pytest.mark.asyncio
async def test_register_happy_path(client: AsyncClient):
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "agreed_to_terms": True
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies
    data = resp.json()
    assert data["user"]["email"] == "test@example.com"

@pytest.mark.asyncio
async def test_register_existing_email(client: AsyncClient):
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test2@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "agreed_to_terms": True
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    
    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409

@pytest.mark.asyncio
async def test_login_happy_path(client: AsyncClient):
    payload = {
        "email": "test@example.com",
        "password": "Password123!"
    }
    resp = await client.post("/api/v1/auth/login", json=payload)
    assert resp.status_code == 200
    assert "access_token" in resp.cookies

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    payload = {
        "email": "test@example.com",
        "password": "WrongPassword!"
    }
    resp = await client.post("/api/v1/auth/login", json=payload)
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_forgot_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "test@example.com"})
    assert resp.status_code == 200
