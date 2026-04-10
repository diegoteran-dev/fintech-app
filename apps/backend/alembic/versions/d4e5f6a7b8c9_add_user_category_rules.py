"""add user_category_rules table and is_reviewed to transactions

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_reviewed to transactions
    op.add_column(
        'transactions',
        sa.Column(
            'is_reviewed', sa.Boolean(), nullable=False, server_default='false'
        ),
    )

    # Create user_category_rules table
    op.create_table(
        'user_category_rules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id', sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('merchant_raw', sa.Text(), nullable=False),
        sa.Column('merchant_fingerprint', sa.Text(), nullable=False),
        sa.Column(
            'category_id', sa.Integer(),
            sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('source', sa.String(32), nullable=False),
        sa.Column(
            'confidence', sa.Integer(), nullable=False, server_default='100'
        ),
        sa.Column(
            'times_applied', sa.Integer(), nullable=False, server_default='0'
        ),
        sa.Column('last_applied_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        'uq_user_fingerprint',
        'user_category_rules',
        ['user_id', 'merchant_fingerprint'],
    )
    op.create_index(
        'ix_ucr_user_fingerprint',
        'user_category_rules',
        ['user_id', 'merchant_fingerprint'],
    )


def downgrade() -> None:
    op.drop_index('ix_ucr_user_fingerprint', table_name='user_category_rules')
    op.drop_constraint(
        'uq_user_fingerprint', 'user_category_rules', type_='unique'
    )
    op.drop_table('user_category_rules')
    op.drop_column('transactions', 'is_reviewed')
