---
name: new-migration
description: Create and apply a new Alembic database migration. Use when adding or modifying columns/tables in the backend models. Always shows the generated file for review before applying.
disable-model-invocation: true
allowed-tools: Bash(cd *) Bash(source *) Bash(alembic *) Bash(cat *) Bash(ls *)
argument-hint: "[description of schema change]"
---

Create and apply an Alembic migration: `$ARGUMENTS`

## Step 1 — Current state

```bash
cd /Users/diegoteran/Projects/fintech-app/apps/backend && source .venv/bin/activate && alembic current && echo "---heads---" && alembic heads
```

If there are multiple heads, stop and resolve the branch conflict first (`alembic merge heads`).

## Step 2 — Generate migration

```bash
alembic revision --autogenerate -m "$ARGUMENTS"
```

## Step 3 — Review (MANDATORY)

Find and print the generated file:
```bash
ls -t alembic/versions/ | head -1
```
Then read and display the full contents of that file. Point out:
- What `upgrade()` will do
- What `downgrade()` will do
- Whether `upgrade()` is empty (this means SQLAlchemy didn't detect a change — tell Diego and stop)

**Ask Diego to confirm before proceeding to Step 4.**

## Step 4 — Apply

After Diego confirms:
```bash
alembic upgrade head
```

## Step 5 — Verify

```bash
alembic current
```

## Critical rules

- **Never apply without showing Diego the generated file first**
- If `upgrade()` is empty or only has `pass`, explain why (model imports, metadata mismatch) and stop
- Production DB (Neon via Fly) gets the migration on the next `flyctl deploy` — `start.sh` runs `alembic upgrade head` on startup
- Local `vault.db` (SQLite) is updated immediately by Step 4
