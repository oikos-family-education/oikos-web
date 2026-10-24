import time

import pytest

from app.core import kv_store
from app.core.config import settings
from app.core.kv_store import SqliteKVStore, make_kv_client

# Imported at collection time: conftest's autouse fixture later patches the module attribute to a no-op.
from app.services.auth_service import clear_all_sessions as real_clear_all_sessions


@pytest.mark.asyncio
async def test_setex_get_and_expiry(tmp_path, monkeypatch):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.setex("rt:a", 60, "user1")
    assert await store.get("rt:a") == "user1"
    monkeypatch.setattr(kv_store, "_now", lambda: time.time() + 61)
    assert await store.get("rt:a") is None


@pytest.mark.asyncio
async def test_sets_and_pipeline(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    pipe = store.pipeline()
    pipe.sadd("rt_user:u", "h1", "h2"); pipe.srem("rt_user:u", "h1"); pipe.expire("rt_user:u", 60)
    await pipe.execute()
    assert await store.smembers("rt_user:u") == {"h2"}


@pytest.mark.asyncio
async def test_set_expiry(tmp_path, monkeypatch):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.sadd("rt_user:u", "h1")
    await store.expire("rt_user:u", 60)
    assert await store.smembers("rt_user:u") == {"h1"}
    monkeypatch.setattr(kv_store, "_now", lambda: time.time() + 61)
    assert await store.smembers("rt_user:u") == set()
    # A new set under the same key must not inherit the expired TTL
    await store.sadd("rt_user:u", "h2")
    assert await store.smembers("rt_user:u") == {"h2"}


@pytest.mark.asyncio
async def test_delete_removes_values_and_sets(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.setex("rt:a", 60, "u")
    await store.sadd("rt_user:u", "h1")
    await store.expire("rt_user:u", 60)
    await store.delete("rt:a", "rt_user:u")
    assert await store.get("rt:a") is None
    assert await store.smembers("rt_user:u") == set()


@pytest.mark.asyncio
async def test_incr_counts_from_one(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    assert await store.incr("ratelimit:x") == 1
    assert await store.incr("ratelimit:x") == 2
    assert await store.get("ratelimit:x") == "2"


@pytest.mark.asyncio
async def test_incr_restarts_after_expiry(tmp_path, monkeypatch):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.incr("ratelimit:x")
    await store.expire("ratelimit:x", 60)
    monkeypatch.setattr(kv_store, "_now", lambda: time.time() + 61)
    assert await store.incr("ratelimit:x") == 1


@pytest.mark.asyncio
async def test_survives_reopen(tmp_path):
    path = str(tmp_path / "s.db")
    await SqliteKVStore(path).setex("rt:a", 3600, "user1")
    assert await SqliteKVStore(path).get("rt:a") == "user1"


@pytest.mark.asyncio
async def test_clear(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.setex("rt:a", 60, "u"); await store.clear()
    assert await store.get("rt:a") is None


def test_factory_picks_store_by_mode(desktop_mode, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SESSIONS_DB_PATH", str(tmp_path / "s.db"))
    assert isinstance(make_kv_client(), SqliteKVStore)


def test_factory_uses_redis_in_cloud_mode(monkeypatch):
    calls = []
    monkeypatch.setattr(kv_store.redis, "from_url", lambda url, **kw: calls.append((url, kw)) or "client")
    monkeypatch.setattr(settings, "REDIS_URL", "redis://example:6379/0")
    assert make_kv_client() == "client"
    assert calls == [("redis://example:6379/0", {"decode_responses": True})]


@pytest.mark.asyncio
async def test_clear_all_sessions_clears_sqlite_store(tmp_path, monkeypatch):
    from app.services import auth_service
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.setex("rt:a", 60, "u")
    monkeypatch.setattr(auth_service, "redis_client", store)
    await real_clear_all_sessions()
    assert await store.get("rt:a") is None
