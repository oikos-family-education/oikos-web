"""create users table

Revision ID: 0001
Revises: None
Create Date: 2024-01-15 10:00:00.000000

Description:
    Initial users table for email/password authentication.
    Stores hashed passwords only. Plain-text passwords are never persisted.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ─── Identifiers ─────────────────────────────────────────────────────────────
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('password_reset_token', sa.String(length=255), nullable=True),
        sa.Column('password_reset_token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_users_email', 'users', ['email'], unique=True)
    # create index for password_reset_token WHERE it is not null
    op.create_index('idx_users_password_reset_token', 'users', ['password_reset_token'], postgresql_where=sa.text('password_reset_token IS NOT NULL'))
    op.create_index('idx_users_created_at', 'users', ['created_at'])

    op.execute(
        """
        CREATE OR REPLACE FUNCTION trigger_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER set_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
        """
    )

def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS set_users_updated_at ON users;")
    op.execute("DROP FUNCTION IF EXISTS trigger_set_updated_at;")
    op.drop_index('idx_users_created_at', table_name='users')
    op.drop_index('idx_users_password_reset_token', table_name='users')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_table('users')
