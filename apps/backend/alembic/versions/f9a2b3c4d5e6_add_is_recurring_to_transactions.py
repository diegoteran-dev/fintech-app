"""add_is_recurring_to_transactions

Revision ID: f9a2b3c4d5e6
Revises: 30b07a16a845
Create Date: 2026-04-02 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f9a2b3c4d5e6'
down_revision: Union[str, None] = '30b07a16a845'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'transactions',
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('transactions', 'is_recurring')
