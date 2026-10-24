"""Desktop restore of a family backup (.oikos): validation, safety copy, atomic import, platform remapping."""
import io
import json
import re
import uuid
import zipfile
from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.core.config import settings
from app.core.database import Base
from app.core.security import verify_password
from app.models.calendar import CalendarEvent
from app.models.child import Child
from app.models.child_highlight import ChildHighlight
from app.models.curriculum import ChildCurriculum, Curriculum, CurriculumSubject
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.lesson import Lesson, LessonBlock
from app.models.moderation import EmailBlacklist
from app.models.note import Note
from app.models.project import (
    ChildAchievement, MilestoneCompletion, PortfolioEntry, Project, ProjectChild, ProjectMilestone,
    ProjectResource, ProjectSubject,
)
from app.models.resource import Resource, SubjectResource
from app.models.subject import Subject
from app.models.teaching_log import TeachingLog
from app.models.week_planner import RoutineEntry, WeekTemplate
from app.services.backup.codec import encode_row
from app.services.backup.exporter import export_family_backup
from app.services.backup.importer import BackupError, read_backup
from app.services.backup.registry import EXPORTED

RESTORE = "/api/v1/desktop/restore"


# ── Helpers ─────────────────────────────────────────────────────────────────

async def snapshot_family(db, family_id) -> dict[str, list[str]]:
    """Every exported row of the family (as selected by the registry), minus password hashes."""
    snapshot = {}
    for rule in EXPORTED:
        table = Base.metadata.tables[rule.table]
        stmt = text(f"SELECT * FROM {rule.table} WHERE {rule.where_sql}").columns(
            **{c.name: c.type for c in table.columns}
        )
        rows = (await db.execute(stmt, {"fid": family_id})).mappings().all()
        snapshot[rule.table] = sorted(
            json.dumps(encode_row(table, {k: v for k, v in row.items() if k != "hashed_password"}), sort_keys=True)
            for row in rows
        )
    await db.commit()  # end the read transaction without expiring loaded objects
    return snapshot


async def wipe_all_user_data(db) -> None:
    """Leave only the platform seed rows, like a fresh install."""
    templates = "SELECT id FROM curriculums WHERE family_id IS NULL AND status = 'template'"
    for table in reversed(Base.metadata.sorted_tables):
        where = {
            "subjects": "WHERE NOT is_platform_subject",
            "curriculums": "WHERE NOT (family_id IS NULL AND status = 'template')",
            "curriculum_subjects": f"WHERE curriculum_id NOT IN ({templates})",
        }.get(table.name, "")
        await db.execute(text(f"DELETE FROM {table.name} {where}"))
    await db.commit()


def _rebuild(data: bytes, change) -> bytes:
    """Copy a backup zip, passing each (name, parsed JSON) through change()."""
    source = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as target:
        for name in source.namelist():
            target.writestr(name, json.dumps(change(name, json.loads(source.read(name)))))
    return out.getvalue()


def rewrite_manifest(data: bytes, **changes) -> bytes:
    return _rebuild(data, lambda name, content: {**content, **changes} if name == "manifest.json" else content)


def rewrite_table(data: bytes, name: str, rewrite) -> bytes:
    return _rebuild(data, lambda n, content: rewrite(content) if n == name else content)


def corrupt_table(data: bytes, name: str) -> bytes:
    """Duplicate the table's first row: decodes fine, then fails at INSERT (primary key) midway."""
    return rewrite_table(data, name, lambda rows: rows + rows[:1])


def _zip(files: dict[str, bytes]) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        for name, content in files.items():
            z.writestr(name, content)
    return out.getvalue()


async def _restore(desktop_client, data: bytes):
    return await desktop_client.post(RESTORE, files={"file": ("b.oikos", data)})


async def _scalar(db, sql: str, **params):
    value = (await db.execute(text(sql), params)).scalar()
    await db.commit()  # end the read transaction without expiring loaded objects
    return value


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def backup_dir(tmp_path, monkeypatch):
    """Safety copies go to a temporary folder, never the working directory."""
    path = tmp_path / "backups"
    monkeypatch.setattr(settings, "BACKUP_DIR", str(path))
    return path


@pytest_asyncio.fixture
async def platform_subject(make_subject):
    return await make_subject(None, name="Mathematics", slug="mathematics", is_platform_subject=True)


