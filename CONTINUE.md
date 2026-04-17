# CONTINUE.md — Vault App Session Handoff
Generated: 2026-04-15

---

## CURRENT GIT STATE

```
Branch: main
Latest commit: 77be9ce feat(categorization): per-user rule memory with fingerprint matching
Alembic: d4e5f6a7b8c9 (head) — fully up to date locally
```

**Last 10 commits:**
```
77be9ce feat(categorization): per-user rule memory with fingerprint matching
914cb57 feat(import): extensible bank parser registry — MakroBanx + Banco Económico support
5df2c5e fix: self-healing fallback to add currency column to budgets on startup
e152a41 feat: per-budget currency selection (USD/BOB/ARS/MXN)
16110a6 fix: auto-create missing category row when adding a budget
5844651 fix: allow $0 budget limit for categories with no expected spend
4a67d2c feat: month navigator in Budget Manager — browse spending vs limits by month
6dacef4 fix: rule bar fill and marker now map 1:1 to actual/target percentages
aad0d3c fix: rule percentages capped to 100%
dae9c96 feat: toggle to include/exclude savings from expenses in Financial Health
```

---

## ROADMAP ITEM #2 — BUDGET CURRENCY FIX: ALREADY DONE

**Status: CLOSED — no further work needed.**

Full audit confirms:
- `currency VARCHAR(3)` column exists on `budgets` table in DB ✓
- Migration `c3d4e5f6a7b8` is in the chain and runs via `alembic upgrade head` in `main.py` on startup ✓
- Self-healing fallback in `main.py` (lines 64–78) catches any edge case ✓
- `_month_spending()` in `budgets.py` correctly converts transactions to budget currency via `amount_usd` ✓
- Frontend `BudgetManager.tsx` shows currency selector and correct symbols ✓
- `render.yaml` startCommand triggers `main.py` which runs Alembic on boot ✓

**Remove from roadmap — this is done.**

---

## NEXT TASK: ACCOUNTS UI + HOLDINGS MANAGER

**This is the open task from the previous session. Backend is fully built. Frontend has ZERO UI for it.**

### What exists on the backend (working, tested):

**`/api/accounts`** — `apps/backend/app/api/routes/accounts.py`
- `GET /api/accounts` — list user's accounts
- `POST /api/accounts` — create account
- `PATCH /api/accounts/{id}` — update balance
- `DELETE /api/accounts/{id}` — delete

Account model fields: `id, user_id, name, institution, account_type (checking/savings/investment/crypto), currency, current_balance, created_at`

**`/api/holdings`** — `apps/backend/app/api/routes/holdings.py`
- `GET /api/holdings` — list holdings with live prices (async, concurrent price fetches)
- `POST /api/holdings` — add holding (validates ticker, fetches live price)
- `PATCH /api/holdings/{id}` — update quantity
- `DELETE /api/holdings/{id}` — delete
- `GET /api/holdings/search?q=AAPL&type=stock` — ticker search

Holding model fields: `id, user_id, asset_type (stock/etf/metal/crypto), ticker, name, quantity`
HoldingOut response includes: `price, value` (enriched live at query time via `price_fetcher`)

### What is MISSING on the frontend:

1. **No Accounts component** — only `Dashboard.tsx` references accounts for the balance panel
2. **No Holdings component** — completely absent from the frontend
3. **No Holding TypeScript type** in `apps/web/src/types/index.ts`
4. **No holding API calls** in `apps/web/src/services/api.ts`
5. **No new tab in `App.tsx`** for an investments/assets view

---

## EXACT FILES TO CREATE / MODIFY

### NEW files:
```
apps/web/src/components/AccountsManager.tsx   — Account list, add form, balance editing
apps/web/src/components/HoldingsManager.tsx   — Holdings list, ticker search, add/edit quantity
```

### MODIFY:
```
apps/web/src/types/index.ts
  → Add: interface Holding { id, asset_type, ticker, name, quantity, price?, value? }
  → Add: interface HoldingCreate { asset_type, ticker, name?, quantity }

apps/web/src/services/api.ts
  → Add: getHoldings()
  → Add: createHolding(data: HoldingCreate)
  → Add: updateHolding(id, quantity)
  → Add: deleteHolding(id)
  → Add: searchTicker(q: string, type: string)

apps/web/src/App.tsx
  → Add new tab: "Investments" or "Assets" (after Budgets tab)
  → Render HoldingsManager + AccountsManager in new tab

apps/web/src/constants.ts
  → Add: ASSET_TYPES = ['stock', 'etf', 'crypto', 'metal']
```

---

## STEP-BY-STEP EXECUTION PLAN

