# Architecture — Vault

> This file defines what "correct" looks like in this project.
> The reviewer agent evaluates all code against it.
> Add a new layer here BEFORE implementing it — never after.

## What Vault does

Personal finance platform targeting Latin America. Users track transactions,
monitor financial health (50/30/20 rule), manage budgets, track investments,
and import bank statements via PDF. Core thesis: protect savings from inflation,
invest in stocks and crypto from one app.

## Layers

### Backend (`apps/backend/`)

```
app/
├── api/routes/       ← Thin HTTP layer. FastAPI routers. Calls services, returns schemas.
│                       No business logic here. One file per domain.
├── models/           ← SQLAlchemy ORM models only. No business logic. No HTTP knowledge.
├── schemas/          ← Pydantic request/response contracts. No DB access.
├── services/         ← Business logic. Called by routes. No direct HTTP knowledge.
│   └── parsers/      ← Bank PDF parsers. Each extends BankParser base class.
└── database.py       ← Engine, SessionLocal, Base, get_db() dependency.
```

**Dependency direction:** routes → services → models. Never reverse.

### Frontend (`apps/web/`)

```
src/
├── services/api.ts   ← ALL HTTP calls live here. Only file that imports axios.
│                       Never call fetch/axios directly in a component.
├── components/       ← Pure UI. No direct API calls. Receives data as props.
├── types/index.ts    ← Shared TypeScript interfaces.
├── constants.ts      ← Category colors, lists, rule config. No logic.
├── index.css         ← ALL styles. CSS custom properties. No other style files.
└── App.tsx           ← Root: tab state, data fetching, prop drilling.
```

### Mobile (`apps/mobile/`)

```
app/
├── (tabs)/           ← Five tabs: index (Dashboard), transactions, health, budgets, investments
├── login.tsx
└── settings.tsx
services/api.ts       ← Points to https://vault-api.fly.dev/api
```

Mobile mirrors web — every feature ships on both platforms with matching UX.

## Data flow

```
User → React component
         ↓ props
       services/api.ts (axios, /api/* proxied to :8000)
         ↓ HTTP
       FastAPI route
         ↓ calls
       Service function
         ↓ queries
       SQLAlchemy ORM
         ↓
       Neon Postgres (prod) / SQLite vault.db (local)
```

## Database rules

- Schema changes on existing tables: Alembic migration always (`alembic revision --autogenerate`)
- New tables: `create_all()` is acceptable during development only
- No raw SQL — ORM queries only
- SQLite for local dev, Neon Postgres for production — write compatible queries

## Infrastructure

| Service | Provider | URL |
|---|---|---|
| API | Fly.io (`vault-api`) | https://vault-api.fly.dev |
| Web | Vercel | https://vault-by-diego.vercel.app |
| DB | Neon Postgres | via DATABASE_URL env var |

## What NOT to do

- No Tailwind — all styles in `apps/web/src/index.css` via CSS custom props
- No inline hex colors in components — always reference a CSS variable
- No direct fetch/axios in components — always go through services/api.ts
- No npm or yarn — pnpm only
- No business logic in routes — routes are thin, services hold the logic
- No schema changes without an Alembic migration on existing tables
- No hardcoded backend URLs in web code — use relative `/api` paths via Vite proxy
