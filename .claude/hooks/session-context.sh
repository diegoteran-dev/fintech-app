#!/bin/bash
# Injects project state into every new session as additionalContext.
# Fires on SessionStart so Claude immediately knows the current situation.

PROJECT="$CLAUDE_PROJECT_DIR"
if [ -z "$PROJECT" ]; then
  PROJECT="/Users/diegoteran/Projects/fintech-app"
fi

# Git state
BRANCH=$(git -C "$PROJECT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git -C "$PROJECT" log --oneline -1 2>/dev/null || echo "none")
DIRTY_COUNT=$(git -C "$PROJECT" status --short 2>/dev/null | wc -l | tr -d ' ')

# Alembic state (best-effort — skip silently if venv not activated)
ALEMBIC_STATUS="unknown"
if [ -f "$PROJECT/apps/backend/.venv/bin/python" ]; then
  ALEMBIC_STATUS=$(
    source "$PROJECT/apps/backend/.venv/bin/activate" 2>/dev/null &&
    cd "$PROJECT/apps/backend" &&
    alembic current 2>/dev/null | tail -1 | cut -c1-70 ||
    echo "unknown"
  )
fi

# Build context string
CONTEXT="Branch: $BRANCH"
if [ "$DIRTY_COUNT" -gt "0" ]; then
  CONTEXT="$CONTEXT | Uncommitted files: $DIRTY_COUNT"
fi
CONTEXT="$CONTEXT | Last commit: $LAST_COMMIT"
CONTEXT="$CONTEXT | Alembic: $ALEMBIC_STATUS"
CONTEXT="$CONTEXT | Stack: Fly.io API + Vercel web + Neon DB"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' \
  "$(echo "$CONTEXT" | sed 's/"/\\"/g')"
