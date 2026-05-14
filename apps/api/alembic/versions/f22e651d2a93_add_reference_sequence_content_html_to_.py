"""add_reference_sequence_content_html_to_lessons

Adds three columns to `lessons`:
  * reference_number (VARCHAR(64), nullable) — user-supplied free-text id
  * sequence_number  (INTEGER, NOT NULL)     — auto-incremented per (family, subject)
  * content_html     (TEXT, nullable)        — rich-text body, replaces block UI

Existing rows are backfilled with a sequence_number partitioned by
(family_id, subject_id) ordered by created_at, then a unique constraint
is created on (family_id, subject_id, sequence_number).

Revision ID: f22e651d2a93
Revises: r8n6q0m4f5p6
Create Date: 2026-05-14 15:08:42.169023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f22e651d2a93'
down_revision: Union[str, None] = 'r8n6q0m4f5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'lessons',
        sa.Column('reference_number', sa.String(length=64), nullable=True),
    )
    # Start nullable so we can backfill, then tighten to NOT NULL.
    op.add_column(
        'lessons',
        sa.Column('sequence_number', sa.Integer(), nullable=True),
    )
    op.add_column(
        'lessons',
        sa.Column('content_html', sa.Text(), nullable=True),
    )

    op.execute(
        """
        WITH numbered AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY family_id, subject_id
                   ORDER BY created_at, id
                 ) AS rn
          FROM lessons
        )
        UPDATE lessons
        SET sequence_number = numbered.rn
        FROM numbered
        WHERE lessons.id = numbered.id;
        """
    )

    op.alter_column('lessons', 'sequence_number', nullable=False)

    op.create_unique_constraint(
        'uq_lessons_family_subject_sequence',
        'lessons',
        ['family_id', 'subject_id', 'sequence_number'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_lessons_family_subject_sequence', 'lessons', type_='unique'
    )
    op.drop_column('lessons', 'content_html')
    op.drop_column('lessons', 'sequence_number')
    op.drop_column('lessons', 'reference_number')