@pytest_asyncio.fixture
async def platform_template(db, platform_subject):
    template = Curriculum(
        family_id=None,
        name="Classical Year 1",
        period_type="annual",
        start_date=date(2026, 9, 1),
        end_date=date(2027, 6, 30),
        status="template",
    )
    db.add(template)
    await db.flush()
    db.add(CurriculumSubject(curriculum_id=template.id, subject_id=platform_subject.id))
    await db.commit()
    await db.refresh(template)
    return template


@pytest_asyncio.fixture
async def populate_family(db, platform_subject, platform_template):
    """Fill a family with at least one row in every exported table, using platform rows."""

    async def _populate(family_id: uuid.UUID) -> None:
        family = await db.get(Family, family_id)
        user_id = family.account_id
        db.add(FamilyMember(family_id=family_id, first_name="Grandma", role="other"))
        member = FamilyMember(family_id=family_id, first_name="Uncle", role="other")
        child = Child(
            family_id=family_id, first_name="Alice", nickname="Ali", interests=["maps"], birthdate=date(2018, 5, 1)
        )
        db.add_all([member, child])
        await db.flush()
        db.add(ChildHighlight(family_id=family_id, child_id=child.id, category="book", title="Narnia"))
        prereq = Subject(
            family_id=family_id, name="Phonics", slug="phonics", category="core_academic",
            created_by_user_id=user_id,
        )
        db.add(prereq)
        await db.flush()
        own = Subject(
            family_id=family_id, name="Reading", slug="reading", category="core_academic",
            prerequisite_subject_ids=[platform_subject.id, prereq.id], responsible_member_id=member.id,
            learning_objectives=["decode"], created_by_user_id=user_id,
        )
        curriculum = Curriculum(
            family_id=family_id, name="Year 1", period_type="annual",
            start_date=date(2026, 9, 1), end_date=date(2027, 6, 30), created_by_user_id=user_id,
        )
        template = WeekTemplate(family_id=family_id, name="Normal week")
        project = Project(family_id=family_id, title="Castles", due_date=date(2026, 12, 1))
        resource = Resource(family_id=family_id, title="Atlas", type="book")
        db.add_all([own, curriculum, template, project, resource])
        await db.flush()
        milestone = ProjectMilestone(project_id=project.id, title="Draw a keep", sort_order=1)
        lesson = Lesson(
            family_id=family_id, subject_id=platform_subject.id, created_by_user_id=user_id,
            title="Fractions", sequence_number=1, scheduled_for=date(2026, 10, 1), objectives=["halves"],
        )
        db.add_all([
            CurriculumSubject(curriculum_id=curriculum.id, subject_id=own.id, scheduled_days=[1, 3]),
            CurriculumSubject(curriculum_id=curriculum.id, subject_id=platform_subject.id),
            ChildCurriculum(child_id=child.id, curriculum_id=curriculum.id),
            ChildCurriculum(child_id=child.id, curriculum_id=platform_template.id),
            RoutineEntry(
                template_id=template.id, family_id=family_id, subject_id=platform_subject.id,
                child_ids=[child.id], day_of_week=1, start_minute=540,
            ),
            ProjectChild(project_id=project.id, child_id=child.id),
            ProjectSubject(project_id=project.id, subject_id=own.id),
            milestone,
            PortfolioEntry(project_id=project.id, child_id=child.id, title="My castle", media_urls=["a.png"]),
            ChildAchievement(project_id=project.id, child_id=child.id, certificate_number="OIK-0001"),
            ProjectResource(project_id=project.id, resource_id=resource.id),
            SubjectResource(subject_id=own.id, resource_id=resource.id, progress_notes="ch. 3"),
            lesson,
        ])
        await db.flush()
        db.add_all([
            MilestoneCompletion(milestone_id=milestone.id, child_id=child.id),
            CalendarEvent(
                family_id=family_id, title="Museum", subject_id=own.id, project_id=project.id,
                milestone_id=milestone.id, child_ids=[child.id],
                start_at=datetime(2026, 10, 2, 9, tzinfo=timezone.utc),
                end_at=datetime(2026, 10, 2, 11, tzinfo=timezone.utc),
            ),
            LessonBlock(lesson_id=lesson.id, type="text", content={"text": "Cut a pie"}),
            TeachingLog(
                family_id=family_id, taught_on=date(2026, 10, 1), child_id=child.id,
                subject_id=platform_subject.id, lesson_id=lesson.id, minutes=30, logged_by_user_id=user_id,
            ),
            Note(family_id=family_id, author_user_id=user_id, content="Library on Friday", tags=["errand"]),
        ])
        await db.commit()

        for rule in EXPORTED:
            count = await _scalar(db, f"SELECT count(*) FROM {rule.table} WHERE {rule.where_sql}", fid=family_id)
            assert count >= 1, f"populate_family leaves {rule.table} empty"

    return _populate


