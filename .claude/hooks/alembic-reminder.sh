#!/bin/bash
# Fires after any Edit/Write tool call.
# If the changed file is a SQLAlchemy model, reminds Claude to create a migration.

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null)

# Only care about model files
if [[ "$FILE" == */models/*.py ]] && [[ "$FILE" != */__init__.py ]]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Model file changed (%s). If you added or modified columns or tables on an existing table, create a migration before finishing: /new-migration <description>. New tables handled by create_all() on startup, but column changes on existing tables REQUIRE a migration."}}\n' \
    "$(basename "$FILE")"
fi

exit 0
