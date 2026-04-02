# CLAUDE.md — Vault Project

> Feed this file at the start of every session. It contains the full context needed to work on Vault without re-explanation.

---

## Who Is Building This

**Diego Teran** — 23, CS student transferring from Keiser University (Bolivia) to Texas State University (San Marcos, TX) in Fall 2025. GPA 3.91. Building Vault as a remotely operated business to fund personal investments. Works with Claude Code as primary engineering assistant, and Paperclip agents for autonomous orchestration.

- GitHub: github.com/diegoteran-dev
- Email: diego.teran.a@gmail.com

---

## What Is Vault

A **global personal finance platform** targeting Latin America first, then worldwide. Core thesis: help people protect savings from inflation and access stock/crypto investing from a single app.

**Target user:** Someone in Bolivia, Argentina, or Mexico watching their currency lose value with no easy path to USD-denominated assets or global markets.

**Business model:** TBD. Goal is to generate enough revenue to fund Diego's personal investments while studying.

---

## Tech Stack

### Monorepo
- **Tool:** Turborepo + pnpm workspaces (`pnpm@9.0.0`)
- **Root:** `/Users/diegoteran/Projects/fintech-app`
- **Repo:** `github.com/diegoteran-dev/fintech-app`

### Frontend — `apps/web`
- React 18 + TypeScript (strict)
- Vite 5 dev server → `http://localhost:3000` (falls back to 3001 if busy)
- Recharts for data visualization
- Axios for API calls (proxied via Vite to `http://localhost:8000`)
- Plain CSS with custom properties (no Tailwind, no CSS-in-JS)
- Dark theme: `--bg: #080C14`, `--accent: #7C3AED` (violet)

### Backend — `apps/backend`
- **Python 3.13** + FastAPI 0.115 + Uvicorn (hot reload)
- SQLAlchemy 2.0 ORM + **SQLite** (`vault.db`) — will migrate to Postgres before launch
- **Alembic** — active, migrations in `alembic/versions/`. Run `alembic upgrade head` after pulling
- Pydantic 2.12 for validation
- Port: `8000`
- Swagger UI: `http://localhost:8000/docs`
- Virtual env: `apps/backend/.venv` (Python 3.13, activate before running)

### Mobile — `apps/mobile`
- Expo SDK 51 + React Native 0.74
- Expo Router (file-based navigation)
- Not actively developed yet — web is the priority

### Legacy TS API — `apps/api`
- Node.js + Express boilerplate (port 3001)
- **Not in active use** — Python backend is the real API
- Will be removed once auth/Plaid integrations are planned

### Shared — `packages/shared`
- TypeScript types and utilities shared across packages
- Currently empty stubs; will grow as mobile catches up to web

---

## Project Structure

