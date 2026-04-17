#!/bin/bash
set -e

# Detect databases bootstrapped by create_all (tables exist, no alembic_version).
# In that case stamp to head so Alembic doesn't replay migrations that would
# fail with DuplicateColumn / DuplicateTable errors.
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

    if has_app and not has_stamp:
        print("Schema exists but no migration history — stamping to head")
        from alembic.config import Config
        from alembic import command
        command.stamp(Config("alembic.ini"), "head")
        print("Stamped OK")
except Exception as exc:
    print(f"Startup check failed (non-fatal): {exc}")
PYEOF

alembic upgrade head
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
