"""Add parent profiles (members without login) and subject responsible parent

* family_members.user_id becomes nullable, with first_name/last_name for
  parents listed in the family without their own account
* subjects.responsible_member_id — optional parent who teaches the subject

Revision ID: b7r1c3e5i7j9
Revises: a6q0b2d4h6i8
Create Date: 2026-10-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b7r1c3e5i7j9'
down_revision: Union[str, None] = 'a6q0b2d4h6i8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('family_members', 'user_id', existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column('family_members', sa.Column('first_name', sa.String(100), nullable=True))
    op.add_column('family_members', sa.Column('last_name', sa.String(100), nullable=True))
    op.create_check_constraint(
        'ck_family_members_user_or_name', 'family_members', 'user_id IS NOT NULL OR first_name IS NOT NULL'
    )

    op.add_column(
        'subjects',
        sa.Column(
            'responsible_member_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('family_members.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_subjects_responsible_member_id', 'subjects', ['responsible_member_id'])


def downgrade() -> None:
    op.drop_index('ix_subjects_responsible_member_id', table_name='subjects')
    op.drop_column('subjects', 'responsible_member_id')

    op.execute("DELETE FROM family_members WHERE user_id IS NULL")
    op.drop_constraint('ck_family_members_user_or_name', 'family_members', type_='check')
    op.drop_column('family_members', 'last_name')
    op.drop_column('family_members', 'first_name')
    op.alter_column('family_members', 'user_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
