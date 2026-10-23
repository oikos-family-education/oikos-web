"""Family backup export (.oikos): classification, scoping, secrets and platform references."""
import io
import json
import uuid
import zipfile
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import ARRAY, JSON, Boolean, Date, DateTime, Integer, SmallInteger, String, Text, Uuid

from app.core.database import Base
from app.core.migrations import current_revision, known_revisions
from app.models.calendar import CalendarEvent
from app.models.curriculum import ChildCurriculum, Curriculum, CurriculumSubject
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.lesson import Lesson, LessonBlock
from app.models.project import Project, ProjectResource, ProjectSubject
from app.models.resource import Resource, SubjectResource
from app.models.teaching_log import TeachingLog
from app.services.backup import BACKUP_KIND, FORMAT_VERSION
from app.services.backup.codec import decode_row, encode_row
from app.services.backup.registry import EXCLUDED, EXPORTED


# ── Helpers ─────────────────────────────────────────────────────────────────

async def _make_other_family(db, make_user) -> Family:
    owner = await make_user()
    family = Family(
        account_id=owner.id,
        family_name="Jones",
        family_name_slug=f"jones-{uuid.uuid4().hex[:6]}",
        shield_config={},
    )
    db.add(family)
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=owner.id, role="primary"))
    await db.commit()
    await db.refresh(family)
    return family


