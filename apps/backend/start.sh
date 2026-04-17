#!/bin/bash
set -e

# Determine the correct Alembic strategy before running migrations:
#
#  1. Fresh DB (no tables at all) — stamp to head so Alembic thinks it's
#     current, then let create_all in main.py build the full schema.
#
#  2. Pre-existing schema without migration history (bootstrapped by
#     create_all) — stamp to head so Alembic doesn't replay migrations
#     that would fail with DuplicateColumn / DuplicateTable errors.
#
#  3. Schema with Alembic history — run upgrade head normally to apply
#     any new migrations since the last deploy.
#
python3 - << 'PYEOF'
import os, sys
from sqlalchemy import create_engine, inspect

db_url = os.environ.get("DATABASE_URL", "sqlite:///./vault.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        tables = inspect(conn).get_table_names()
        has_app   = "transactions" in tables
        has_stamp = "alembic_version" in tables

    if not has_app or (has_app and not has_stamp):
        reason = "fresh database" if not has_app else "existing schema without migration history"
        print(f"Detected {reason} — stamping Alembic to head")
        from alembic.config import Config
        from alembic import command
        command.stamp(Config("alembic.ini"), "head")
        print("Stamped OK")
except Exception as exc:
    print(f"Startup check failed (non-fatal): {exc}")
PYEOF

alembic upgrade head
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
