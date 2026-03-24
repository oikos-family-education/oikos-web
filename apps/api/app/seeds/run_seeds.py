"""
Seed script to insert platform subjects and curriculum templates.
Run with: python -m app.seeds.run_seeds
"""
import asyncio
import uuid
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.subject import Subject
from app.models.curriculum import Curriculum, CurriculumSubject
from app.seeds.subjects import PLATFORM_SUBJECTS
from app.seeds.curriculums import PLATFORM_CURRICULUM_TEMPLATES


async def seed_subjects(db):
    """Insert platform subjects if they don't exist."""
    result = await db.execute(
        select(Subject).where(Subject.is_platform_subject == True)
    )
    existing = {s.slug for s in result.scalars().all()}

    created = 0
    for data in PLATFORM_SUBJECTS:
        if data["slug"] in existing:
            continue
        subject = Subject(
            family_id=None,
            is_platform_subject=True,
            is_public=True,
            learning_objectives=[],
            skills_targeted=[],
            prerequisite_subject_ids=[],
            **data,
        )
        db.add(subject)
        created += 1

    await db.flush()
    print(f"Subjects: {created} created, {len(existing)} already existed.")
    return created


async def seed_curriculum_templates(db):
    """Insert platform curriculum templates if they don't exist."""
    # Build slug→id map for platform subjects
    result = await db.execute(
        select(Subject).where(Subject.is_platform_subject == True)
    )
    slug_to_id = {s.slug: s.id for s in result.scalars().all()}

    # Check existing templates
    result = await db.execute(
        select(Curriculum).where(
            Curriculum.family_id == None,
            Curriculum.status == "template",
        )
    )
    existing_names = {c.name for c in result.scalars().all()}

    created = 0
    for tmpl in PLATFORM_CURRICULUM_TEMPLATES:
        if tmpl["name"] in existing_names:
            continue

        curriculum = Curriculum(
            family_id=None,
            name=tmpl["name"],
            description=tmpl["description"],
            education_philosophy=tmpl["education_philosophy"],
            period_type=tmpl["period_type"],
            start_date=tmpl["start_date"],
            end_date=tmpl["end_date"],
            academic_year=tmpl["academic_year"],
            status="template",
            overall_goals=[],
        )
        db.add(curriculum)
        await db.flush()

        for i, (slug, freq, duration, days) in enumerate(tmpl["subjects"]):
            subject_id = slug_to_id.get(slug)
            if not subject_id:
                print(f"  WARNING: Subject '{slug}' not found for template '{tmpl['name']}'")
                continue
            cs = CurriculumSubject(
                curriculum_id=curriculum.id,
                subject_id=subject_id,
                weekly_frequency=freq,
                session_duration_minutes=duration,
                scheduled_days=days,
                preferred_time_slot="flexible",
                goals_for_period=[],
                sort_order=i,
            )
            db.add(cs)

        created += 1

    print(f"Curriculum templates: {created} created, {len(existing_names)} already existed.")
    return created


async def main():
    async with AsyncSessionLocal() as db:
        await seed_subjects(db)
        await seed_curriculum_templates(db)
        await db.commit()
        print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(main())