```
vault/
├── apps/
│   ├── web/                    # React + TypeScript web app
│   │   └── src/
│   │       ├── App.tsx         # Root component, tab routing
│   │       ├── index.css       # All styles, CSS variables
│   │       ├── constants.ts    # Category colors, lists, rule icons
│   │       ├── types/index.ts  # Shared TypeScript interfaces
│   │       ├── services/api.ts # Axios API client (all HTTP calls live here)
│   │       ├── context/
│   │       │   └── AuthContext.tsx         # JWT auth state, axios interceptors, auto-refresh
│   │       ├── services/
│   │       │   ├── api.ts                  # All authenticated API calls
│   │       │   └── auth.ts                 # login/register/refresh (separate axios instance)
│   │       └── components/
│   │           ├── LoginPage.tsx           # Sign in / create account toggle
│   │           ├── Dashboard.tsx           # Income/expense bar, trend line, top categories, net worth
│   │           ├── TransactionList.tsx     # List + delete, triggers AddModal
│   │           ├── AddTransactionModal.tsx # Add form with currency selector
│   │           ├── SpendingChart.tsx       # Recharts donut chart by category
│   │           ├── FinancialHealth.tsx     # 50/30/20 rule analysis + grade
│   │           └── BudgetManager.tsx       # Budget list, progress bars, add form
│   │
│   ├── backend/                # Python FastAPI backend
│   │   ├── main.py             # App entry, CORS, route registration, create_all
│   │   ├── requirements.txt    # Pinned dependencies
│   │   ├── seed.py             # Seeds categories + dev user + sample data
│   │   ├── alembic.ini         # Alembic config
│   │   ├── alembic/versions/   # Migration history (run: alembic upgrade head)
│   │   ├── vault.db            # SQLite database (gitignored)
│   │   └── app/
│   │       ├── database.py     # SQLAlchemy engine + get_db dependency
│   │       ├── models/
│   │       │   ├── __init__.py     # Imports all models (required for create_all + Alembic)
│   │       │   ├── user.py         # User — email, hashed_password, auth_provider, OAuth fields
│   │       │   ├── transaction.py  # Transaction — amount, currency, amount_usd, category, type, merchant, user_id
│   │       │   ├── account.py      # Account — institution, type, currency, balance, Plaid fields
│   │       │   ├── budget.py       # Budget — user_id, category, amount, period
│   │       │   ├── net_worth.py    # NetWorth — user_id, amount_usd, date, notes
│   │       │   └── category.py     # Category — name, icon, color, is_system
│   │       ├── schemas/            # Pydantic in/out schemas per route
│   │       ├── services/
│   │       │   └── exchange_rate.py  # to_usd(amount, currency) — fetches open.er-api.com, 1hr cache
│   │       └── api/routes/
│   │           ├── health.py           # GET /api/health
│   │           ├── auth.py             # POST /api/auth/register, /login, /refresh; GET /me
│   │           ├── transactions.py     # GET/POST /api/transactions, DELETE /api/transactions/{id}
│   │           ├── financial_health.py # GET /api/financial-health?month=YYYY-MM
│   │           ├── budgets.py          # GET/POST/PUT/DELETE /api/budgets
│   │           └── net_worth.py        # GET/POST/DELETE /api/net-worth
│   │
│   ├── mobile/                 # Expo React Native (paused, web-first)
│   └── api/                    # Legacy TS/Express stub (ignore)
│
└── packages/
    └── shared/                 # Shared TS types/utils (mostly empty stubs)
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service liveness check |
| POST | `/api/auth/register` | Create account — `{email, password, full_name?}` |
| POST | `/api/auth/login` | Sign in — returns `access_token` + `refresh_token` |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/transactions` | All transactions for current user, newest first |
| POST | `/api/transactions` | Create transaction |
| DELETE | `/api/transactions/{id}` | Delete by ID |
| GET | `/api/financial-health?month=YYYY-MM` | 50/30/20 analysis + grade for a month |
| GET | `/api/budgets` | All budgets with current-month spending |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets/{id}` | Update budget amount/period |
| DELETE | `/api/budgets/{id}` | Delete budget |
| GET | `/api/net-worth` | All net worth entries for current user |
| POST | `/api/net-worth` | Add net worth snapshot |
| DELETE | `/api/net-worth/{id}` | Delete net worth entry |

**Transaction schema:**
```json
{ "description": "Rent", "amount": 500.00, "currency": "USD", "category": "Housing", "type": "expense", "date": "2026-04-01T00:00:00Z" }
```
Supported currencies: `USD`, `BOB`, `ARS`, `MXN` — `amount_usd` is auto-populated on create.

**Expense categories:** Housing, Groceries, Transport, Entertainment, Shopping, Health, Utilities, Dining, Savings, Other

**Income categories:** Salary, Freelance, Investment Returns, Other

**50/30/20 rule mapping:**
- Needs (50%): Housing, Groceries, Transport, Health, Utilities
- Wants (30%): Entertainment, Shopping, Dining
- Savings (20%): Savings

---

## Current Status — April 2026

### Done
- [x] Turborepo monorepo scaffolded (pnpm, TypeScript, ESLint, Prettier)
- [x] Python FastAPI backend with SQLite
- [x] Transaction CRUD endpoints
- [x] Financial health analysis endpoint (50/30/20, grade A–F, score 0–100)
- [x] React web app — dark theme, violet accent
- [x] Transaction list with add modal and delete
- [x] Spending donut chart by category (vivid per-category colors)
- [x] Financial Health tab with grade card + rule bars + status indicators
- [x] Expo mobile app shell (no features yet)
- [x] Full data model: User, Transaction, Account, Budget, Category, NetWorth
- [x] Alembic migrations active — `alembic upgrade head` applies all schema changes
- [x] Seed script — 13 default categories + dev user + sample transactions/budgets
- [x] CLAUDE.md, AGENTS.md files, Paperclip agent instructions for CEO/CTO/Command/Vault Engineer
- [x] **JWT authentication** — register/login/refresh/me endpoints, AuthContext, LoginPage, axios interceptor auto-refresh
- [x] **Multi-currency support** — USD/BOB/ARS/MXN per transaction, `exchange_rate.py` converts to USD (1hr cache, fallback rates)
- [x] **Budgets** — full CRUD, spending vs. limit tracking, over-budget alerts, progress bars in UI
- [x] **Dashboard tab** — income vs. expenses bar chart, spending trend line chart, top categories, net worth tracker with history chart
- [x] **Net worth tracking** — backend model + endpoints, frontend entry form and line chart
- [x] **CI/CD** — GitHub Actions pipeline with test scaffolding

### Next Up (in priority order)
1. **Stock market data** — integrate a free API (Yahoo Finance / Alpha Vantage) for portfolio view
2. **Crypto tracking** — CoinGecko API for crypto holdings
3. **Accounts UI** — link and manage accounts in the web frontend
4. **Inflation tools** — country-specific inflation data (INDEC for Argentina, INE for Bolivia)
5. **Mobile feature parity** — mirror web features in Expo app
6. **Postgres migration** — swap SQLite for Postgres before any production deployment

---

## Development Commands

### Start backend
```bash
cd apps/backend
source .venv/bin/activate
python main.py
# → http://localhost:8000  |  docs: http://localhost:8000/docs
```

### Start web frontend
```bash
pnpm --filter @vault/web dev
# → http://localhost:3000 (or 3001 if port busy)
```

### Install all dependencies
```bash
pnpm install                                    # Node (all workspaces)
cd apps/backend && pip install -r requirements.txt  # Python
```

### Git workflow
```bash
git add <files>
git commit -m "type: description\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Agent Roles (Paperclip)

| Agent | Role | Owns |
|-------|------|------|
| CEO | Strategic direction | Roadmap, priorities, hiring agents |
| CTO | Technical direction | Architecture, code review, sprint planning |
| Vault Engineer | Implementation | Features, bug fixes, frontend + backend code |
| Command | Coordination | Daily briefings, status checks, task routing |

Agents read `AGENTS.md` files for workspace-specific instructions:
- `apps/backend/AGENTS.md` — backend engineering context
- `apps/web/AGENTS.md` — frontend engineering context

---

## Key Conventions

- **No Tailwind** — all styles in `apps/web/src/index.css` using CSS custom properties
- **Alembic is active** — `create_all()` handles new tables on startup; all schema changes to existing tables require a migration (`alembic revision --autogenerate -m "description" && alembic upgrade head`)
- **SQLite for now** — `apps/backend/vault.db` is gitignored; will move to Postgres pre-launch
- **Proxy** — Vite proxies `/api/*` to `http://localhost:8000`, so frontend uses relative `/api` paths
- **Co-author all AI commits** — include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` in commit messages
- **pnpm only** — never use npm/yarn in this repo
- **Python venv** — always activate `.venv` before running Python commands in `apps/backend`
