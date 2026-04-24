"""Add family_members and family_invitations tables

Revision ID: n4j2m6i0b1l2
Revises: m3i1l5h9a0k1
Create Date: 2026-04-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'n4j2m6i0b1l2'
down_revision: Union[str, None] = 'm3i1l5h9a0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'family_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('family_id', 'user_id', name='uq_family_members_family_user'),
    )
    op.create_index('ix_family_members_family_id', 'family_members', ['family_id'])
    op.create_index('ix_family_members_user_id', 'family_members', ['user_id'])

    # Backfill one 'primary' row per existing family using its current account_id
    op.execute(
        """
        INSERT INTO family_members (id, family_id, user_id, role, joined_at, created_at, updated_at)
        SELECT gen_random_uuid(), id, account_id, 'primary', created_at, now(), now()
        FROM families
        """
    )

    op.create_table(
        'family_invitations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('invited_by_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_family_invitations_family_id', 'family_invitations', ['family_id'])
    op.create_index('ix_family_invitations_email', 'family_invitations', ['email'])
    op.create_index('ix_family_invitations_token_hash', 'family_invitations', ['token_hash'])


def downgrade() -> None:
    op.drop_index('ix_family_invitations_token_hash', table_name='family_invitations')
    op.drop_index('ix_family_invitations_email', table_name='family_invitations')
    op.drop_index('ix_family_invitations_family_id', table_name='family_invitations')
    op.drop_table('family_invitations')

    op.drop_index('ix_family_members_user_id', table_name='family_members')
    op.drop_index('ix_family_members_family_id', table_name='family_members')
    op.drop_table('family_members')
