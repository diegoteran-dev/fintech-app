"""add cost_basis to holdings

Revision ID: a9af3dd6dc03
Revises: 2c3cddc6f53d
Create Date: 2026-04-18 00:30:58.270913

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a9af3dd6dc03'
down_revision: Union[str, None] = '2c3cddc6f53d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('holdings', sa.Column('cost_basis', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('holdings', 'cost_basis')
