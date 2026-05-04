"""add dob and country to users

Revision ID: g0h1i2j3k4l5
Revises: a9af3dd6dc03
Create Date: 2026-05-03 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g0h1i2j3k4l5'
down_revision: Union[str, None] = 'a9af3dd6dc03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = [c['name'] for c in inspector.get_columns('users')]
    if 'dob' not in existing:
        op.add_column('users', sa.Column('dob', sa.Date(), nullable=True))
    if 'country' not in existing:
        op.add_column('users', sa.Column('country', sa.String(length=100), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = [c['name'] for c in inspector.get_columns('users')]
    if 'country' in existing:
        op.drop_column('users', 'country')
    if 'dob' in existing:
        op.drop_column('users', 'dob')
