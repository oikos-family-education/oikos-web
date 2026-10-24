# PyInstaller spec for the desktop API: a onedir build at dist/oikos-api/oikos-api(.exe).
# Build from apps/api: pyinstaller desktop/oikos-api.spec --noconfirm
import os

from PyInstaller.utils.hooks import collect_submodules

API_DIR = os.path.dirname(SPECPATH)


def _source_tree(name):
    """(file, dest folder) pairs for a source folder, laid out as in apps/api, without bytecode caches."""
    pairs = []
    for root, dirs, files in os.walk(os.path.join(API_DIR, name)):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        dest = os.path.relpath(root, API_DIR)
        pairs += [(os.path.join(root, f), dest) for f in files]
    return pairs


def _app_modules():
    """Every module under app/. Its packages have no __init__.py, which collect_submodules can't walk."""
    modules = []
    for root, dirs, files in os.walk(os.path.join(API_DIR, "app")):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        package = os.path.relpath(root, API_DIR).replace(os.sep, ".")
        modules += [f"{package}.{f[:-3]}" for f in files if f.endswith(".py") and f != "__init__.py"]
    return modules


# Read from disk at run time: alembic loads env.py and the revisions by path, and desktop_entry loads
# the pre-flight script by path. The app's own modules (routers, models, seeds) go in the archive.
datas = [
    (os.path.join(API_DIR, "alembic.ini"), "."),
    (os.path.join(API_DIR, "scripts", "check_db_state.py"), "scripts"),
    *_source_tree("alembic"),
]

# Modules imported by name at run time, or only from the files above, which PyInstaller doesn't scan.
hiddenimports = [
    *_app_modules(),  # alembic's env.py and the seeds import routers, models and services
    *collect_submodules("uvicorn"),  # loops, protocols and lifespan are picked by name
    *collect_submodules("asyncpg"),
    *collect_submodules("passlib.handlers"),  # CryptContext loads its schemes by name
    "bcrypt",
    "psycopg2",
    "psycopg2.extensions",
    "pydantic_settings",
    *collect_submodules("alembic", filter=lambda name: not name.startswith("alembic.testing")),
    *collect_submodules("sqlalchemy.dialects.postgresql"),
    "logging.config",
    *collect_submodules("tzdata"),  # zoneinfo looks time zones up by name
]

a = Analysis(
    [os.path.join(API_DIR, "desktop_entry.py")],
    pathex=[API_DIR],
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["pytest", "_pytest", "tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="oikos-api",
    console=True,  # the desktop shell reads stdout/stderr through pipes
    upx=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="oikos-api",
    upx=False,
)
