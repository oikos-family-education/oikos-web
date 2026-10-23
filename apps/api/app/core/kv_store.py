"""Key-value store used for refresh tokens and rate limits.

Cloud mode talks to Redis. Desktop mode has no Redis, so SqliteKVStore offers the subset of the
redis.asyncio API that auth_service uses, persisted in a local SQLite file so sessions survive restarts.
"""
import asyncio
import os
import sqlite3
import time

import redis.asyncio as redis

from app.core.app_mode import is_desktop
from app.core.config import settings

_SET_TTL_PREFIX = "__set_ttl__:"


def _now() -> float:
    return time.time()


def _purge_expired_set(conn: sqlite3.Connection, key: str, now: float) -> None:
    """Drop a set's members once its TTL (stored in kv under the set TTL key) has passed."""
    row = conn.execute("SELECT expires_at FROM kv WHERE key = ?", (_SET_TTL_PREFIX + key,)).fetchone()
    if row and row[0] is not None and row[0] <= now:
        conn.execute("DELETE FROM kv_set WHERE key = ?", (key,))
        conn.execute("DELETE FROM kv WHERE key = ?", (_SET_TTL_PREFIX + key,))


def _get(conn, now, key):
    row = conn.execute(
        "SELECT value FROM kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)", (key, now)
    ).fetchone()
    return row[0] if row else None


def _setex(conn, now, key, seconds, value):
    conn.execute(
        "INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
        (key, value, now + seconds),
    )
    return True


def _incr(conn, now, key):
    current = _get(conn, now, key)
    if current is None:
        # Like Redis, a fresh counter has no TTL until expire() is called
        conn.execute(
            "INSERT INTO kv (key, value, expires_at) VALUES (?, '1', NULL) "
            "ON CONFLICT(key) DO UPDATE SET value = '1', expires_at = NULL",
            (key,),
        )
        return 1
    new_value = int(current) + 1
    conn.execute("UPDATE kv SET value = ? WHERE key = ?", (str(new_value), key))
    return new_value


def _expire(conn, now, key, seconds):
    expires_at = now + seconds
    if _get(conn, now, key) is not None:
        conn.execute("UPDATE kv SET expires_at = ? WHERE key = ?", (expires_at, key))
        return True
    _purge_expired_set(conn, key, now)
    if conn.execute("SELECT 1 FROM kv_set WHERE key = ? LIMIT 1", (key,)).fetchone():
        conn.execute(
            "INSERT INTO kv (key, value, expires_at) VALUES (?, '', ?) "
            "ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at",
            (_SET_TTL_PREFIX + key, expires_at),
        )
        return True
    return False


def _delete(conn, now, *keys):
    removed = 0
    for key in keys:
        removed += conn.execute("DELETE FROM kv WHERE key = ?", (key,)).rowcount
        removed += conn.execute("DELETE FROM kv_set WHERE key = ?", (key,)).rowcount
        conn.execute("DELETE FROM kv WHERE key = ?", (_SET_TTL_PREFIX + key,))
    return removed


def _sadd(conn, now, key, *members):
    _purge_expired_set(conn, key, now)
    added = 0
    for member in members:
        added += conn.execute("INSERT OR IGNORE INTO kv_set (key, member) VALUES (?, ?)", (key, member)).rowcount
    return added


def _srem(conn, now, key, *members):
    _purge_expired_set(conn, key, now)
    removed = 0
    for member in members:
        removed += conn.execute("DELETE FROM kv_set WHERE key = ? AND member = ?", (key, member)).rowcount
    if not conn.execute("SELECT 1 FROM kv_set WHERE key = ? LIMIT 1", (key,)).fetchone():
        conn.execute("DELETE FROM kv WHERE key = ?", (_SET_TTL_PREFIX + key,))
    return removed


def _smembers(conn, now, key):
    _purge_expired_set(conn, key, now)
    return {row[0] for row in conn.execute("SELECT member FROM kv_set WHERE key = ?", (key,))}


_OPS = {
    "get": _get,
    "setex": _setex,
    "incr": _incr,
    "expire": _expire,
    "delete": _delete,
    "sadd": _sadd,
    "srem": _srem,
    "smembers": _smembers,
}


class SqliteKVPipeline:
    """Queues commands; execute() runs them in one transaction, like a Redis pipeline."""

    def __init__(self, store: "SqliteKVStore"):
        self._store = store
        self._ops: list[tuple[str, tuple]] = []

    def _queue(self, name: str, *args) -> "SqliteKVPipeline":
        self._ops.append((name, args))
        return self

    def get(self, key): return self._queue("get", key)
    def setex(self, key, seconds, value): return self._queue("setex", key, seconds, value)
    def incr(self, key): return self._queue("incr", key)
    def expire(self, key, seconds): return self._queue("expire", key, seconds)
    def delete(self, *keys): return self._queue("delete", *keys)
    def sadd(self, key, *members): return self._queue("sadd", key, *members)
    def srem(self, key, *members): return self._queue("srem", key, *members)
    def smembers(self, key): return self._queue("smembers", key)

    async def execute(self) -> list:
        ops, self._ops = self._ops, []
        return await self._store._run(ops)


class SqliteKVStore:
    def __init__(self, path: str):
        self._path = path
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        conn = self._connect()
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT, expires_at REAL NULL)")
            conn.execute(
                "CREATE TABLE IF NOT EXISTS kv_set (key TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (key, member))"
            )
        finally:
            conn.close()

    def _connect(self) -> sqlite3.Connection:
        # Autocommit mode; transactions are opened explicitly in _run_sync
        return sqlite3.connect(self._path, timeout=30, isolation_level=None)

    def _run_sync(self, ops: list[tuple[str, tuple]]) -> list:
        conn = self._connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            try:
                now = _now()
                results = [_OPS[name](conn, now, *args) for name, args in ops]
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise
            return results
        finally:
            conn.close()

    async def _run(self, ops: list[tuple[str, tuple]]) -> list:
        return await asyncio.to_thread(self._run_sync, ops)

    async def _run_one(self, name: str, *args):
        return (await self._run([(name, args)]))[0]

    def pipeline(self) -> SqliteKVPipeline:
        return SqliteKVPipeline(self)

    async def get(self, key: str) -> str | None:
        return await self._run_one("get", key)

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        return await self._run_one("setex", key, seconds, value)

    async def incr(self, key: str) -> int:
        return await self._run_one("incr", key)

    async def expire(self, key: str, seconds: int) -> bool:
        return await self._run_one("expire", key, seconds)

    async def delete(self, *keys: str) -> int:
        return await self._run_one("delete", *keys)

    async def sadd(self, key: str, *members: str) -> int:
        return await self._run_one("sadd", key, *members)

    async def srem(self, key: str, *members: str) -> int:
        return await self._run_one("srem", key, *members)

    async def smembers(self, key: str) -> set[str]:
        return await self._run_one("smembers", key)

    async def clear(self) -> None:
        def _clear() -> None:
            conn = self._connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("DELETE FROM kv")
                conn.execute("DELETE FROM kv_set")
                conn.execute("COMMIT")
            finally:
                conn.close()

        await asyncio.to_thread(_clear)


def make_kv_client():
    if is_desktop():
        return SqliteKVStore(settings.SESSIONS_DB_PATH)
    return redis.from_url(settings.REDIS_URL, decode_responses=True)
