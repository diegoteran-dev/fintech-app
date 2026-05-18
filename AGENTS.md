# AGENTS.md — Arca

> Navigation map for any agent working in this repository.
> Progressive disclosure — read what you need, when you need it.
> Start here. Pull details from docs/ and CLAUDE.md on demand.

## § 1 — Before starting (mandatory)

1. Run `./init.sh` — if it exits non-zero, stop. Do not continue.
2. Read `progress/current.md` — interrupted session? Continue it before new work.
3. Open `feature_list.json` — pick ONE pending feature (lowest ID). One only.
4. Read `docs/architecture.md` to understand the project shape before touching code.
5. Read `CLAUDE.md` for hard rules, stack details, and dev commands.

## § 2 — Repository map

| Path | What it is | When to read |
|---|---|---|
| `AGENTS.md` | This file — navigation map | Start of every session |
| `CLAUDE.md` | Stack details, hard rules, dev commands | Before any code work |
| `CHECKPOINTS.md` | Objective definition of "done" | Before closing a feature |
| `feature_list.json` | Task list (pending → in_progress → done) | Choosing work |
| `init.sh` | Validation + test runner | Start and end of every session |
| `docs/architecture.md` | Arca's layers and data flow | Before writing any code |
| `docs/conventions.md` | Naming, style, patterns | While writing code |
| `docs/verification.md` | How to prove something works | Before marking done |
| `progress/current.md` | Live session state | Throughout the session |
| `progress/history.md` | Permanent append-only log | After closing a feature |
| `apps/web/AGENTS.md` | Web frontend deep-dive | When working in apps/web |
| `apps/backend/AGENTS.md` | Backend deep-dive | When working in apps/backend |

## § 3 — Hard rules (from CLAUDE.md — do not override)

- **No Tailwind** — styles in `apps/web/src/index.css` via CSS custom props only
- **pnpm only** — never npm or yarn
- **Web AND mobile simultaneously** — every feature ships on both platforms
- **Alembic for schema changes** — never raw `create_all()` on existing tables
- **Activate venv** before any Python: `source apps/backend/.venv/bin/activate`
- **One feature at a time** — `feature_list.json` enforces it, `init.sh` validates it
- **Tests must pass** before marking anything done

## § 4 — How to claim a task

1. Open `feature_list.json`
2. Filter by `"status": "pending"` — take the lowest `id`
3. Change its `status` to `"in_progress"`
4. Write your plan (3-5 bullets) to `progress/current.md` before touching code
5. Implement → verify with `./init.sh` → call reviewer
6. On reviewer approval: set `status` to `"done"`, archive to `progress/history.md`

## § 5 — Session close protocol

1. `./init.sh` exits 0
2. Feature status set to `done` in `feature_list.json`
3. `progress/impl_<feature>.md` written and complete
4. `progress/review_<feature>.md` written with reviewer verdict
5. Summary moved from `progress/current.md` to `progress/history.md`
6. `progress/current.md` cleared back to empty template

## § 6 — If blocked

1. Re-read `docs/architecture.md`, `docs/conventions.md`, and `CLAUDE.md`
2. Check `~/System Auth/03-knowledge/lessons/` for prior incidents
3. If still blocked: annotate `progress/current.md` with the exact blocker,
   set feature to `"blocked"` in `feature_list.json`, end session
4. Do NOT improvise a workaround. Do NOT skip checks.