> Execute in this exact order. Do NOT start backend — it's done.

**Step 1 — Add TypeScript types**
- Open `apps/web/src/types/index.ts`
- Add `Holding`, `HoldingCreate`, `HoldingUpdate` interfaces

**Step 2 — Add API calls**
- Open `apps/web/src/services/api.ts`
- Add `getHoldings`, `createHolding`, `updateHolding`, `deleteHolding`, `searchTicker`
- Note: accounts API calls (`getAccounts`, `createAccount`, `updateAccount`, `deleteAccount`) may already exist — verify before adding

**Step 3 — Build HoldingsManager.tsx**
Layout: sidebar (add form with ticker search + asset type dropdown + quantity) + main list (table or cards showing ticker, name, shares, price, total value, delete button)
- Ticker search: call `searchTicker(q, type)` as user types (debounce ~300ms)
- On select: auto-fill ticker + name in form
- On add: `createHolding()` → refresh list
- Show total portfolio value at top
- Match Vault design tokens (dark theme, violet accent)

**Step 4 — Build AccountsManager.tsx**
Layout: list of account cards (name, institution, type, currency, balance) + add form
- Inline balance editing: click balance → input → save via `PATCH /api/accounts/{id}`
- Delete with confirmation
- Accounts already shown partially in Dashboard — this is the full management view

**Step 5 — Wire into App.tsx**
- Add "Investments" tab to nav
- Render `<HoldingsManager />` and `<AccountsManager />` inside it

**Step 6 — Update Net Worth flow (optional, discuss first)**
- Currently Net Worth entries are manual snapshots
- Consider: auto-calculate Net Worth from accounts (sum of balances) + holdings (sum of values)
- Decision needed: keep manual OR auto-calculate? Discuss with Diego before implementing

**Step 7 — Test + commit**
```bash
cd apps/backend && source .venv/bin/activate && python main.py
# New tab in browser → Investments tab
# Add a holding (e.g. AAPL, 10 shares) → verify price fetches
# Add an account → verify balance editing
git add apps/web/src/
git commit -m "feat: investments tab — holdings manager + accounts manager"
```

---

## DESIGN REFERENCE (match existing patterns)

- No Tailwind — CSS custom properties only (`var(--bg)`, `var(--accent)`, `var(--text)` etc.)
- Use `card` class for containers, `btn-primary` for primary buttons, `form-input`/`form-select` for inputs
- Match `BudgetManager.tsx` for the sidebar+main layout pattern
- Loading state: `<div style={{ color: 'var(--text-3)' }}>Loading...</div>`
- Empty state: card with emoji + description + hint (see BudgetManager empty state)
- Delete: `×` button, `budget-delete` class or equivalent

---

## SUPPORTED BANK PARSERS (as of 2026-04-15)

Parsers live in `apps/backend/app/services/parsers/`. Registry order matters.

| # | Parser | File | Detection | Architecture |
|---|--------|------|-----------|-------------|
| 1 | MakroBanxParser | `makrobanx.py` | "MAKROBANX" | Data line + preceding description lines; DEBITOS/CREDITOS unsigned columns |
| 2 | BancoEconomicoParser | `banco_economico.py` | "baneco.com.bo" or "Banco Económico" | One tx per line; signed MONTO; "Nota:" sub-lines |
| 3 | BNBParser | `bnb.py` | "bnb.com.bo", "Banco Nacional de Bolivia", "BNB NET" | **Two-section structure** (Depósitos/Retiros); multi-line blocks; comprobante extraction |
| 4 | BancoGanaderoParser | `banco_ganadero.py` | "Banco Ganadero" | Line-per-tx; POS/ACH/transfer description cleaning |

**BNB architectural notes:**
- Section header "Depósitos" → all amounts = income; "Retiros" → all amounts = expense
- Each transaction is a multi-line block: date line → description lines → last line (ref + comprobante + amount)
- Comprobante pattern: `\d+[A-Z]\d+` (e.g. "2P26195078", "3Q87654321") — extracted and stored in `transactions.comprobante`
- Comprobante-based dedup: checked FIRST in `create_transaction`, before date+amount+desc dedup
- Page 1 is a summary (no transactions). Last page may be blank ("Esta página se dejó en blanco").

---

## NOTES FOR NEXT SESSION

- Backend is at Render (prod) + SQLite locally — run `source .venv/bin/activate` before any Python commands
- Frontend: `pnpm --filter @vault/web dev` → http://localhost:3000
- `price_fetcher.py` uses Yahoo Finance / Alpha Vantage — check if API keys are needed or if it works without
- Verify: `GET /api/holdings/search?q=AAPL&type=stock` returns results before building the search UI
