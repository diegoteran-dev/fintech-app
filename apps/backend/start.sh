#!/bin/bash
set -e

python3 - << 'PYEOF'
import os
from sqlalchemy import create_engine, inspect, text

db_url = os.environ.get("DATABASE_URL", "sqlite:///./vault.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        tables  = inspect(conn).get_table_names()
        has_app   = "transactions" in tables
        has_stamp = "alembic_version" in tables

    # 1. Stamp if Alembic has never run (fresh or create_all-bootstrapped DB)
    if not has_stamp:
        print("No Alembic history — stamping to head")
        from alembic.config import Config
        from alembic import command
        command.stamp(Config("alembic.ini"), "head")

    # 2. Ensure every column the current model expects actually exists.
    #    This repairs Postgres DBs bootstrapped by an older create_all.
    PATCHES = [
        ("transactions", "is_recurring", "BOOLEAN NOT NULL DEFAULT false"),
        ("transactions", "is_reviewed",  "BOOLEAN NOT NULL DEFAULT false"),
        ("transactions", "comprobante",  "VARCHAR(64)"),
        ("transactions", "created_at",   "TIMESTAMP DEFAULT now()"),
        ("transactions", "merchant",     "VARCHAR"),
        ("budgets",      "currency",     "VARCHAR(3) NOT NULL DEFAULT 'USD'"),
    ]

    with engine.connect() as conn:
        for table, col, definition in PATCHES:
            if table not in inspect(conn).get_table_names():
                continue
            existing = [c["name"] for c in inspect(conn).get_columns(table)]
            if col not in existing:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {col} {definition}'))
                conn.commit()
                print(f"Added missing column: {table}.{col}")

except Exception as exc:
    print(f"Startup check failed (non-fatal): {exc}")
PYEOF

alembic upgrade head
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
