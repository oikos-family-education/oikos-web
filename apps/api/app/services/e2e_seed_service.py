"""
E2E test seeding service.

Builds a deterministic dataset for end-to-end browser tests. The dataset is
intentionally small — one family with two children, three subjects, three
curriculums (two active, one archived) — so tests can reason about exact
counts without inspecting the DB.

This module is only imported when the e2e router is mounted (gated by
E2E_SEED_SECRET in `app/main.py`). Never import it from production code paths.

See doc/12-e2e-testing-plan.md §4 for the broader test-account strategy.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.child import Child
from app.models.subject import Subject
from app.models.curriculum import Curriculum, CurriculumSubject, ChildCurriculum


# Order: child tables first, parents last. TRUNCATE ... CASCADE makes order
# non-critical, but we keep it explicit so a missing table is obvious in code
# review. Mirrors apps/api/tests/conftest.py.
TRUNCATE_TABLES_SQL = """
TRUNCATE TABLE
    teaching_logs,
    routine_entries,
    week_templates,
    portfolio_entries,
    child_achievements,
    milestone_completions,
    project_milestones,
    project_resources,
    project_subjects,
    project_children,
    projects,
    subject_resources,
    resources,
    calendar_events,
    notes,
    child_curriculums,
    curriculum_subjects,
    curriculums,
    children,
    subjects,
    family_invitations,
    family_members,
    families,
    users
