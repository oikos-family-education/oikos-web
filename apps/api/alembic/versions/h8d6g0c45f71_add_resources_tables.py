"""Add resources and subject_resources tables

Revision ID: h8d6g0c45f71
Revises: g7c5f9b34e60
Create Date: 2026-03-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'h8d6g0c45f71'
down_revision: Union[str, None] = 'g7c5f9b34e60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'resources',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('author', sa.String(255), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('url', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'subject_resources',
        sa.Column('subject_id', UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resource_id', UUID(as_uuid=True), sa.ForeignKey('resources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('progress_notes', sa.String(500), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('subject_id', 'resource_id'),
    )
    op.create_index('ix_subject_resources_resource_id', 'subject_resources', ['resource_id'])


def downgrade() -> None:
    op.drop_table('subject_resources')
    op.drop_table('resources')
