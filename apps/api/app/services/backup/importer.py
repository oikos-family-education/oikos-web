"""Restores a .oikos backup on the desktop app: replaces all family and user data, in one transaction."""
import io
import json
import re
import secrets
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import Table, insert, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import Base
from app.core.migrations import known_revisions
from app.core.security import get_password_hash
from app.services.backup import BACKUP_KIND, FORMAT_VERSION
from app.services.backup.codec import decode_row
from app.services.backup.exporter import PLATFORM_CURRICULUM, PLATFORM_SUBJECT, export_family_backup
from app.services.backup.registry import EXCLUDED, EXPORTED

SAFETY_COPY_PREFIX = "auto-prerestore-"
SAFETY_COPIES_KEPT = 5

_TEMPLATES_SQL = "SELECT id FROM curriculums WHERE family_id IS NULL AND status = 'template'"

# Platform seed rows survive a restore; everything else in these tables is family or user data.
_KEEP_PLATFORM_ROWS = {
    "subjects": "is_platform_subject",
    "curriculums": "family_id IS NULL AND status = 'template'",
    "curriculum_subjects": f"curriculum_id IN ({_TEMPLATES_SQL})",
}

# The restored login accounts, account owner first: only the owner and family members can log in to
# the restored family. Others in the backup (e.g. a co-parent who left but authored notes) are not offered.
_RESTORED_LOGINS_SQL = """
    SELECT u.email FROM users u
    WHERE u.id IN (SELECT account_id FROM families)
       OR u.id IN (SELECT user_id FROM family_members WHERE user_id IS NOT NULL)
    ORDER BY
        u.id NOT IN (SELECT account_id FROM families),
        (SELECT min(m.joined_at) FROM family_members m WHERE m.user_id = u.id) NULLS LAST,
        u.email
"""

# has_family means "has a family_members row"; a former member restored for authorship has none
_CLEAR_HAS_FAMILY_SQL = """
    UPDATE users SET has_family = false
    WHERE has_family AND id NOT IN (SELECT user_id FROM family_members WHERE user_id IS NOT NULL)
"""

# Columns that exported tables' foreign keys point at, by table
_TARGET_COLUMNS: dict[str, set[str]] = {}
for _rule in EXPORTED:
    for _fk in Base.metadata.tables[_rule.table].foreign_keys:
        _TARGET_COLUMNS.setdefault(_fk.column.table.name, set()).add(_fk.column.name)


