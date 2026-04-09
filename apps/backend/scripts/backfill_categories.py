"""
backfill_categories.py
======================
One-time script: re-applies confirmed merchant→category rules to ALL users'
existing transactions. Safe to run multiple times (idempotent).

Run from apps/backend/ with the venv active:
    python scripts/backfill_categories.py

On Render Shell (vault-api service → Shell tab):
    python scripts/backfill_categories.py
"""

import sys
import os

# Allow running from apps/backend/ or from the repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

# ---------------------------------------------------------------------------
# Rules confirmed by Diego Teran on 2026-04-08
# Format: (SQL LIKE pattern, wrong_category_or_None, correct_category)
# None for wrong_category means "fix regardless of current category".
# ---------------------------------------------------------------------------
RULES = [
    # Orsa service stations — was auto-detected as Groceries, correct is Transport
    # Matches: "Orsa S.R.L.-Suc Urub", "E.S. Orsa-Urubo Ax B", any Orsa variant
    ("LIKE '%Orsa%'",           'Groceries',    'Transport'),
    ("LIKE '%orsa%'",           'Groceries',    'Transport'),

    # Clouds Bakery — bakery/grocery shop, was Dining or Other
    ("LIKE '%Clouds Bakery%'",  'Dining',       'Groceries'),
    ("LIKE '%Clouds Bakery%'",  'Other',        'Groceries'),
    ("LIKE '%clouds bakery%'",  'Dining',       'Groceries'),
    ("LIKE '%clouds bakery%'",  'Other',        'Groceries'),

    # Mam Hair Studio — hair salon, was Shopping
    ("LIKE '%Mam Hair%'",       'Shopping',     'Personal Care'),
    ("LIKE '%mam hair%'",       'Shopping',     'Personal Care'),

    # Fernandez Catalan (Urubo) — food vendor, was Other
    ("LIKE '%FERNANDEZ CATALAN%'", 'Other',     'Dining'),
    ("LIKE '%fernandez catalan%'", 'Other',     'Dining'),
]


def run():
    total_fixed = 0
    with engine.begin() as conn:
        for like_clause, wrong_cat, correct_cat in RULES:
            result = conn.execute(
                text(f"""
                    UPDATE transactions
                    SET category = :correct
                    WHERE (LOWER(description) {like_clause.lower().replace('like', 'like')}
                           OR LOWER(COALESCE(merchant, '')) {like_clause.lower().replace('like', 'like')})
                      AND category = :wrong
                """),
                {"correct": correct_cat, "wrong": wrong_cat},
            )
            n = result.rowcount
            if n:
                print(f"  ✓ [{wrong_cat}] → [{correct_cat}]  ({n} rows)  pattern: {like_clause}")
                total_fixed += n

    print(f"\nDone — {total_fixed} transactions updated across all users.")


if __name__ == "__main__":
    print("Backfilling merchant categories for all users...\n")
    run()
