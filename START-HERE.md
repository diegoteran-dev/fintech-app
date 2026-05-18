# START HERE — Arca AI Development System

> Read this when starting a new work session.
> This is your complete guide to using the system independently.

---

## How to start working

### Option 1 — Browser chat (easiest)

```bash
cd ~/Projects/fintech-app
opencode web
```

Opens a chat interface in your browser at http://localhost:4096.
Type what you want to build or fix. The agent reads your codebase and takes action.

### Option 2 — VS Code integrated

Install the OpenCode extension in VS Code.
Open ~/Projects/fintech-app in VS Code.
OpenCode appears in the sidebar — same interface, inside your editor.

### Option 3 — Terminal (power users)

```bash
cd ~/Projects/fintech-app
opencode
```

---

## The six commands you use daily

These aliases are already set up in your terminal. Each one sends the task to the right model automatically.

| Command | What it does | Model used |
|---|---|---|
| `oc-plan "task description"` | Breaks down the task, writes the implementation brief | Claude Sonnet 4.6 |
| `oc-backend "task description"` | Implements backend (Python/FastAPI) features | Kimi K2.6 |
| `oc-frontend "task description"` | Implements web (React/TS) + mobile (Expo) features | GLM-5.1 |
| `oc-review "review feature X"` | Reviews the code, writes a verdict | Gemini 2.5 Flash |
| `oc-fix "quick fix"` | Fast small edits, renames, typos | Gemini Flash-Lite |
| `oc-security "task description"` | Architecture decisions, security-sensitive code | Claude Opus 4.7 |

**Typical workflow for a new feature:**

```bash
# 1. Plan it
oc-plan "Add a monthly budget summary card to the dashboard showing spent vs budget per category"

# 2. Implement it (orchestrator tells you which command to use)
oc-frontend "Implement the monthly budget summary card per the brief in progress/current.md"

# 3. Review it
oc-review "Review feature 3 — monthly budget summary card"

# 4. Verify
./init.sh
```

---

## Before starting any session

Always run this first from ~/Projects/fintech-app:

```bash
./init.sh
```

- Green = environment ready, pick a feature and start
- Red = something is broken, fix it before doing anything else

Then check what needs to be done:

```bash
cat feature_list.json
```

Pick the lowest-ID `pending` feature and work on that.

---

## Current task queue

Open `feature_list.json` to see the live list. As of setup:

- **Feature 1** ✅ — Harness bootstrap (done)
- **Feature 2** 🔴 — Fix TypeScript errors (web: Recharts + React 19, mobile: 2 type mismatches)

Add new features to `feature_list.json` as you think of them.

---

## When Claude (the setup assistant) is unavailable

The system works without Claude Code. All six commands above use independent models:
- `oc-backend` and `oc-frontend` use Kimi K2.6 and GLM-5.1 (OpenRouter — no Claude needed)
- `oc-review` uses Gemini Flash (Google — no Claude needed)
- `oc-fix` uses Gemini Flash-Lite (Google — no Claude needed)
- Only `oc-plan` and `oc-security` use Claude models

If your Claude subscription is paused, use `oc-backend` and `oc-frontend` directly with a clear enough description. The models are good enough to work without a separate planning step for routine features.

---

## Key files to know

```
~/Projects/fintech-app/
├── START-HERE.md        ← this file
├── AGENTS.md            ← navigation map (agents read this)
├── CLAUDE.md            ← stack rules (agents read this)
├── feature_list.json    ← what needs to be built
├── init.sh              ← run before and after every session
├── progress/
│   ├── current.md       ← what's happening right now
│   └── history.md       ← permanent log of completed work
└── docs/
    ├── architecture.md  ← how the project is structured
    ├── conventions.md   ← coding standards
    └── verification.md  ← how to prove something works
```

```
~/System Auth/           ← your knowledge base (open in Obsidian)
├── 00-system/           ← system-wide rules (loaded by every agent)
├── 01-agents/           ← agent identity files
├── 02-projects/         ← project references
└── 03-knowledge/        ← decisions, patterns, lessons learned
```

---

## API costs (pay-as-you-go, no subscriptions to cancel)

| Provider | What for | Where to manage |
|---|---|---|
| OpenRouter | Kimi, GLM, Gemini models | openrouter.ai → Credits |
| Anthropic | Claude Sonnet + Opus | console.anthropic.com → Usage |

Both are pay-as-you-go credits. Estimated ~$6-20/mo total for active Arca development.

**Important:** Rotate your API keys — the ones shared during setup should be replaced.
- OpenRouter: openrouter.ai → Keys → Create new → delete old
- Anthropic: console.anthropic.com → API Keys → Create new → delete old
- Update ~/.zshrc with new keys after rotating

---

## If something breaks

1. Run `./init.sh` — it tells you exactly what's wrong
2. Check `progress/current.md` — is there an interrupted session?
3. Check `~/System Auth/03-knowledge/lessons/` — has this broken before?
4. If truly stuck: open Claude Code (claude.ai/code) and describe the issue

---

## Adding a new feature

1. Open `feature_list.json`
2. Add a new entry with the next ID, a clear description, and `"status": "pending"`
3. Start a session: `./init.sh` → `oc-plan "feature description"`
4. Follow the workflow above

---

*System built: 2026-05-10 | Stack: Kimi K2.6 + GLM-5.1 + Gemini Flash + Claude Sonnet 4.6*