@pytest_asyncio.fixture
async def backup_family(db, make_user, populate_family):
    """A populated family (not the logged-in one) whose backup the restore tests upload."""
    owner = await make_user(email=f"backup-{uuid.uuid4().hex[:6]}@example.com")
    family = Family(account_id=owner.id, family_name="Brown", family_name_slug=f"brown-{uuid.uuid4().hex[:6]}")
    db.add(family)
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=owner.id, role="primary"))
    owner.has_family = True
    await db.commit()
    await populate_family(family.id)
    return owner, family


@pytest_asyncio.fixture
async def valid_backup_bytes(db, backup_family):
    _, family = backup_family
    _, data = await export_family_backup(db, family.id)
    await db.commit()  # end the read transaction without expiring loaded objects
    return data


@pytest.fixture
def user_email_in_backup(backup_family):
    return backup_family[0].email


# ── Round trip ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_round_trip_restores_identically(authed_with_family, desktop_client, db, populate_family):
    client, user, family = authed_with_family
    await populate_family(family.id)
    before = await snapshot_family(db, family.id)
    data = (await client.post("/api/v1/families/me/export")).content
    await wipe_all_user_data(db)
    assert await _scalar(db, "SELECT count(*) FROM families") == 0

    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text
    assert res.json()["emails"] == [user.email]
    assert await snapshot_family(db, family.id) == before


@pytest.mark.asyncio
async def test_restore_replaces_existing_data(desktop_client, db, authed_with_family, valid_backup_bytes, backup_family):
    """No merge: whatever was on this computer is gone, only the backup's family remains."""
    _, user, _ = authed_with_family
    owner, backup = backup_family
    # Excluded tables are emptied too, including ones that don't cascade from users or families
    db.add(EmailBlacklist(email="spam@example.com"))
    await db.commit()

    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    assert res.json()["emails"] == [owner.email]
    assert await _scalar(db, "SELECT array_agg(id) FROM families") == [backup.id]
    assert await _scalar(db, "SELECT count(*) FROM users WHERE id = :uid", uid=user.id) == 0
    assert await _scalar(db, "SELECT count(*) FROM email_blacklist") == 0


@pytest.mark.asyncio
async def test_restore_keeps_platform_rows(desktop_client, db, valid_backup_bytes, platform_subject, platform_template):
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    assert await _scalar(db, "SELECT count(*) FROM subjects WHERE id = :id", id=platform_subject.id) == 1
    assert await _scalar(db, "SELECT count(*) FROM curriculums WHERE id = :id", id=platform_template.id) == 1
    assert await _scalar(
        db, "SELECT count(*) FROM curriculum_subjects WHERE curriculum_id = :id", id=platform_template.id
    ) == 1


# ── Platform references ─────────────────────────────────────────────────────

async def _reseed_platform(db, platform_subject, platform_template):
    """Simulate another install: the same platform rows under new random ids."""
    await db.execute(text("DELETE FROM curriculums WHERE id = :id"), {"id": platform_template.id})
    await db.execute(text("DELETE FROM subjects WHERE id = :id"), {"id": platform_subject.id})
    subject = Subject(name="Mathematics", slug="mathematics", category="core_academic", is_platform_subject=True)
    template = Curriculum(
        family_id=None, name="Classical Year 1", period_type="annual",
        start_date=date(2026, 9, 1), end_date=date(2027, 6, 30), status="template",
    )
    db.add_all([subject, template])
    await db.commit()
    return subject.id, template.id


