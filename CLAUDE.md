# Vault — Project Brain

Personal finance platform targeting Latin America. Core thesis: protect savings from inflation, invest in stocks and crypto from one app. Built by Diego Teran (CS student → Texas State Fall 2025), run remotely as a business.

---

## Stack (May 2026)

| Layer | Tech | Location |
|-------|------|----------|
| Monorepo | Turborepo + pnpm workspaces | `~/Projects/fintech-app` |
| Web | React 18 + TypeScript (strict) + Vite 5, port 3000 | `apps/web` |
| Backend | Python 3.13 + FastAPI 0.115 + Uvicorn, port 8000 | `apps/backend` |
| Mobile | Expo SDK 54 + React Native 0.81.5, run via Xcode | `apps/mobile` |
| ORM | SQLAlchemy 2 + Alembic (active migrations) | `apps/backend/alembic/` |
| DB | Neon Postgres (prod) / SQLite vault.db (local dev) | — |

## Infrastructure

| Service | Provider | URL |
|---------|----------|-----|
| API | **Fly.io** (`vault-api`) | `https://vault-api.fly.dev` |
| Web | **Vercel** | `https://vault-by-diego.vercel.app` |
| DB | **Neon** | via `DATABASE_URL` secret on Fly |

**Render is gone.** Never reference it.

---

## Hard Rules

- **No Tailwind** — all styles in `apps/web/src/index.css` via CSS custom props (`--bg: #080C14`, `--accent: #7C3AED`)
- **pnpm only** — never npm or yarn
- **Both web AND mobile simultaneously** — every feature, fix, and UI change goes on both platforms in the same session, matching look and behavior
- **Alembic for schema changes** — column/table modifications on existing tables always need a migration; `create_all()` only handles new tables
- **Activate venv** — `source apps/backend/.venv/bin/activate` before any Python commands
- **Vite proxy** — web frontend uses relative `/api` paths proxied to `localhost:8000`; never hardcode the backend URL in web code
- **Co-author AI commits** — `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Dev Commands

```bash
# Backend
cd apps/backend && source .venv/bin/activate && python main.py

# Web
pnpm --filter @vault/web dev

# Mobile (iOS Simulator)
cd apps/mobile && npx expo run:ios

# New Alembic migration
cd apps/backend && source .venv/bin/activate
alembic revision --autogenerate -m "description"
alembic upgrade head
```

---

## Backend Routes (`/api/*`)

`health` · `auth` (register/login/refresh/me/profile PATCH) · `transactions` (CRUD, parse-pdf, detect-recurring, recategorize) · `budgets` · `accounts` · `holdings` · `net_worth` · `financial_health` · `dashboard` · `inflation` · `rules` · `admin` · `utils`

Full docs: `http://localhost:8000/docs`

## Web Components (`apps/web/src/components/`)

LoginPage · Dashboard · TransactionList · AddTransactionModal · SpendingChart · SpendingOverTime · FinancialHealth · BudgetManager · AccountsManager · HoldingsManager · ImportCSVModal · ImportPDFModal · InflationTracker · InvestmentGuide · PortfolioPlanner · RecurringDetector · RecategorizeModal · RulesManager · InviteManager · UserMenu · UserProfileSettings

Context: `AuthContext` · `LangContext` (en/es, `i18n.ts`) | Hook: `useUserProfile`

## Mobile Screens — FULLY BUILT

`(tabs)/`: `index` (Dashboard) · `transactions` · `health` · `budgets` · `investments`
Extra: `login.tsx` · `settings.tsx`
`services/api.ts` → `API_BASE = 'https://vault-api.fly.dev/api'`

## Bank PDF Parsers (`apps/backend/app/services/parsers/`)

MakroBanx · BCP · Banco Económico · BNB · Banco Ganadero

Each extends `BankParser` (base.py): `can_parse(text) → bool` + `parse(text) → list[dict]`.
Add new: create `<bank>.py`, add to `PARSER_REGISTRY` in `__init__.py`. That's it — route auto-detects.
Use `/add-bank-parser <BankName>` to scaffold.

---

## Skills

| Skill | Trigger | What it does |
|-------|---------|-------------|
| `/deploy-api` | Manual only | Deploy backend to Fly.io, verify health |
| `/deploy-web` | Manual only | Deploy web to Vercel production |
| `/new-migration` | Manual only | Create → review → apply Alembic migration |
| `/add-bank-parser` | Auto or manual | Scaffold a new bank PDF parser |
| `/ship` | Manual only | TS check → commit → push → deploy both |
| `/health-check` | Auto or manual | Live status of Fly.io API + Vercel web |
| `/context` | Auto or manual | Load full project context from Obsidian |
| `/log-decision` | Manual only | Log an architecture/product decision to Obsidian |
| `/update-status` | Manual only | Update shipped items in Obsidian status |
| `/n8n-notify` | Manual only | Trigger n8n webhook for event tracking |

## Obsidian Knowledge Base (Jarvis Vault)

`~/Documents/Obsidian/Jarvis/Vault App/`:
- `status.md` — live infra status + recently shipped
- `decisions.md` — dated log of architecture/product decisions
- `backlog.md` — feature backlog with priority tiers

MCP server: `mcp-obsidian` reads the Jarvis vault (configured in `~/.claude/.mcp.json`).
Use `/context` to load a full briefing from these files at any point.

## n8n Workflow Automation

- Local: `n8n start` → UI at `http://localhost:5678`
- Production config: `infrastructure/n8n/` (deploy to Fly.io as `vault-n8n`)
- Webhook endpoint: `http://localhost:5678/webhook/vault-events`
- Trigger via `/n8n-notify [event description]`

---

## Karpathy Principles

1. **Think first** — surface assumptions before coding; ask when interpretation is ambiguous
2. **Simplicity** — minimum code that solves the problem; no speculative features
3. **Surgical** — touch only what you must; match existing style; no unrelated cleanup
4. **Goal-driven** — define a verifiable "done" criterion before starting; loop until met
