"""Builds a family's .oikos backup: a zip with manifest.json and one <table>.json per exported table."""
import io
import json
import zipfile
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Table, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import Base
from app.core.migrations import current_revision
from app.services.backup import BACKUP_KIND, FORMAT_VERSION
from app.services.backup.codec import encode_row
from app.services.backup.registry import EXPORTED

# Platform subjects and curriculum templates are seeded with random ids on every install, so
# backups refer to them by slug / name and the importer maps them to the local ids.
PLATFORM_SUBJECT = "$platform_subject"
PLATFORM_CURRICULUM = "$platform_curriculum"


# Columns that exported tables' foreign keys point at, by table
_TARGET_COLUMNS: dict[str, set[str]] = {}
for _rule in EXPORTED:
    for _fk in Base.metadata.tables[_rule.table].foreign_keys:
        _TARGET_COLUMNS.setdefault(_fk.column.table.name, set()).add(_fk.column.name)


def _fk_columns(table: Table, target: str) -> list[str]:
    return [c.name for c in table.columns if any(fk.column.table.name == target for fk in c.foreign_keys)]


async def _fetch_rows(db: AsyncSession, table: Table, where_sql: str, family_id: UUID) -> list[dict]:
    stmt = text(f"SELECT * FROM {table.name} WHERE {where_sql}").columns(
        **{c.name: c.type for c in table.columns}
    )
    result = await db.execute(stmt, {"fid": family_id})
    return [dict(row) for row in result.mappings().all()]


def _adopt_subjects(rows: list[dict], family_id: str) -> None:
    """Rewrite other families' subjects as owned by this family, keeping slugs unique per family."""
    used_slugs = {r["slug"] for r in rows if r["family_id"] == family_id}
    for row in rows:
        if row["family_id"] == family_id:
            continue
        row["family_id"] = family_id
        # Their author and responsible parent belong to the other family
        row["created_by_user_id"] = None
        row["responsible_member_id"] = None
        row["is_public"] = False
        slug, n = row["slug"], 2
        while slug in used_slugs:
            slug, n = f"{row['slug']}-{n}", n + 1
        row["slug"] = slug
        used_slugs.add(slug)


def _resolve_references(
    table: Table, rows: list[dict], exported: dict[tuple[str, str], set], platform: dict[str, dict]
) -> list[dict]:
    """Treat a reference to a row that isn't in the backup (another family's private subject or
    resource) as if that row had been deleted: SET NULL references become null, and rows that
    can't exist without it (CASCADE, NOT NULL, part of the key) are left out."""
    kept = []
    for row in rows:
        for column in table.columns:
            value = row.get(column.name)
            fk = next(iter(column.foreign_keys), None)
            if value is None or fk is None:
                continue
            target = (fk.column.table.name, fk.column.name)
            if target not in exported or value in exported[target] or value in platform.get(target[0], {}):
                continue
            if column.nullable and fk.ondelete == "SET NULL":
                row[column.name] = None
            else:
                break
        else:
            kept.append(row)
    return kept


async def _platform_markers(db: AsyncSession) -> tuple[dict[str, dict], dict[str, dict]]:
    subjects = await db.execute(text("SELECT id, slug FROM subjects WHERE is_platform_subject = true"))
    curriculums = await db.execute(
        text("SELECT id, name FROM curriculums WHERE family_id IS NULL AND status = 'template'")
    )
    return (
        {str(sid): {PLATFORM_SUBJECT: slug} for sid, slug in subjects.all()},
        {str(cid): {PLATFORM_CURRICULUM: name} for cid, name in curriculums.all()},
    )


async def export_family_backup(db: AsyncSession, family_id: UUID) -> tuple[str, bytes]:
    family = (
        await db.execute(text("SELECT family_name_slug FROM families WHERE id = :fid"), {"fid": family_id})
    ).first()
    if family is None:
        raise HTTPException(status_code=404, detail="Family not found.")

    subject_markers, curriculum_markers = await _platform_markers(db)
    platform = {"subjects": subject_markers, "curriculums": curriculum_markers}
    fid = str(family_id)
    now = datetime.now(timezone.utc)
    # Values of every column a foreign key points at, per table already written (parents come first)
    exported: dict[tuple[str, str], set] = {}

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for rule in EXPORTED:
            table = Base.metadata.tables[rule.table]
            rows = [
                encode_row(table, {k: v for k, v in row.items() if k not in rule.drop_columns})
                for row in await _fetch_rows(db, table, rule.where_sql, family_id)
            ]
            if rule.table == "subjects":
                _adopt_subjects(rows, fid)
            rows = _resolve_references(table, rows, exported, platform)
            for name in _TARGET_COLUMNS.get(rule.table, ()):
                exported[(rule.table, name)] = {row[name] for row in rows}

            refs = [(c, subject_markers) for c in _fk_columns(table, "subjects")]
            refs += [(c, curriculum_markers) for c in _fk_columns(table, "curriculums")]
            for row in rows:
                for column, markers in refs:
                    row[column] = markers.get(row[column], row[column])
                if rule.table == "subjects":
                    # Drop prerequisites that aren't in the backup, as if they had been deleted
                    row["prerequisite_subject_ids"] = [
                        subject_markers.get(sid, sid)
                        for sid in row["prerequisite_subject_ids"]
                        if sid in subject_markers or sid in exported[("subjects", "id")]
                    ]
            archive.writestr(f"{rule.table}.json", json.dumps(rows))

        manifest = {
            "format": FORMAT_VERSION,
            "kind": BACKUP_KIND,
            "appVersion": settings.APP_VERSION,
            "alembicRevision": current_revision(),
            "createdAt": now.isoformat(),
            "familyId": fid,
        }
        archive.writestr("manifest.json", json.dumps(manifest))

    filename = f"Oikos-backup-{family.family_name_slug}-{now.date().isoformat()}.oikos"
    return filename, buffer.getvalue()
