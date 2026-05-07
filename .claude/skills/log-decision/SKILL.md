---
name: log-decision
description: Log an architecture or product decision to the Vault App Obsidian knowledge base. Use when a significant technical or product decision is made that future sessions should know about.
when_to_use: Use after making any decision about infrastructure, architecture, libraries, deployment strategy, or product direction for Vault.
disable-model-invocation: true
allowed-tools: Bash(cat *) Bash(echo *) Bash(date *)
argument-hint: "[decision description]"
---

Log this decision to the Vault App Obsidian knowledge base: `$ARGUMENTS`

## Steps

1. Get today's date:
```bash
date +%Y-%m-%d
```

2. Append a dated entry to `decisions.md`:
```bash
# Format: "- **YYYY-MM-DD** — $ARGUMENTS"
# Determine which section it belongs to (Infrastructure / Architecture / Bank Parsers / Deployment / Mobile)
# Append under the correct heading in /Users/diegoteran/Documents/Obsidian/Jarvis/Vault App/decisions.md
```

Use the Bash tool to append the formatted line to the correct section of the decisions file.

3. Also update `status.md` "Last updated" date to today.

4. Confirm: "Logged to Obsidian: [the decision]"

## Format
`- **YYYY-MM-DD** — [decision text]`

Keep it one line, factual, specific. Include WHY if it's non-obvious.
