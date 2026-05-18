#!/bin/bash
# Injects project state + Jarvis vault context into every new session.
# Fires on SessionStart so Claude starts with the same frame as the Jarvis agents.

PROJECT="${CLAUDE_PROJECT_DIR:-/Users/diegoteran/Projects/fintech-app}"
JARVIS="${JARVIS_HOME:-/Users/diegoteran/Jarvis}"

# ── Git state ──────────────────────────────────────────────────────────────────
BRANCH=$(git -C "$PROJECT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git -C "$PROJECT" log --oneline -1 2>/dev/null || echo "none")
DIRTY_COUNT=$(git -C "$PROJECT" status --short 2>/dev/null | wc -l | tr -d ' ')

# ── Alembic state ──────────────────────────────────────────────────────────────
ALEMBIC_STATUS="unknown"
if [ -f "$PROJECT/apps/backend/.venv/bin/python" ]; then
  ALEMBIC_STATUS=$(
    source "$PROJECT/apps/backend/.venv/bin/activate" 2>/dev/null &&
    cd "$PROJECT/apps/backend" &&
    alembic current 2>/dev/null | tail -1 | cut -c1-50 ||
    echo "unknown"
  )
fi

# ── Recent session log (last 2 entries) ───────────────────────────────────────
SESSION_LOG=""
SESSION_FILE="$JARVIS/04-sessions/log.md"
if [ -f "$SESSION_FILE" ]; then
  SESSION_LOG=$(grep -A3 "^## 20" "$SESSION_FILE" | head -20 | tr '\n' '|' | sed 's/  */ /g')
fi

# ── Vault project status (new path) ───────────────────────────────────────────
VAULT_STATUS=""
VAULT_FILE="$JARVIS/02-projects/vault.md"
if [ -f "$VAULT_FILE" ]; then
  VAULT_STATUS=$(grep -E "Last updated|Status|Blockers" "$VAULT_FILE" | head -3 | tr '\n' ' ' | cut -c1-120)
fi

# ── Jarvis vault context ───────────────────────────────────────────────────────
NORTH_STAR=""
if [ -f "$JARVIS/00-system/north-star.md" ]; then
  # Extract just the priorities block — short and high value
  NORTH_STAR=$(sed -n '/^## Current priorities/,/^## /p' "$JARVIS/00-system/north-star.md" | head -8 | tr '\n' ' ' | sed 's/  */ /g')
fi

HOW_WE_WORK=""
if [ -f "$JARVIS/00-system/how-we-work.md" ]; then
  # Extract the "before starting" rules — the most important operating rules
  HOW_WE_WORK=$(sed -n '/^## Before starting/,/^## /p' "$JARVIS/00-system/how-we-work.md" | head -12 | tr '\n' '|' | sed 's/  */ /g')
fi

OPERATOR=""
if [ -f "$JARVIS/03-knowledge/operator-profile.md" ]; then
  # Extract communication rules and technical level — what shapes every response
  OPERATOR=$(sed -n '/^## Communication/,/^## Technical/p' "$JARVIS/03-knowledge/operator-profile.md" | head -10 | tr '\n' '|' | sed 's/  */ /g')
fi

# ── Build output ───────────────────────────────────────────────────────────────
STATE="Branch: $BRANCH"
[ "$DIRTY_COUNT" -gt "0" ] && STATE="$STATE | Uncommitted: $DIRTY_COUNT files"
STATE="$STATE | Last commit: $LAST_COMMIT | Alembic: $ALEMBIC_STATUS | Infra: Fly.io + Vercel + Neon"
[ -n "$VAULT_STATUS" ] && STATE="$STATE | Obsidian: $VAULT_STATUS"

VAULT_CONTEXT=""
[ -n "$NORTH_STAR" ] && VAULT_CONTEXT="PRIORITIES: $NORTH_STAR"
[ -n "$HOW_WE_WORK" ] && VAULT_CONTEXT="$VAULT_CONTEXT | PRE-TASK RULES: $HOW_WE_WORK"
[ -n "$OPERATOR" ] && VAULT_CONTEXT="$VAULT_CONTEXT | OPERATOR: $OPERATOR"
[ -n "$SESSION_LOG" ] && VAULT_CONTEXT="$VAULT_CONTEXT | RECENT SESSIONS: $SESSION_LOG"

FULL_CONTEXT="$STATE"
[ -n "$VAULT_CONTEXT" ] && FULL_CONTEXT="$FULL_CONTEXT

--- JARVIS VAULT CONTEXT ---
$VAULT_CONTEXT"

# Escape for JSON string
ESCAPED=$(printf '%s' "$FULL_CONTEXT" | python3 -c "
import sys, json
print(json.dumps(sys.stdin.read())[1:-1])
")

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$ESCAPED"