async def _make_lesson(db, family_id, subject_id, **overrides) -> Lesson:
    lesson = Lesson(
        family_id=family_id,
        subject_id=subject_id,
        title=overrides.pop("title", "Fractions"),
        sequence_number=overrides.pop("sequence_number", 1),
        scheduled_for=overrides.pop("scheduled_for", date(2026, 10, 1)),
        **overrides,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


async def _export(client) -> zipfile.ZipFile:
    res = await client.post("/api/v1/families/me/export")
    assert res.status_code == 200, res.text
    return zipfile.ZipFile(io.BytesIO(res.content))


def _rows(z: zipfile.ZipFile, table: str) -> list[dict]:
    return json.loads(z.read(f"{table}.json"))


# ── Registry ────────────────────────────────────────────────────────────────

def test_every_table_is_classified():
    exported = {r.table for r in EXPORTED}
    assert exported.isdisjoint(EXCLUDED)
    assert set(Base.metadata.tables) == exported | EXCLUDED


def test_exported_tables_are_in_insert_order():
    """Every exported table comes after the exported tables its foreign keys point at."""
    order = [r.table for r in EXPORTED]
    for position, name in enumerate(order):
        for fk in Base.metadata.tables[name].foreign_keys:
            target = fk.column.table.name
            if target in order and target != name:
                assert order.index(target) < position, f"{name} is exported before {target}"


# ── Codec ───────────────────────────────────────────────────────────────────

def _sample(col_type):
    if isinstance(col_type, ARRAY):
        return [_sample(col_type.item_type), _sample(col_type.item_type)]
    for kind, value in (
        (Uuid, uuid.uuid4()),
        (DateTime, datetime(2026, 10, 23, 9, 30, 15, 123456, tzinfo=timezone.utc)),
        (Date, date(2026, 10, 23)),
        (Boolean, True),
        ((SmallInteger, Integer), 7),
        (JSON, {"theme": "dark", "nested": [1, {"a": None}]}),
        ((String, Text), "text"),
    ):
        if isinstance(col_type, kind):
            return value
    raise AssertionError(f"No sample for column type {col_type!r}")


def test_codec_round_trips_every_exported_column():
    for rule in EXPORTED:
        table = Base.metadata.tables[rule.table]
        row = {c.name: _sample(c.type) for c in table.columns}
        encoded = encode_row(table, row)
        # Must be plain JSON, and decode must give back the exact values
        assert decode_row(table, json.loads(json.dumps(encoded))) == row, rule.table


def test_codec_keeps_nulls():
    table = Base.metadata.tables["lessons"]
    row = {"taught_on": None, "subject_id": None, "objectives": None}
    assert decode_row(table, encode_row(table, row)) == row


# ── Migrations helper ───────────────────────────────────────────────────────

def test_current_revision_is_known():
    assert current_revision() in known_revisions()


# ── Endpoint ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_contains_only_own_family(authed_with_family, make_user, make_child, db):
    client, user, family = authed_with_family
    await make_child(family.id, first_name="Mine")
    other = await _make_other_family(db, make_user)
    await make_child(other.id, first_name="Theirs")
    res = await client.post("/api/v1/families/me/export")
    assert res.status_code == 200 and res.headers["content-type"] == "application/zip"
    assert f'Oikos-backup-{family.family_name_slug}-' in res.headers["content-disposition"]
    assert res.headers["content-disposition"].endswith('.oikos"')
    z = zipfile.ZipFile(io.BytesIO(res.content))
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["format"] == 1 and manifest["kind"] == "family-backup" and manifest["familyId"] == str(family.id)
    names = [c["first_name"] for c in json.loads(z.read("children.json"))]
    assert names == ["Mine"]


@pytest.mark.asyncio
async def test_manifest_fields(authed_with_family):
    client, _, _ = authed_with_family
    z = await _export(client)
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["format"] == FORMAT_VERSION
    assert manifest["kind"] == BACKUP_KIND
    assert manifest["alembicRevision"] == current_revision()
    assert "appVersion" in manifest
    assert datetime.fromisoformat(manifest["createdAt"]).tzinfo is not None
    # One file per exported table, even when empty
    assert set(z.namelist()) == {"manifest.json"} | {f"{r.table}.json" for r in EXPORTED}


@pytest.mark.asyncio
async def test_export_has_no_secrets(authed_with_family):
    client, _, _ = authed_with_family
    z = zipfile.ZipFile(io.BytesIO((await client.post("/api/v1/families/me/export")).content))
    raw = b"".join(z.read(n) for n in z.namelist())
    for secret in (b"hashed_password", b"password_reset_token", b"$2b$"):
        assert secret not in raw
    users = _rows(z, "users")
    assert users and not any(k.startswith("moderation_") for k in users[0])
    assert "failed_login_attempts" not in users[0] and "locked_until" not in users[0]


@pytest.mark.asyncio
async def test_export_requires_family(authed_client):
    client, _ = authed_client
    res = await client.post("/api/v1/families/me/export")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_export_is_rate_limited_per_user(authed_with_family, monkeypatch):
    client, user, _ = authed_with_family
    calls = []

    async def _record(*args):
        calls.append(args)

    import app.routers.families as families_router
    monkeypatch.setattr(families_router, "check_rate_limit", _record)
    await _export(client)
    assert calls == [(f"ratelimit:export:{user.id}", 10, 3600)]


@pytest.mark.asyncio
async def test_users_include_members_and_referenced_authors(authed_with_family, make_user, db):
    client, user, family = authed_with_family
    co_parent = await make_user(first_name="Co")
    departed = await make_user(first_name="Gone")
    stranger = await make_user(first_name="Stranger")
    db.add(FamilyMember(family_id=family.id, user_id=co_parent.id, role="co_parent"))
    # A co-parent who has since left the family still authored a teaching log
    db.add(TeachingLog(family_id=family.id, taught_on=date(2026, 10, 1), logged_by_user_id=departed.id))
    await db.commit()

    users = {u["id"] for u in _rows(await _export(client), "users")}
    assert users == {str(user.id), str(co_parent.id), str(departed.id)}
    assert str(stranger.id) not in users


@pytest.mark.asyncio
async def test_platform_subject_exported_by_slug(authed_with_family, make_subject, db):
    client, user, family = authed_with_family
    platform = await make_subject(None, slug="mathematics", is_platform_subject=True)
    await _make_lesson(db, family.id, platform.id)
    z = zipfile.ZipFile(io.BytesIO((await client.post("/api/v1/families/me/export")).content))
    lesson = json.loads(z.read("lessons.json"))[0]
    assert lesson["subject_id"] == {"$platform_subject": "mathematics"}
    assert all(s["id"] != str(platform.id) for s in json.loads(z.read("subjects.json")))


@pytest.mark.asyncio
async def test_platform_prerequisites_exported_by_slug(authed_with_family, make_subject):
    client, _, family = authed_with_family
    platform = await make_subject(None, slug="reading", is_platform_subject=True)
    own_prereq = await make_subject(family.id, slug="phonics")
    own = await make_subject(family.id, prerequisite_subject_ids=[platform.id, own_prereq.id])

    subjects = {s["id"]: s for s in _rows(await _export(client), "subjects")}
    assert subjects[str(own.id)]["prerequisite_subject_ids"] == [
        {"$platform_subject": "reading"},
        str(own_prereq.id),
    ]


@pytest.mark.asyncio
async def test_platform_curriculum_exported_by_name(authed_with_family, make_child, db):
    client, _, family = authed_with_family
    child = await make_child(family.id)
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
    db.add(ChildCurriculum(child_id=child.id, curriculum_id=template.id))
    await db.commit()

    z = await _export(client)
    assert _rows(z, "child_curriculums")[0]["curriculum_id"] == {"$platform_curriculum": "Classical Year 1"}
    assert _rows(z, "curriculums") == []


@pytest.mark.asyncio
async def test_other_familys_public_subject_is_copied_in_as_own(
    authed_with_family, make_user, make_subject, db
):
    """A lesson may use another family's public subject; the backup carries a copy owned by this family."""
    client, _, family = authed_with_family
    other = await _make_other_family(db, make_user)
    other_member = other.account_id
    own = await make_subject(family.id, name="Art", slug="art")
    theirs = await make_subject(
        other.id, name="Art", slug="art", is_public=True, created_by_user_id=other_member
    )
    unused = await make_subject(other.id, slug="unused", is_public=True)
    await _make_lesson(db, family.id, theirs.id)

    z = await _export(client)
    subjects = {s["id"]: s for s in _rows(z, "subjects")}
    assert set(subjects) == {str(own.id), str(theirs.id)}
    copied = subjects[str(theirs.id)]
    assert copied["family_id"] == str(family.id)
    assert copied["created_by_user_id"] is None and copied["responsible_member_id"] is None
    assert copied["is_public"] is False
    # Slugs are unique per family, so the copy must not collide with the family's own subject
    assert copied["slug"] != "art"
    assert str(unused.id) not in subjects
    assert str(other_member) not in {u["id"] for u in _rows(z, "users")}


@pytest.mark.asyncio
async def test_other_familys_private_subject_and_resources_are_never_exported(
    authed_with_family, make_user, make_subject, make_child, db
):
    """References to rows the backup can't carry behave as if those rows had been deleted."""
    client, user, family = authed_with_family
    other = await _make_other_family(db, make_user)
    private = await make_subject(other.id, name="Secretsubjectqx", slug="secretsubjectqx", is_public=False)
    foreign_resource = Resource(family_id=other.id, title="Secretatlasqx", type="book")
    child = await make_child(family.id)
    own_subject = await make_subject(family.id, slug="history")
    own_with_prereqs = await make_subject(family.id, prerequisite_subject_ids=[private.id, own_subject.id])
    own_resource = Resource(family_id=family.id, title="Our book", type="book")
    project = Project(family_id=family.id, title="Maps")
    curriculum = Curriculum(
        family_id=family.id, name="Year 1", period_type="annual",
        start_date=date(2026, 9, 1), end_date=date(2027, 6, 30),
    )
    db.add_all([foreign_resource, own_resource, project, curriculum])
    await db.flush()
    db.add_all([
        ProjectResource(project_id=project.id, resource_id=foreign_resource.id),
        ProjectSubject(project_id=project.id, subject_id=private.id),
        CurriculumSubject(curriculum_id=curriculum.id, subject_id=private.id),
        SubjectResource(subject_id=private.id, resource_id=own_resource.id),
        CalendarEvent(
            family_id=family.id, title="Trip", subject_id=private.id,
            start_at=datetime(2026, 10, 1, 9, tzinfo=timezone.utc),
            end_at=datetime(2026, 10, 1, 10, tzinfo=timezone.utc),
        ),
    ])
    await db.commit()
    lesson = await _make_lesson(db, family.id, private.id)
    kept_lesson = await _make_lesson(db, family.id, own_subject.id)
    db.add_all([
        LessonBlock(lesson_id=lesson.id, type="text", content={"text": "hi"}),
        LessonBlock(lesson_id=kept_lesson.id, type="text", content={"text": "kept"}),
        TeachingLog(
            family_id=family.id, taught_on=date(2026, 10, 1), child_id=child.id,
            subject_id=private.id, lesson_id=lesson.id, logged_by_user_id=user.id,
        ),
    ])
    await db.commit()

    z = await _export(client)
    raw = b"".join(z.read(n) for n in z.namelist())
    for secret in (str(private.id), "Secretsubjectqx", str(foreign_resource.id), "Secretatlasqx", str(lesson.id)):
        assert secret.encode() not in raw, secret

    # ON DELETE SET NULL references become null
    assert _rows(z, "calendar_events")[0]["subject_id"] is None
    log = _rows(z, "teaching_logs")[0]
    assert log["subject_id"] is None and log["lesson_id"] is None
    # Rows that can't exist without the missing row are left out
    for table in ("project_resources", "project_subjects", "curriculum_subjects", "subject_resources"):
        assert _rows(z, table) == [], table
    assert [l["id"] for l in _rows(z, "lessons")] == [str(kept_lesson.id)]
    assert [b["lesson_id"] for b in _rows(z, "lesson_blocks")] == [str(kept_lesson.id)]
    # Prerequisites that point at a missing subject are dropped
    subjects = {s["id"]: s for s in _rows(z, "subjects")}
    assert subjects[str(own_with_prereqs.id)]["prerequisite_subject_ids"] == [str(own_subject.id)]
    assert {r["id"] for r in _rows(z, "resources")} == {str(own_resource.id)}
