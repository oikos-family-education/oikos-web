"""Add notes table

Revision ID: o5k3n7j1c2m3
Revises: n4j2m6i0b1l2
Create Date: 2026-04-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY


revision: str = 'o5k3n7j1c2m3'
down_revision: Union[str, None] = 'n4j2m6i0b1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column('entity_type', sa.String(20), nullable=True),
        sa.Column('entity_id', UUID(as_uuid=True), nullable=True),
        sa.Column('tags', ARRAY(sa.String), nullable=False, server_default=sa.text("ARRAY[]::varchar[]")),
        sa.Column('is_pinned', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('due_date', sa.Date, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint(
            "status IN ('draft','todo','in_progress','to_remember','completed','archived','history_only')",
            name='ck_notes_status_valid',
        ),
        sa.CheckConstraint(
            'entity_id IS NULL OR entity_type IS NOT NULL',
            name='ck_notes_entity_type_when_id',
        ),
        sa.CheckConstraint(
            "entity_type IS NULL OR entity_type IN ('child','subject','resource','event','project')",
            name='ck_notes_entity_type_valid',
        ),
    )

    op.create_index('ix_notes_family_id', 'notes', ['family_id'])
    op.create_index('ix_notes_author_user_id', 'notes', ['author_user_id'])
    op.create_index('ix_notes_family_status', 'notes', ['family_id', 'status'])
    op.create_index('ix_notes_family_entity', 'notes', ['family_id', 'entity_type', 'entity_id'])
    op.create_index('ix_notes_family_due_date', 'notes', ['family_id', 'due_date'])


def downgrade() -> None:
    op.drop_index('ix_notes_family_due_date', table_name='notes')
    op.drop_index('ix_notes_family_entity', table_name='notes')
    op.drop_index('ix_notes_family_status', table_name='notes')
    op.drop_index('ix_notes_author_user_id', table_name='notes')
    op.drop_index('ix_notes_family_id', table_name='notes')
    op.drop_table('notes')
