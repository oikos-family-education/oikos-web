"""Which tables a family backup contains, and how each one is scoped to the family.

Every table in Base.metadata must appear either in EXPORTED or in EXCLUDED (a test enforces it),
so a new feature can't silently drop out of backups.
"""
from dataclasses import dataclass, field

# Import every model module so Base.metadata knows all tables
from app.models import (  # noqa: F401
    beta, calendar, child, child_highlight, community, curriculum, family, family_member,
    lesson, message, moderation, note, project, resource, subject, teaching_log, user, week_planner,
)


@dataclass(frozen=True)
class TableRule:
    table: str
    # SQL condition selecting the family's rows, using the bound parameter :fid
    where_sql: str
    drop_columns: frozenset[str] = field(default_factory=frozenset)


_FAMILY_PROJECTS = "SELECT id FROM projects WHERE family_id = :fid"

# Another family's subjects can be used by this family: lessons accept public subjects and the
# subject pickers list them. Referenced public subjects are copied into the backup (the exporter
# rewrites them as owned by this family). Private ones are never exported, and the exporter treats
# references to them as if the subject had been deleted.
_REFERENCED_SUBJECTS = f"""
    SELECT subject_id FROM lessons WHERE family_id = :fid
    UNION SELECT subject_id FROM teaching_logs WHERE family_id = :fid
    UNION SELECT subject_id FROM routine_entries WHERE family_id = :fid
    UNION SELECT subject_id FROM calendar_events WHERE family_id = :fid
    UNION SELECT subject_id FROM curriculum_subjects
        WHERE curriculum_id IN (SELECT id FROM curriculums WHERE family_id = :fid)
    UNION SELECT subject_id FROM project_subjects WHERE project_id IN ({_FAMILY_PROJECTS})
    UNION SELECT subject_id FROM subject_resources
        WHERE resource_id IN (SELECT id FROM resources WHERE family_id = :fid)
    UNION SELECT unnest(prerequisite_subject_ids) FROM subjects WHERE family_id = :fid
"""

# Members, the account owner, and anyone an exported row points at (e.g. a co-parent who has left
# but still authored teaching logs). Copied-in subjects lose their author, so they don't count.
_FAMILY_USERS = """
    id IN (SELECT user_id FROM family_members WHERE family_id = :fid)
    OR id IN (SELECT account_id FROM families WHERE id = :fid)
    OR id IN (SELECT created_by_user_id FROM subjects WHERE family_id = :fid)
    OR id IN (SELECT created_by_user_id FROM curriculums WHERE family_id = :fid)
    OR id IN (SELECT created_by_user_id FROM lessons WHERE family_id = :fid)
    OR id IN (SELECT logged_by_user_id FROM teaching_logs WHERE family_id = :fid)
    OR id IN (SELECT author_user_id FROM notes WHERE family_id = :fid)
"""

_USER_SECRET_COLUMNS = frozenset({
    "hashed_password",
    "password_reset_token",
    "password_reset_token_expires_at",
    "failed_login_attempts",
    "locked_until",
})


def _user_drop_columns() -> frozenset[str]:
    users = user.User.__table__
    return _USER_SECRET_COLUMNS | {c.name for c in users.columns if c.name.startswith("moderation_")}


# Insert order: every table comes after the tables its foreign keys point at.
EXPORTED: list[TableRule] = [
    TableRule("users", _FAMILY_USERS, _user_drop_columns()),
    TableRule("families", "id = :fid"),
    TableRule("family_members", "family_id = :fid"),
    TableRule("children", "family_id = :fid"),
    TableRule("child_highlights", "family_id = :fid"),
    TableRule(
        "subjects",
        "is_platform_subject = false AND "
        f"(family_id = :fid OR (is_public = true AND id IN ({_REFERENCED_SUBJECTS})))",
    ),
    TableRule("curriculums", "family_id = :fid"),
    TableRule("curriculum_subjects", "curriculum_id IN (SELECT id FROM curriculums WHERE family_id = :fid)"),
    TableRule("child_curriculums", "child_id IN (SELECT id FROM children WHERE family_id = :fid)"),
    TableRule("week_templates", "family_id = :fid"),
    TableRule("routine_entries", "family_id = :fid"),
    TableRule("projects", "family_id = :fid"),
    TableRule("project_children", f"project_id IN ({_FAMILY_PROJECTS})"),
    TableRule("project_subjects", f"project_id IN ({_FAMILY_PROJECTS})"),
    TableRule("project_milestones", f"project_id IN ({_FAMILY_PROJECTS})"),
    TableRule(
        "milestone_completions",
        f"milestone_id IN (SELECT id FROM project_milestones WHERE project_id IN ({_FAMILY_PROJECTS}))",
    ),
    TableRule("calendar_events", "family_id = :fid"),
    TableRule("portfolio_entries", f"project_id IN ({_FAMILY_PROJECTS})"),
    TableRule("child_achievements", f"project_id IN ({_FAMILY_PROJECTS})"),
    TableRule("resources", "family_id = :fid"),
    TableRule("project_resources", f"project_id IN ({_FAMILY_PROJECTS})"),
    TableRule("subject_resources", "resource_id IN (SELECT id FROM resources WHERE family_id = :fid)"),
    TableRule("lessons", "family_id = :fid"),
    TableRule("lesson_blocks", "lesson_id IN (SELECT id FROM lessons WHERE family_id = :fid)"),
    TableRule("teaching_logs", "family_id = :fid"),
    TableRule("notes", "family_id = :fid"),
]

# Shared between families, cloud-only, or operator data: never part of a family backup.
EXCLUDED: frozenset[str] = frozenset({
    "communities",
    "community_members",
    "community_invitations",
    "community_topics",
    "community_replies",
    "community_reports",
    "community_meetups",
    "community_meetup_rsvps",
    "notifications",
    "message_threads",
    "message_thread_participants",
    "messages",
    "message_reports",
    "family_blocks",
    "family_invitations",
    "beta_applications",
    "admin_allowlist",
    "audit_log",
    "email_blacklist",
})