@pytest.mark.asyncio
async def test_restore_remaps_platform_subject_by_slug(
    desktop_client, db, valid_backup_bytes, backup_family, platform_subject, platform_template
):
    _, family = backup_family
    new_subject_id, new_template_id = await _reseed_platform(db, platform_subject, platform_template)
    assert new_subject_id != platform_subject.id

    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    assert await _scalar(db, "SELECT subject_id FROM lessons WHERE family_id = :fid", fid=family.id) == new_subject_id
    assert await _scalar(
        db, "SELECT subject_id FROM routine_entries WHERE family_id = :fid", fid=family.id
    ) == new_subject_id
    prereqs = await _scalar(db, "SELECT prerequisite_subject_ids FROM subjects WHERE slug = 'reading'")
    assert new_subject_id in prereqs and platform_subject.id not in prereqs
    curriculum_ids = (await db.execute(text("SELECT curriculum_id FROM child_curriculums"))).scalars().all()
    assert new_template_id in curriculum_ids


@pytest.mark.asyncio
async def test_platform_curriculum_resolves_to_oldest_template_with_that_name(
    desktop_client, db, valid_backup_bytes, platform_template
):
    newer = Curriculum(
        family_id=None, name="Classical Year 1", period_type="annual", status="template",
        start_date=date(2026, 9, 1), end_date=date(2027, 6, 30),
        created_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
    )
    db.add(newer)
    await db.commit()

    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    ids = (await db.execute(text("SELECT curriculum_id FROM child_curriculums"))).scalars().all()
    assert platform_template.id in ids and newer.id not in ids


@pytest.mark.asyncio
@pytest.mark.parametrize("marker", ["$platform_subject", "$platform_curriculum"])
async def test_unknown_platform_reference_rolls_back(
    desktop_client, db, authed_with_family, valid_backup_bytes, marker
):
    _, _, family = authed_with_family
    before = await snapshot_family(db, family.id)
    if marker == "$platform_subject":
        data = rewrite_table(valid_backup_bytes, "lessons.json", lambda rows: [
            {**r, "subject_id": {marker: "astrology"}} for r in rows
        ])
    else:
        data = rewrite_table(valid_backup_bytes, "child_curriculums.json", lambda rows: [
            {**r, "curriculum_id": {marker: "No such template"}} for r in rows
        ])
    res = await _restore(desktop_client, data)
    assert res.status_code >= 400
    assert await snapshot_family(db, family.id) == before


# ── References to rows missing from the backup ──────────────────────────────

@pytest.mark.asyncio
async def test_missing_set_null_reference_is_nulled(desktop_client, db, valid_backup_bytes):
    data = rewrite_table(valid_backup_bytes, "calendar_events.json", lambda rows: [
        {**r, "project_id": str(uuid.uuid4())} for r in rows
    ])
    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text
    event = (await db.execute(text("SELECT project_id, milestone_id FROM calendar_events"))).one()
    assert event.project_id is None and event.milestone_id is not None


@pytest.mark.asyncio
async def test_missing_required_reference_rolls_back(desktop_client, db, authed_with_family, valid_backup_bytes):
    _, _, family = authed_with_family
    before = await snapshot_family(db, family.id)
    data = rewrite_table(valid_backup_bytes, "teaching_logs.json", lambda rows: [
        {**r, "logged_by_user_id": str(uuid.uuid4())} for r in rows
    ])
    res = await _restore(desktop_client, data)
    assert res.status_code >= 400
    assert await snapshot_family(db, family.id) == before


@pytest.mark.asyncio
async def test_missing_prerequisite_is_dropped(desktop_client, db, valid_backup_bytes):
    stray = str(uuid.uuid4())
    data = rewrite_table(valid_backup_bytes, "subjects.json", lambda rows: [
        {**r, "prerequisite_subject_ids": r["prerequisite_subject_ids"] + [stray]} for r in rows
    ])
    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text
    prereqs = await _scalar(db, "SELECT prerequisite_subject_ids FROM subjects WHERE slug = 'reading'")
    assert len(prereqs) == 2 and uuid.UUID(stray) not in prereqs


# ── Older backups ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_missing_keys_take_column_defaults(desktop_client, db, valid_backup_bytes):
    """A backup made before a column existed has no key for it; the column default fills it."""
    data = rewrite_table(valid_backup_bytes, "children.json", lambda rows: [
        {k: v for k, v in r.items() if k not in ("is_active", "interests")} for r in rows
    ])
    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text
    child = (await db.execute(text("SELECT is_active, interests FROM children"))).one()
    assert child.is_active is True and child.interests == []


