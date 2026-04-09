"""add currency to budgets

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('budgets', sa.Column('currency', sa.String(3), nullable=False, server_default='USD'))


def downgrade() -> None:
    op.drop_column('budgets', 'currency')
