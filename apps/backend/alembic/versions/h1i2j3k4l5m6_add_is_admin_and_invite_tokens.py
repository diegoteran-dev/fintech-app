"""add is_admin to users and invite_tokens table

Revision ID: h1i2j3k4l5m6
Revises: g0h1i2j3k4l5
Create Date: 2026-05-17 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'h1i2j3k4l5m6'
down_revision = 'g0h1i2j3k4l5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Add is_admin to users
    existing_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'is_admin' not in existing_cols:
        op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))
        # Make user id=1 the first admin
        conn.execute(sa.text("UPDATE users SET is_admin = true WHERE id = 1"))

    # Create invite_tokens table
    existing_tables = inspector.get_table_names()
    if 'invite_tokens' not in existing_tables:
        op.create_table(
            'invite_tokens',
            sa.Column('token', sa.String(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('token'),
        )
        op.create_index('ix_invite_tokens_token', 'invite_tokens', ['token'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    existing_tables = inspector.get_table_names()
    if 'invite_tokens' in existing_tables:
        op.drop_index('ix_invite_tokens_token', table_name='invite_tokens')
        op.drop_table('invite_tokens')

    existing_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'is_admin' in existing_cols:
        op.drop_column('users', 'is_admin')
