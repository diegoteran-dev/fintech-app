---
name: update-status
description: Update the Vault App project status in Obsidian. Use after shipping a feature, fixing a critical bug, or completing a milestone.
when_to_use: Use after a deploy, a completed feature, or a significant project state change.
disable-model-invocation: true
allowed-tools: Bash(cat *) Bash(date *)
argument-hint: "[what was shipped or changed]"
---

Update the Vault App status in Obsidian: `$ARGUMENTS`

## Steps

1. Read the current status:
```bash
cat "/Users/diegoteran/Documents/Obsidian/Jarvis/Vault App/status.md"
```

2. Update the file:
   - Set "Last updated" to today (`date +%Y-%m-%d`)
   - Add `$ARGUMENTS` to the "Recently Shipped" section with today's date
   - If `$ARGUMENTS` is a completed backlog item, move it from backlog.md to this file's shipped list

3. Write the updated file back.

4. Confirm: "Status updated in Obsidian."

## Format for Recently Shipped entries
`- YYYY-MM-DD: [what was shipped]`

Keep it one line. Link to commit hash if available.
