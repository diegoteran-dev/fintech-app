---
name: context
description: Load full project context from Obsidian — current status, recent decisions, and backlog. Use at the start of any session where you need a complete picture of the project state.
when_to_use: Use when starting work on Vault, before planning a new feature, or when asked "what's the current state of the project".
allowed-tools: Bash(cat *)
---

## Vault App — Live Project Context from Obsidian

**Current Status:**
!`cat "/Users/diegoteran/Documents/Obsidian/Jarvis/Vault App/status.md"`

---

**Recent Decisions:**
!`cat "/Users/diegoteran/Documents/Obsidian/Jarvis/Vault App/decisions.md"`

---

**Backlog:**
!`cat "/Users/diegoteran/Documents/Obsidian/Jarvis/Vault App/backlog.md"`

## Instructions

Synthesize the above into a concise briefing:
1. What is the current live state? (infra, features)
2. What was recently shipped?
3. What are the top 3 open items from the backlog?
4. Any blockers?

Keep it tight — 10 lines max. This is a context-loader, not a report.
