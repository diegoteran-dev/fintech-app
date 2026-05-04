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
    op.add_column('users', sa.Column('dob', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('country', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'country')
    op.drop_column('users', 'dob')
