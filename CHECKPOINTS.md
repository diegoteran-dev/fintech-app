# CHECKPOINTS.md — Vault

> Objective checklist. A human or AI judge evaluates project health
> against these at any time — no conversation history needed.

## C1 — Harness is complete

- [ ] AGENTS.md, CLAUDE.md, CHECKPOINTS.md, init.sh exist at project root
- [ ] feature_list.json exists and is valid JSON
- [ ] docs/architecture.md, docs/conventions.md, docs/verification.md exist
- [ ] progress/current.md and progress/history.md exist
- [ ] .claude/agents/ and .opencode/agent/ exist with all role definitions
- [ ] `./init.sh` exits with code 0

## C2 — State is coherent

- [ ] Maximum one feature is `in_progress` in feature_list.json
- [ ] All features marked `done` have passing tests
- [ ] progress/current.md is empty or describes an active session (no stale data)
- [ ] No feature stuck in `in_progress` from a previous session without explanation

## C3 — Code respects architecture

- [ ] Backend: no raw SQL — ORM queries only (SQLAlchemy)
- [ ] Backend: schema changes use Alembic migrations, not create_all()
- [ ] Frontend: no inline color values — CSS custom properties only
- [ ] Frontend: all HTTP calls in services/api.ts — never fetch directly in components
- [ ] Mobile: changes match web implementation in look and behavior
- [ ] No hardcoded secrets or credentials in any source file
- [ ] No debug print() or console.log() in committed code

## C4 — Verification is real

- [ ] Backend: at least one pytest test per new endpoint or service function
- [ ] Frontend: TypeScript check passes (no type errors)
- [ ] Mobile: TypeScript check passes
- [ ] All tests pass via `./init.sh`
- [ ] No test skipped or marked xfail without documented reason

## C5 — Session was closed properly

- [ ] progress/history.md has a dated entry for the last completed session
- [ ] progress/current.md is cleared (not holding stale data)
- [ ] Last completed feature is `done` in feature_list.json
- [ ] git status is clean or only has expected untracked files