@pytest.mark.asyncio
async def test_missing_table_file_imports_as_empty(desktop_client, db, valid_backup_bytes):
    """A backup made before a table existed has no file for it."""
    source = zipfile.ZipFile(io.BytesIO(valid_backup_bytes))
    data = _zip({n: source.read(n) for n in source.namelist() if n != "child_highlights.json"})
    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text
    assert await _scalar(db, "SELECT count(*) FROM child_highlights") == 0
    assert await _scalar(db, "SELECT count(*) FROM children") == 1


@pytest.mark.asyncio
async def test_manifest_counts_are_accepted(desktop_client, valid_backup_bytes):
    data = rewrite_manifest(valid_backup_bytes, omitted={"lessons": 2}, nulled={"teaching_logs": 1})
    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text


# ── Validation ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rejects_non_backup(desktop_client):
    res = await _restore(desktop_client, b"not a zip")
    assert res.status_code == 400 and res.json()["detail"]["code"] == "not_a_backup"


@pytest.mark.asyncio
async def test_rejects_zip_without_manifest(desktop_client):
    res = await _restore(desktop_client, _zip({"users.json": b"[]"}))
    assert res.status_code == 400 and res.json()["detail"]["code"] == "not_a_backup"


@pytest.mark.asyncio
async def test_rejects_other_kind(desktop_client, valid_backup_bytes):
    res = await _restore(desktop_client, rewrite_manifest(valid_backup_bytes, kind="something-else"))
    assert res.status_code == 400 and res.json()["detail"]["code"] == "not_a_backup"


@pytest.mark.asyncio
async def test_rejects_too_new(desktop_client, valid_backup_bytes):
    data = rewrite_manifest(valid_backup_bytes, alembicRevision="ffffffffffff")
    res = await _restore(desktop_client, data)
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "backup_too_new"


@pytest.mark.asyncio
async def test_rejects_newer_format(desktop_client, valid_backup_bytes):
    res = await _restore(desktop_client, rewrite_manifest(valid_backup_bytes, format=2))
    assert res.status_code == 400 and res.json()["detail"]["code"] == "backup_too_new"


@pytest.mark.asyncio
async def test_rejected_backup_writes_no_safety_copy(desktop_client, authed_with_family, backup_dir):
    await _restore(desktop_client, b"not a zip")
    assert not list(backup_dir.glob("*.oikos"))


def test_read_backup_returns_manifest_and_every_table():
    data = _zip({
        "manifest.json": json.dumps({"format": 1, "kind": "family-backup", "alembicRevision": _head()}),
        "notes.json": b"[]",
    })
    manifest, tables = read_backup(data)
    assert manifest["kind"] == "family-backup"
    assert set(tables) == {r.table for r in EXPORTED}


def test_read_backup_rejects_malformed_table():
    data = _zip({
        "manifest.json": json.dumps({"format": 1, "kind": "family-backup", "alembicRevision": _head()}),
        "notes.json": b"{not json",
    })
    with pytest.raises(BackupError) as exc:
        read_backup(data)
    assert exc.value.code == "not_a_backup"


def _head() -> str:
    from app.core.migrations import current_revision
    return current_revision()


# ── Atomicity and safety copy ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_restore_failure_leaves_data_untouched(
    desktop_client, valid_backup_bytes, authed_with_family, db, caplog
):
    _, _, family = authed_with_family
    before = await snapshot_family(db, family.id)
    data = corrupt_table(valid_backup_bytes, "notes.json")
    res = await _restore(desktop_client, data)
    assert res.status_code >= 400
    assert res.json()["detail"]["code"] == "restore_failed"
    # It failed at the last table, after everything else had been deleted and re-inserted
    assert "notes_pkey" in caplog.text
    assert await snapshot_family(db, family.id) == before


@pytest.mark.asyncio
async def test_writes_safety_copy(desktop_client, valid_backup_bytes, authed_with_family, tmp_path, monkeypatch):
    _, _, family = authed_with_family
    monkeypatch.setattr(settings, "BACKUP_DIR", str(tmp_path))
    await _restore(desktop_client, valid_backup_bytes)
    copies = list(tmp_path.glob("auto-prerestore-*.oikos"))
    assert len(copies) >= 1
    # One normal backup per family that was on this computer
    families = {read_backup(p.read_bytes())[0]["familyId"] for p in copies}
    assert str(family.id) in families


