---
name: update-status
description: Update the Vault App project status in the Jarvis vault. Use after shipping a feature, fixing a critical bug, or completing a milestone.
when_to_use: Use after a deploy, a completed feature, or a significant project state change.
disable-model-invocation: true
allowed-tools: Bash(cat *) Bash(date *)
argument-hint: "[what was shipped or changed]"
---

Update the Vault App status in the Jarvis vault: `$ARGUMENTS`

## Steps

1. Read the current project reference:
```bash
cat "$JARVIS_HOME/02-projects/vault.md"
```

2. Append to the lessons file under the correct date heading:
```bash
cat "$JARVIS_HOME/03-knowledge/lessons/vault-project.md"
```

3. Add `$ARGUMENTS` as a dated entry in the lessons file under **Hard-won patterns** or **Architecture decisions** depending on what was shipped. Format:
   `- **YYYY-MM-DD** — [what was shipped/changed]`

4. Confirm: "Status updated in ~/Jarvis/03-knowledge/lessons/vault-project.md"

## Format for entries
`- **YYYY-MM-DD**: [what was shipped]`

Keep it one line. Link to commit hash if available.
