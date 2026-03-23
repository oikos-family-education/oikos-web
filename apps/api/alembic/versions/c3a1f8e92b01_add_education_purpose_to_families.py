"""Add education_purpose to families (and ensure families/children tables exist)

Revision ID: c3a1f8e92b01
Revises: b9ff05469e24
Create Date: 2026-03-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c3a1f8e92b01'
down_revision: Union[str, None] = 'b9ff05469e24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create families table if it doesn't exist.
    # In some environments the table was created via create_all rather than a migration.
    op.execute("""
        CREATE TABLE IF NOT EXISTS families (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            family_name VARCHAR(80) NOT NULL,
            family_name_slug VARCHAR(100) NOT NULL UNIQUE,
            shield_config JSONB NOT NULL DEFAULT '{}',
            location_city VARCHAR(100),
            location_region VARCHAR(100),
            location_country VARCHAR(100),
            location_country_code VARCHAR(2),
            faith_tradition VARCHAR(30),
            faith_denomination VARCHAR(80),
            faith_community_name VARCHAR(120),
            worldview_notes VARCHAR(300),
            education_purpose VARCHAR(30),
            education_methods TEXT[] NOT NULL DEFAULT '{}',
            current_curriculum TEXT[] NOT NULL DEFAULT '{}',
            diet VARCHAR(30),
            screen_policy VARCHAR(20),
            outdoor_orientation VARCHAR(30),
            home_languages TEXT[] NOT NULL DEFAULT '{}',
            lifestyle_tags TEXT[] NOT NULL DEFAULT '{}',
            family_culture VARCHAR(2000),
            visibility VARCHAR(10) NOT NULL DEFAULT 'private',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Create indexes on families if they don't exist
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_families_family_name_slug ON families (family_name_slug)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_families_account_id ON families (account_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_families_location_country_code ON families (location_country_code)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_families_faith_tradition ON families (faith_tradition)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_families_visibility ON families (visibility)")

    # Create children table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS children (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
            first_name VARCHAR(60) NOT NULL,
            nickname VARCHAR(40),
            gender VARCHAR(20),
            avatar_initials VARCHAR(2),
            birthdate DATE,
            birth_year INTEGER,
            birth_month INTEGER,
            grade_level VARCHAR(20),
            child_curriculum TEXT[] NOT NULL DEFAULT '{}',
            learning_styles TEXT[] NOT NULL DEFAULT '{}',
            personality_description VARCHAR(1000),
            personality_tags TEXT[] NOT NULL DEFAULT '{}',
            interests TEXT[] NOT NULL DEFAULT '{}',
            motivators VARCHAR(200),
            demotivators VARCHAR(200),
            learning_differences TEXT[] NOT NULL DEFAULT '{}',
            accommodations_notes VARCHAR(500),
            support_services TEXT[] NOT NULL DEFAULT '{}',
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_children_family_id ON children (family_id)")

    # Add education_purpose column if the table already existed without it
    op.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS education_purpose VARCHAR(30)")


def downgrade() -> None:
    op.execute("ALTER TABLE families DROP COLUMN IF EXISTS education_purpose")