@pytest.mark.asyncio
async def test_keeps_five_most_recent_safety_copies(desktop_client, valid_backup_bytes, backup_dir):
    backup_dir.mkdir(parents=True)
    for day in range(1, 7):
        (backup_dir / f"auto-prerestore-202001{day:02d}T000000000000Z-old.oikos").write_bytes(b"old")
    keep = backup_dir / "auto-premigrate-20200101T000000.dump"
    keep.write_bytes(b"other kind")

    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    names = sorted(p.name for p in backup_dir.glob("auto-prerestore-*.oikos"))
    stamps = sorted({n.split("-")[2] for n in names})
    assert len(stamps) == 5
    assert "20200101T000000000000Z" not in stamps and "20200102T000000000000Z" not in stamps
    assert keep.exists()


@pytest.mark.asyncio
@pytest.mark.parametrize("slug", ["../evil", "a/b:c", "../../.."])
async def test_safety_copy_names_ignore_crafted_slugs(desktop_client, valid_backup_bytes, backup_dir, slug):
    """A restored family's slug comes from the uploaded file; it must never steer where the next
    safety copy is written, nor make it unwritable."""
    crafted = rewrite_table(valid_backup_bytes, "families.json", lambda rows: [
        {**r, "family_name_slug": slug} for r in rows
    ])
    first = await _restore(desktop_client, crafted)
    assert first.status_code == 200, first.text

    second = await _restore(desktop_client, valid_backup_bytes)
    assert second.status_code == 200, second.text
    root = backup_dir.parent
    written = [p for p in root.rglob("*") if p.is_file()]
    assert written and all(p.parent == backup_dir for p in written), written
    for path in written:
        assert re.fullmatch(r"auto-prerestore-\d{8}T\d{12}Z-[a-z0-9-]+\.oikos", path.name), path.name


@pytest.mark.asyncio
async def test_restore_needs_backup_dir(desktop_client, valid_backup_bytes, authed_with_family, db, monkeypatch):
    """Without somewhere to put the safety copy, nothing is touched."""
    _, _, family = authed_with_family
    monkeypatch.setattr(settings, "BACKUP_DIR", "")
    before = await snapshot_family(db, family.id)
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code >= 400
    assert await snapshot_family(db, family.id) == before


# ── Accounts and sessions ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_restored_user_must_set_password(desktop_client, db, valid_backup_bytes, user_email_in_backup):
    """Backups carry no password hashes: each restored account gets an unguessable random password.

    Checked on the stored hash rather than through /auth/login, because login currently skips the
    password check entirely (the dev bypass in AuthService.authenticate_user)."""
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    hashed = await _scalar(db, "SELECT hashed_password FROM users WHERE email = :email", email=user_email_in_backup)
    assert hashed.startswith("$2")
    assert not verify_password("Password123!", hashed)


@pytest.mark.asyncio
async def test_restore_clears_sessions_after_commit(desktop_client, valid_backup_bytes, db, monkeypatch):
    seen = []

    async def _spy():
        seen.append(await _scalar(db, "SELECT count(*) FROM families"))

    import app.routers.desktop as desktop_router
    monkeypatch.setattr(desktop_router, "clear_all_sessions", _spy)
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    # Called once, and the restored data was already committed
    assert seen == [1]


@pytest.mark.asyncio
async def test_restore_is_rate_limited_per_ip(desktop_client, monkeypatch):
    calls = []

    async def _record(*args):
        calls.append(args)

    import app.routers.desktop as desktop_router
    monkeypatch.setattr(desktop_router, "check_rate_limit", _record)
    await _restore(desktop_client, b"x")
    assert calls == [("ratelimit:restore:127.0.0.1", 10, 3600)]


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", [None, "https://evil.example", "null"])
async def test_restore_refuses_requests_from_other_origins(
    desktop_client, valid_backup_bytes, authed_with_family, db, backup_dir, origin
):
    """CSRF: a page on another site can send a simple multipart POST to 127.0.0.1 without a preflight."""
    _, _, family = authed_with_family
    before = await snapshot_family(db, family.id)
    if origin is None:
        del desktop_client.headers["Origin"]
    else:
        desktop_client.headers["Origin"] = origin
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "bad_origin"
    assert await snapshot_family(db, family.id) == before
    assert not backup_dir.exists() or not list(backup_dir.iterdir())


