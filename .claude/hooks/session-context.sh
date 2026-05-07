#!/bin/bash
# Injects project state into every new session as additionalContext.
# Fires on SessionStart so Claude immediately knows the current situation.

PROJECT="$CLAUDE_PROJECT_DIR"
if [ -z "$PROJECT" ]; then
  PROJECT="/Users/diegoteran/Projects/fintech-app"
fi

OBSIDIAN_STATUS="/Users/diegoteran/Documents/Obsidian/Jarvis/Vault App/status.md"

# Git state
BRANCH=$(git -C "$PROJECT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git -C "$PROJECT" log --oneline -1 2>/dev/null || echo "none")
DIRTY_COUNT=$(git -C "$PROJECT" status --short 2>/dev/null | wc -l | tr -d ' ')

# Alembic state (best-effort)
ALEMBIC_STATUS="unknown"
if [ -f "$PROJECT/apps/backend/.venv/bin/python" ]; then
  ALEMBIC_STATUS=$(
    source "$PROJECT/apps/backend/.venv/bin/activate" 2>/dev/null &&
    cd "$PROJECT/apps/backend" &&
    alembic current 2>/dev/null | tail -1 | cut -c1-50 ||
    echo "unknown"
  )
fi

# Obsidian status (last-updated + current sprint line)
OBSIDIAN_LINE=""
if [ -f "$OBSIDIAN_STATUS" ]; then
  OBSIDIAN_LINE=" | Obsidian: $(grep 'Last updated\|Current Sprint\|Blockers' "$OBSIDIAN_STATUS" | head -3 | tr '\n' ' ' | cut -c1-120)"
fi

# Build context string
CONTEXT="Branch: $BRANCH"
if [ "$DIRTY_COUNT" -gt "0" ]; then
  CONTEXT="$CONTEXT | Uncommitted: $DIRTY_COUNT files"
fi
CONTEXT="$CONTEXT | Last commit: $LAST_COMMIT"
CONTEXT="$CONTEXT | Alembic: $ALEMBIC_STATUS"
CONTEXT="$CONTEXT | Infra: Fly.io + Vercel + Neon"
CONTEXT="$CONTEXT$OBSIDIAN_LINE"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' \
  "$(echo "$CONTEXT" | sed 's/"/\\"/g')"