class BackupError(Exception):
    def __init__(self, code: Literal["not_a_backup", "backup_too_new"], message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _not_a_backup() -> BackupError:
    return BackupError("not_a_backup", "This file is not an Oikos backup.")


def read_backup(data: bytes) -> tuple[dict, dict[str, list[dict]]]:
    """Open and check a backup. Returns its manifest and the rows of every exported table."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        manifest = json.loads(archive.read("manifest.json"))
    except (zipfile.BadZipFile, KeyError, ValueError):
        raise _not_a_backup()
    if not isinstance(manifest, dict) or manifest.get("kind") != BACKUP_KIND:
        raise _not_a_backup()
    if not isinstance(manifest.get("format"), int):
        raise _not_a_backup()
    if manifest["format"] > FORMAT_VERSION or manifest.get("alembicRevision") not in known_revisions():
        raise BackupError(
            "backup_too_new",
            "This backup was made by a newer version of Oikos. Please install the latest version first.",
        )

    names = set(archive.namelist())
    tables: dict[str, list[dict]] = {}
    for rule in EXPORTED:
        # A backup made before a table existed has no file for it
        filename = f"{rule.table}.json"
        try:
            rows = json.loads(archive.read(filename)) if filename in names else []
        except (zipfile.BadZipFile, ValueError):
            raise _not_a_backup()
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise _not_a_backup()
        tables[rule.table] = rows
    return manifest, tables


def _safety_copy_path(directory: Path, stamp: str, family_id, slug: str) -> Path:
    # A restored family's slug comes from the uploaded file: keep only what locally made slugs use,
    # so it can't leave BACKUP_DIR or make the name unwritable
    safe = re.sub(r"[^a-z0-9-]", "", slug.lower())[:60] or str(family_id)
    path = directory / f"{SAFETY_COPY_PREFIX}{stamp}-{safe}.oikos"
    if path.resolve().parent != directory.resolve():
        raise RuntimeError(f"Safety copy path {path} is outside {directory}")
    return path


async def write_safety_copy(db: AsyncSession) -> list[Path]:
    """Back up every family on this computer before a restore replaces them; keep the 5 latest restores."""
    if not settings.BACKUP_DIR:
        raise RuntimeError("BACKUP_DIR is not configured; refusing to restore without a safety copy")
    directory = Path(settings.BACKUP_DIR)
    directory.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    families = (await db.execute(text("SELECT id, family_name_slug FROM families ORDER BY created_at"))).all()
    written = []
    for family_id, slug in families:
        _, content = await export_family_backup(db, family_id)
        path = _safety_copy_path(directory, stamp, family_id, slug)
        path.write_bytes(content)
        written.append(path)

    # One restore writes one file per family, all with the same timestamp
    copies = list(directory.glob(f"{SAFETY_COPY_PREFIX}*.oikos"))
    stamps = sorted({p.name[len(SAFETY_COPY_PREFIX):].split("-")[0] for p in copies}, reverse=True)
    kept = set(stamps[:SAFETY_COPIES_KEPT])
    for path in copies:
        if path.name[len(SAFETY_COPY_PREFIX):].split("-")[0] not in kept:
            path.unlink()
    return written


async def _delete_all_data(db: AsyncSession) -> None:
    """Delete every family and user row (children first), keeping the platform seed rows."""
    exported = [rule.table for rule in EXPORTED]
    excluded = [t.name for t in reversed(Base.metadata.sorted_tables) if t.name in EXCLUDED]
    for name in excluded + list(reversed(exported)):
        keep = _KEEP_PLATFORM_ROWS.get(name)
        await db.execute(text(f"DELETE FROM {name}" + (f" WHERE NOT ({keep})" if keep else "")))


async def _platform_ids(db: AsyncSession) -> dict[str, dict[str, Any]]:
    """Local ids of the platform rows, by the key backups use: subject slug, template name.
    When several share a key, the oldest wins."""
    subjects = await db.execute(
        text("SELECT slug, id FROM subjects WHERE is_platform_subject ORDER BY created_at DESC")
    )
    templates = await db.execute(
        text(
            "SELECT name, id FROM curriculums WHERE family_id IS NULL AND status = 'template' "
            "ORDER BY created_at DESC"
        )
    )
    return {
        "subjects": dict(subjects.all()),
        "curriculums": dict(templates.all()),
    }


def _resolve_marker(value: Any, target: str, platform: dict[str, dict[str, Any]]) -> Any:
    """Map a {"$platform_subject": slug} / {"$platform_curriculum": name} marker to the local id."""
    if not isinstance(value, dict):
        return value
    marker = {"subjects": PLATFORM_SUBJECT, "curriculums": PLATFORM_CURRICULUM}.get(target)
    if marker is None or set(value) != {marker}:
        raise ValueError(f"Unexpected reference {value!r} to {target}")
    local_id = platform[target].get(value[marker])
    if local_id is None:
        raise ValueError(f"This install has no platform {target} row {value[marker]!r}")
    return local_id


def _prepare_rows(
    table: Table,
    rows: list[dict],
    inserted: dict[tuple[str, str], set],
    platform: dict[str, dict[str, Any]],
    drop_columns: frozenset[str] = frozenset(),
) -> list[dict]:
    """Decode rows and point their references at local rows. A reference to a row that isn't in
    the backup is nulled when the column is nullable and ON DELETE SET NULL; otherwise it raises.

    Columns the exporter never writes (drop_columns: password and reset secrets, lockout and
    moderation state) are ignored if a file carries them, so they take the column defaults."""
    platform_ids = {name: set(ids.values()) for name, ids in platform.items()}
    decoded = [
        decode_row(table, {key: value for key, value in row.items() if key not in drop_columns})
        for row in rows
    ]
    own_subjects = {row.get("id") for row in decoded} if table.name == "subjects" else set()

    for row in decoded:
        for column in table.columns:
            fk = next(iter(column.foreign_keys), None)
            if fk is None or row.get(column.name) is None:
                continue
            target = fk.column.table.name
            value = row[column.name] = _resolve_marker(row[column.name], target, platform)
            if value in inserted.get((target, fk.column.name), ()) or value in platform_ids.get(target, ()):
                continue
            if column.nullable and fk.ondelete == "SET NULL":
                row[column.name] = None
            else:
                raise ValueError(f"{table.name}.{column.name} points at a row that isn't in the backup")
        if table.name == "subjects" and "prerequisite_subject_ids" in row:
            prerequisites = [_resolve_marker(v, "subjects", platform) for v in row["prerequisite_subject_ids"]]
            # Like the exporter: a prerequisite that isn't there is dropped, as if it had been deleted
            row["prerequisite_subject_ids"] = [
                sid for sid in prerequisites if sid in own_subjects or sid in platform_ids["subjects"]
            ]
        if table.name == "users":
            # Backups carry no passwords: each parent sets a new one after the restore
            row["hashed_password"] = get_password_hash(secrets.token_urlsafe(32))
    return decoded


async def _insert(db: AsyncSession, table: Table, rows: list[dict]) -> None:
    # Rows are inserted in batches with the same keys, so keys missing from older backups take
    # the column defaults
    batches: dict[tuple[str, ...], list[dict]] = {}
    for row in rows:
        batches.setdefault(tuple(sorted(row)), []).append(row)
    for batch in batches.values():
        await db.execute(insert(table), batch)


async def restore_backup(db: AsyncSession, data: bytes) -> list[str]:
    """Replace all data with the backup's. Returns the emails of the restored login accounts,
    account owner first, then the other family members.

    Raises BackupError for a file this app can't restore. Any other failure rolls back the whole
    restore, leaving the data as it was (the safety copy is written before anything changes)."""
    _, tables = read_backup(data)
    try:
        await write_safety_copy(db)
        await _delete_all_data(db)
        platform = await _platform_ids(db)
        # Values of every column a foreign key points at, per table inserted so far
        inserted: dict[tuple[str, str], set] = {}
        for rule in EXPORTED:
            table = Base.metadata.tables[rule.table]
            rows = _prepare_rows(table, tables[rule.table], inserted, platform, rule.drop_columns)
            await _insert(db, table, rows)
            for name in _TARGET_COLUMNS.get(rule.table, ()):
                inserted[(rule.table, name)] = {row.get(name) for row in rows}
        await db.execute(text(_CLEAR_HAS_FAMILY_SQL))
        emails = list((await db.execute(text(_RESTORED_LOGINS_SQL))).scalars().all())
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return emails