@pytest.mark.asyncio
async def test_restore_accepts_localhost_origin(desktop_client, valid_backup_bytes):
    desktop_client.headers["Origin"] = "http://localhost:47321"
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_restore_absent_in_cloud(client):
    res = await client.post(RESTORE, files={"file": ("b.oikos", b"x")})
    assert res.status_code == 404


# ── Restored login accounts ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_restore_lists_the_account_owner_first_and_no_former_members(desktop_client, db, make_user):
    """users.json is in whatever order the database returned the rows; the owner must still come
    first, and a former member (kept only as a note's author) is not offered a login."""
    owner = await make_user(email="owner@example.com")
    co_parent = await make_user(email="aaa-co-parent@example.com")
    former = await make_user(email="0-former@example.com")
    family = Family(account_id=owner.id, family_name="Gray", family_name_slug=f"gray-{uuid.uuid4().hex[:6]}")
    db.add(family)
    await db.flush()
    db.add_all([
        FamilyMember(family_id=family.id, user_id=owner.id, role="primary"),
        FamilyMember(family_id=family.id, user_id=co_parent.id, role="co_parent"),
        Note(family_id=family.id, author_user_id=former.id, content="Left the family"),
    ])
    for user in (owner, co_parent, former):
        user.has_family = True  # the former member's flag is stale: they belong to another family
    await db.commit()
    _, data = await export_family_backup(db, family.id)
    await db.commit()

    # The owner last in the file, the former member first
    def _reorder(rows):
        rank = {owner.email: 2, co_parent.email: 1, former.email: 0}
        return sorted(rows, key=lambda row: rank[row["email"]])

    res = await _restore(desktop_client, rewrite_table(data, "users.json", _reorder))
    assert res.status_code == 200, res.text
    assert res.json()["emails"] == [owner.email, co_parent.email]
    # The former member is restored (their note keeps its author) but has no family here
    assert await _scalar(db, "SELECT has_family FROM users WHERE id = :id", id=former.id) is False
    assert await _scalar(db, "SELECT has_family FROM users WHERE id = :id", id=owner.id) is True
    assert await _scalar(db, "SELECT has_family FROM users WHERE id = :id", id=co_parent.id) is True
    assert await _scalar(db, "SELECT author_user_id FROM notes") == former.id


@pytest.mark.asyncio
async def test_restore_ignores_secret_columns_in_the_file(desktop_client, db, valid_backup_bytes, user_email_in_backup):
    """A crafted file can't plant a reset token, a lockout, moderation state or a known password."""
    planted = {
        "hashed_password": "$2b$12$known.hash.from.the.file.................................",
        "password_reset_token": "planted",
        "password_reset_token_expires_at": "2999-01-01T00:00:00+00:00",
        "failed_login_attempts": 99,
        "locked_until": "2999-01-01T00:00:00+00:00",
        "moderation_status": "banned",
        "moderation_reason": "planted",
    }
    data = rewrite_table(
        valid_backup_bytes, "users.json", lambda rows: [{**row, **planted} for row in rows]
    )
    res = await _restore(desktop_client, data)
    assert res.status_code == 200, res.text
    row = (await db.execute(
        text("SELECT * FROM users WHERE email = :email"), {"email": user_email_in_backup}
    )).mappings().one()
    await db.commit()
    assert row["hashed_password"] != planted["hashed_password"]
    assert row["hashed_password"].startswith("$2")
    assert row["password_reset_token"] is None
    assert row["password_reset_token_expires_at"] is None
    assert row["failed_login_attempts"] == 0
    assert row["locked_until"] is None
    assert row["moderation_status"] == "active"
    assert row["moderation_reason"] is None


@pytest.mark.asyncio
async def test_restore_succeeds_when_clearing_sessions_fails(desktop_client, valid_backup_bytes, db, monkeypatch, caplog):
    """The restore is already committed: the client must hear that it worked."""
    async def _boom():
        raise RuntimeError("sessions.db is locked")

    import app.routers.desktop as desktop_router
    monkeypatch.setattr(desktop_router, "clear_all_sessions", _boom)
    res = await _restore(desktop_client, valid_backup_bytes)
    assert res.status_code == 200, res.text
    assert res.json()["emails"]
    assert await _scalar(db, "SELECT count(*) FROM families") == 1
    assert "could not clear the old sessions" in caplog.text
