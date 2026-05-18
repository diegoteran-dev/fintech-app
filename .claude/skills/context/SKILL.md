---
name: context
description: Load full project context from Obsidian — current status, recent decisions, and backlog. Use at the start of any session where you need a complete picture of the project state.
when_to_use: Use when starting work on Vault, before planning a new feature, or when asked "what's the current state of the project".
allowed-tools: Bash(cat *)
---

## Vault App — Live Project Context from Jarvis Vault

**Project reference:**
!`cat "$JARVIS_HOME/02-projects/vault.md"`

---

**Architecture decisions and lessons learned:**
!`cat "$JARVIS_HOME/03-knowledge/lessons/vault-project.md"`

---

**Live feature backlog:**
!`cat "/Users/diegoteran/Projects/fintech-app/feature_list.json"`

## Instructions

Synthesize the above into a concise briefing:
1. What is the current live state? (infra, features)
2. What hard rules must never be violated? (No Tailwind, Alembic, pnpm, both platforms)
3. What are the top 3 open items from the feature list?
4. Any blockers?

Keep it tight — 10 lines max. This is a context-loader, not a report.