RESTART IDENTITY CASCADE;
"""


# Stable, well-known credentials. Tests reference these via the seed endpoint's
# response — DO NOT hardcode them in test files.
SEED_USER_EMAIL = "e2e@oikos.test"
SEED_USER_PASSWORD = "E2ePassword1!"


async def reset_e2e_data(db: AsyncSession) -> None:
    """Truncate every table the test fixtures touch.

    Used both as a fresh-start primitive before seeding and as the per-test
    reset in write-heavy specs. Does NOT reseed — pair with `seed_e2e_data`
    if the test needs the standard dataset back.
    """
    await db.execute(text(TRUNCATE_TABLES_SQL))
    await db.commit()


async def seed_e2e_data(db: AsyncSession) -> dict:
    """Drop all data and create the standard E2E fixture dataset.

    Returns a JSON-serialisable manifest with the credentials and IDs the test
    suite needs. Tests should read this manifest (persisted to disk by the
    Playwright global setup) instead of hardcoding values.
    """
    # 1. Wipe everything ---------------------------------------------------
    await reset_e2e_data(db)

    # 2. Test user ---------------------------------------------------------
    user = User(
        email=SEED_USER_EMAIL,
        first_name="E2E",
        last_name="Tester",
        hashed_password=get_password_hash(SEED_USER_PASSWORD),
        is_active=True,
        is_verified=True,
        has_family=True,
        has_coat_of_arms=True,
    )
    db.add(user)
    await db.flush()

    # 3. Family + membership ----------------------------------------------
    family = Family(
        account_id=user.id,
        family_name="E2E Family",
        # Slug must be globally unique. Suffix with the user id so re-seeds
        # never collide if the truncate is somehow skipped.
        family_name_slug=f"e2e-family-{uuid.uuid4().hex[:6]}",
        shield_config={
            "shape": "heater",
            "primary_color": "#4f46e5",
            "secondary_color": "#a5b4fc",
            "initials": "EE",
        },
        home_languages=["English"],
        education_methods=["classical"],
        current_curriculum=[],
        visibility="local",
    )
    db.add(family)
    await db.flush()
    db.add(
        FamilyMember(family_id=family.id, user_id=user.id, role="primary")
    )

    # 4. Children ----------------------------------------------------------
    alice = Child(
        family_id=family.id,
        first_name="Alice",
        nickname=None,
        avatar_initials="A",
        birth_year=2015,
        grade_level="3",
        learning_styles=["visual"],
    )
    bob = Child(
        family_id=family.id,
        first_name="Bob",
        nickname="Bobby",
        avatar_initials="B",
        birth_year=2017,
        grade_level="1",
        learning_styles=["kinesthetic"],
    )
    db.add_all([alice, bob])
    await db.flush()

    # 5. Subjects ----------------------------------------------------------
    # All three are real subjects regardless of curriculum activity — the
    # "active vs archived" distinction lives on the Curriculum row.
    math = Subject(
        family_id=family.id,
        name="Mathematics",
        slug=f"mathematics-{uuid.uuid4().hex[:6]}",
        category="core_academic",
        color="#4f46e5",
        priority=1,
    )
    science = Subject(
        family_id=family.id,
        name="Science",
        slug=f"science-{uuid.uuid4().hex[:6]}",
        category="core_academic",
        color="#10b981",
        priority=2,
    )
    history = Subject(
        family_id=family.id,
        name="History",
        slug=f"history-{uuid.uuid4().hex[:6]}",
        category="core_academic",
        color="#f59e0b",
        priority=3,
    )
    db.add_all([math, science, history])
    await db.flush()

    # 6. Curriculums -------------------------------------------------------
    today = date.today()
    one_year_ago = today - timedelta(days=365)
    one_year_ahead = today + timedelta(days=365)

    # ACTIVE — Math, linked to Alice
    curr_math = Curriculum(
        family_id=family.id,
        name="Math 2024",
        period_type="annual",
        start_date=today,
        end_date=one_year_ahead,
        status="active",
    )
    # ACTIVE — Science, linked to Alice
    curr_science = Curriculum(
        family_id=family.id,
        name="Science 2024",
        period_type="annual",
        start_date=today,
        end_date=one_year_ahead,
        status="active",
    )
    # ARCHIVED — should NOT appear in the dashboard widget
    curr_history = Curriculum(
        family_id=family.id,
        name="History 2023 (archived)",
        period_type="annual",
        start_date=one_year_ago,
        end_date=today,
        status="archived",
    )
    db.add_all([curr_math, curr_science, curr_history])
    await db.flush()

    # Link curriculums to their subjects
    db.add_all([
        CurriculumSubject(
            curriculum_id=curr_math.id,
            subject_id=math.id,
            weekly_frequency=5,
            session_duration_minutes=45,
            is_active=True,
        ),
        CurriculumSubject(
            curriculum_id=curr_science.id,
            subject_id=science.id,
            weekly_frequency=3,
            session_duration_minutes=45,
            is_active=True,
        ),
        CurriculumSubject(
            curriculum_id=curr_history.id,
            subject_id=history.id,
            weekly_frequency=2,
            session_duration_minutes=45,
            # The link is inactive too, since the parent curriculum is archived.
            is_active=False,
        ),
    ])

    # Enrol Alice in everything; Bob has no curriculums (covers the
    # "child without an active curriculum" UI state).
    db.add_all([
        ChildCurriculum(child_id=alice.id, curriculum_id=curr_math.id),
        ChildCurriculum(child_id=alice.id, curriculum_id=curr_science.id),
        ChildCurriculum(child_id=alice.id, curriculum_id=curr_history.id),
    ])

    await db.commit()

    # 7. Manifest ----------------------------------------------------------
    return {
        "user": {
            "email": SEED_USER_EMAIL,
            "password": SEED_USER_PASSWORD,
            "id": str(user.id),
        },
        "family": {
            "id": str(family.id),
            "name": family.family_name,
            "slug": family.family_name_slug,
        },
        "children": {
            "alice": {"id": str(alice.id), "name": "Alice"},
            "bob": {"id": str(bob.id), "name": "Bob"},
        },
        "subjects": {
            "math": {"id": str(math.id), "name": "Mathematics"},
            "science": {"id": str(science.id), "name": "Science"},
            "history": {"id": str(history.id), "name": "History"},
        },
        "curriculums": {
            "math": {
                "id": str(curr_math.id),
                "name": curr_math.name,
                "status": "active",
            },
            "science": {
                "id": str(curr_science.id),
                "name": curr_science.name,
                "status": "active",
            },
            "history": {
                "id": str(curr_history.id),
                "name": curr_history.name,
                "status": "archived",
            },
        },
        "expected": {
            "active_curriculum_count": 2,
            "archived_curriculum_count": 1,
        },
    }
