---
name: log-decision
description: Log an architecture or product decision to the Jarvis vault knowledge base. Use when a significant technical or product decision is made that future sessions should know about.
when_to_use: Use after making any decision about infrastructure, architecture, libraries, deployment strategy, or product direction for Vault.
disable-model-invocation: true
allowed-tools: Bash(cat *) Bash(echo *) Bash(date *)
argument-hint: "[decision description]"
---

Log this decision to the Jarvis vault: `$ARGUMENTS`

## Steps

1. Get today's date:
```bash
date +%Y-%m-%d
```

2. Create a new decision file following the established format:
```bash
# File: $JARVIS_HOME/03-knowledge/decisions/YYYY-MM-DD-<slug>.md
# Use the date from step 1 and a short slug from the decision topic
```

3. Write the file with this structure:
```markdown
# [Decision title]

> [[HOME]] · [[02-projects/vault|Vault]] · [[decision-process]]
> Date: YYYY-MM-DD

## What we decided
$ARGUMENTS

## Why
[reason — actual motivation, not "it seemed good"]

## What we considered and rejected
[alternatives and why they lost]

## What would change this decision
[conditions under which this should be revisited]
```

4. Confirm: "Logged to ~/Jarvis/03-knowledge/decisions/YYYY-MM-DD-<slug>.md"

## Format rule
One decision per file. Name it `YYYY-MM-DD-what-we-decided.md`. Be specific.
