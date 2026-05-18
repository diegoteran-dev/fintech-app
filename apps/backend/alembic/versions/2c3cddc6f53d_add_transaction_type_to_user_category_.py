"""add transaction_type to user_category_rules

Revision ID: 2c3cddc6f53d
Revises: e5f6a7b8c9d0
Create Date: 2026-04-17 19:41:10.289279

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c3cddc6f53d'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add transaction_type column (nullable — existing rules apply to both types)
    op.add_column(
        'user_category_rules',
        sa.Column('transaction_type', sa.String(10), nullable=True),
    )
    # Drop old unique constraint and replace with one that includes transaction_type
    with op.batch_alter_table('user_category_rules') as batch_op:
        try:
            batch_op.drop_constraint('uq_user_fingerprint', type_='unique')
        except Exception:
            pass  # may not exist on SQLite
        batch_op.create_unique_constraint(
            'uq_user_fingerprint_type',
            ['user_id', 'merchant_fingerprint', 'transaction_type'],
        )


def downgrade() -> None:
    with op.batch_alter_table('user_category_rules') as batch_op:
        try:
            batch_op.drop_constraint('uq_user_fingerprint_type', type_='unique')
        except Exception:
            pass
        batch_op.create_unique_constraint(
            'uq_user_fingerprint',
            ['user_id', 'merchant_fingerprint'],
        )
    op.drop_column('user_category_rules', 'transaction_type')
