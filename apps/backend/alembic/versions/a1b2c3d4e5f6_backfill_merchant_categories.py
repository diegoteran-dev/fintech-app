"""backfill merchant categories

Revision ID: a1b2c3d4e5f6
Revises: f9a2b3c4d5e6
Create Date: 2026-04-08

Data migration — no schema changes.

Applies confirmed merchant→category corrections across ALL users:
  - Orsa (S.R.L. / E.S. Orsa-Urubo): Groceries → Transport (gas station chain)
  - Clouds Bakery: Dining / Other → Groceries (bakery, not a restaurant)
  - Mam Hair Studio: Shopping → Personal Care (hair salon)
  - Fernandez Catalan (Urubo): Other → Dining (food vendor)

Safe to re-run (idempotent WHERE clause).
When migrating to a new server this runs automatically via alembic upgrade head.
"""

from alembic import op
from sqlalchemy import text

revision = 'a1b2c3d4e5f6'
down_revision = 'f9a2b3c4d5e6'
branch_labels = None
depends_on = None

# Each entry: (LIKE pattern applied to description AND merchant, old category, new category)
_FIXES = [
    # Orsa gas stations — confirmed Transport by account owner 2026-04-08
    ('%orsa%',              'Groceries',  'Transport'),
    # Clouds Bakery — grocery bakery shop, not a sit-down restaurant
    ('%clouds bakery%',     'Dining',     'Groceries'),
    ('%clouds bakery%',     'Other',      'Groceries'),
    # Mam Hair Studio — hair salon (legacy Shopping entries pre-detector fix)
    ('%mam hair%',          'Shopping',   'Personal Care'),
    # Fernandez Catalan / Urubo — food vendor, small cash amounts
    ('%fernandez catalan%', 'Other',      'Dining'),
]


def upgrade() -> None:
    conn = op.get_bind()
    total = 0
    for pattern, old_cat, new_cat in _FIXES:
        result = conn.execute(
            text("""
                UPDATE transactions
                   SET category = :new_cat
                 WHERE (LOWER(description) LIKE :pat
                        OR LOWER(COALESCE(merchant, '')) LIKE :pat)
                   AND category = :old_cat
            """),
            {"pat": pattern, "old_cat": old_cat, "new_cat": new_cat},
        )
        if result.rowcount:
            total += result.rowcount
            print(f"  backfill: [{old_cat}] → [{new_cat}]  ({result.rowcount} rows)  pattern={pattern!r}")
    print(f"  backfill total: {total} transactions updated")


def downgrade() -> None:
    # Intentionally a no-op: we cannot safely reverse category data changes
    # without knowing which rows were genuinely user-set vs auto-assigned.
    pass
