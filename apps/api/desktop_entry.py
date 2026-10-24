"""Command-line entry point of the packaged desktop API (the `oikos-api` executable).

    oikos-api migrate             check the database, apply migrations, insert the seed data
    oikos-api serve --port 47322  serve the API on 127.0.0.1

Configured entirely through environment variables (see app/core/config.py); the desktop shell sets them.
"""
import argparse
import asyncio
import contextlib
import importlib.util
import os
import sys
from pathlib import Path

import alembic.config
import uvicorn

from app.core.config import settings


def _bundle_dir() -> Path:
    """Where the non-Python files live: PyInstaller's data folder when frozen, else apps/api."""
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def _check_db_state() -> int:
    # scripts/ is not a package; load the same pre-flight script docker compose's migrate service runs
    path = _bundle_dir() / "scripts" / "check_db_state.py"
    spec = importlib.util.spec_from_file_location("check_db_state", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.main()


def _alembic_upgrade() -> None:
    ini = settings.ALEMBIC_INI_PATH
    # alembic.ini's script_location and prepend_sys_path are relative to the working directory
    with contextlib.chdir(os.path.dirname(os.path.abspath(ini))):
        alembic.config.main(["-c", ini, "upgrade", "head"])


def _run_seeds() -> None:
    from app.seeds import run_seeds

    asyncio.run(run_seeds.main())


def _missing_desktop_settings() -> list[str]:
    if settings.APP_MODE != "desktop":
        return []
    return [name for name in ("SESSIONS_DB_PATH", "BACKUP_DIR") if not getattr(settings, name)]


def _migrate() -> int:
    code = _check_db_state()
    if code:
        return code
    for step in (_alembic_upgrade, _run_seeds):
        try:
            step()
        except SystemExit as exc:
            # alembic's CLI prints the error and exits on a failed command
            if exc.code:
                return 1
        except Exception as exc:
            print(f"oikos-api migrate: {step.__name__.lstrip('_')} failed: {exc!r}", file=sys.stderr)
            return 1
    return 0


def _serve(port: int) -> int:
    from app.main import app

    uvicorn.run(app, host="127.0.0.1", port=port)
    return 0


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="oikos-api")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="check the database, apply migrations and insert the seed data")
    serve = commands.add_parser("serve", help="serve the API on 127.0.0.1")
    serve.add_argument("--port", type=int, default=47322)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = _parse_args(argv)

    missing = _missing_desktop_settings()
    if missing:
        print(f"oikos-api: APP_MODE is desktop but {', '.join(missing)} is not set", file=sys.stderr)
        return 2

    if args.command == "migrate":
        return _migrate()
    return _serve(args.port)


if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        # Migration files are read from the install folder; don't write __pycache__ into it
        sys.dont_write_bytecode = True
    for stream in (sys.stdout, sys.stderr):
        if stream is not None:
            # The shell reads our output through pipes: keep stdout and stderr lines in order, and
            # don't rely on the pipe's default Windows code page encoding every character we print
            stream.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    sys.exit(main(sys.argv[1:]))
