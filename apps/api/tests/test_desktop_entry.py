import sys

import pytest

import desktop_entry
from app.core import config
from app.core.config import settings


@pytest.fixture(autouse=True)
def desktop_settings(monkeypatch, tmp_path):
    """The configuration the desktop shell starts the API with."""
    monkeypatch.setattr(settings, "APP_MODE", "desktop")
    monkeypatch.setattr(settings, "SESSIONS_DB_PATH", str(tmp_path / "sessions.db"))
    monkeypatch.setattr(settings, "BACKUP_DIR", str(tmp_path / "backups"))


def test_migrate_runs_chain_in_order(monkeypatch):
    calls = []
    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: calls.append("check") or 0)
    monkeypatch.setattr(desktop_entry, "_alembic_upgrade", lambda: calls.append("alembic"))
    monkeypatch.setattr(desktop_entry, "_run_seeds", lambda: calls.append("seeds"))
    assert desktop_entry.main(["migrate"]) == 0 and calls == ["check", "alembic", "seeds"]


def test_migrate_stops_on_failure(monkeypatch):
    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: 1)
    monkeypatch.setattr(desktop_entry, "_alembic_upgrade", lambda: pytest.fail("must not run"))
    assert desktop_entry.main(["migrate"]) != 0


def test_migrate_stops_when_alembic_exits(monkeypatch):
    """alembic's CLI reports a failed command by calling sys.exit(-1)."""
    def failing_upgrade():
        sys.exit(-1)

    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: 0)
    monkeypatch.setattr(desktop_entry, "_alembic_upgrade", failing_upgrade)
    monkeypatch.setattr(desktop_entry, "_run_seeds", lambda: pytest.fail("must not run"))
    assert desktop_entry.main(["migrate"]) != 0


def test_migrate_reports_seed_failure(monkeypatch, capsys):
    def failing_seeds():
        raise RuntimeError("seed boom")

    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: 0)
    monkeypatch.setattr(desktop_entry, "_alembic_upgrade", lambda: None)
    monkeypatch.setattr(desktop_entry, "_run_seeds", failing_seeds)
    assert desktop_entry.main(["migrate"]) != 0
    assert "seed boom" in capsys.readouterr().err


def test_serve_binds_localhost(monkeypatch):
    seen = {}
    monkeypatch.setattr(desktop_entry.uvicorn, "run", lambda app, host, port: seen.update(host=host, port=port))
    desktop_entry.main(["serve", "--port", "47322"])
    assert seen == {"host": "127.0.0.1", "port": 47322}


@pytest.mark.parametrize("missing", ["SESSIONS_DB_PATH", "BACKUP_DIR"])
@pytest.mark.parametrize("command", [["serve", "--port", "47322"], ["migrate"]], ids=["serve", "migrate"])
def test_desktop_mode_fails_fast_without_storage_paths(monkeypatch, capsys, missing, command):
    monkeypatch.setattr(settings, missing, "")
    monkeypatch.setattr(desktop_entry.uvicorn, "run", lambda *a, **k: pytest.fail("must not serve"))
    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: pytest.fail("must not migrate"))
    assert desktop_entry.main(command) != 0
    assert missing in capsys.readouterr().err


def test_frozen_build_ignores_env_files(monkeypatch):
    """The bundled exe must not pick up a developer's .env from a parent folder."""
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    assert config._find_env_file() is None
