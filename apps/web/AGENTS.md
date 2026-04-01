# AGENTS.md — Vault Web Frontend

> Read this before touching any frontend code. It is the authoritative guide for the Vault Engineer working in `apps/web`.

---

## Stack

- **React 18** + **TypeScript** (strict mode)
- **Vite 5** dev server — port 3000 (fallback 3001)
- **Recharts 2** for data visualization
- **Axios** for HTTP (proxied via Vite to backend at :8000)
- **Plain CSS** with custom properties — no Tailwind, no styled-components
- **react-router-dom v6** (installed, not yet used beyond App.tsx)

---

## How to Run

```bash
# From repo root:
pnpm --filter @vault/web dev
# → http://localhost:3000
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`. The backend must be running for API calls to work.

---

## File Map

```
apps/web/src/
├── App.tsx                   ← Root: tab state, transaction fetch, chart data prep
├── main.tsx                  ← React DOM mount
├── index.css                 ← ALL styles. CSS custom properties. No other style files.
├── constants.ts              ← Category colors, expense/income category lists, rule config
├── types/index.ts            ← TypeScript interfaces (Transaction, FinancialHealth, etc.)
├── services/api.ts           ← All HTTP calls. Only file that imports axios.
└── components/
    ├── TransactionList.tsx       ← Renders list, handles delete, opens AddModal
    ├── AddTransactionModal.tsx   ← Form for creating income/expense transactions
    ├── SpendingChart.tsx         ← Recharts donut chart + legend
    └── FinancialHealth.tsx       ← Grade card + 50/30/20 rule bars, month picker
```

---

## Design System

All design tokens live as CSS custom properties in `index.css`:

```css
--bg:       #080C14   /* page background */
--surface:  #0D1424   /* nav, card backgrounds */
--card:     #111C30   /* nested card, input backgrounds */
--border:   #1A2840   /* default borders */
--border-hi:#243550   /* hover/focus borders */
--accent:   #7C3AED   /* primary violet — buttons, active tabs */
--accent-h: #6D28D9   /* accent hover */
--text:     #E2E8F4   /* primary text */
--text-2:   #7A8EB0   /* secondary text, labels */
--text-3:   #3D506E   /* muted text, empty states */
--green:    #10B981   /* income, positive values */
--red:      #EF4444   /* delete hover, negative */
--yellow:   #F59E0B   /* warnings, "under" status */
```

**Never add inline color values** — always reference a CSS variable or a value from `CATEGORY_COLORS` in `constants.ts`.

### Category Colors (vivid, from constants.ts)
```
Housing: #FF6B6B    Groceries: #FFD93D    Transport: #4ECB71
Entertainment: #4D96FF   Shopping: #FF922B   Health: #F472B6
Utilities: #38BDF8  Dining: #C084FC   Savings: #34D399
Salary/Income: #10B981
```

When adding a new category, add its color to `CATEGORY_COLORS` in `constants.ts` and add it to `EXPENSE_CATEGORIES` or `INCOME_CATEGORIES`.

---

## Adding a New Component

1. Create `apps/web/src/components/YourComponent.tsx`
2. Use existing CSS class patterns from `index.css` — check for `.card`, `.btn-*`, `.field` etc. before writing new classes
3. New CSS classes go at the bottom of `index.css` with a `/* ── YOUR SECTION ── */` comment
4. Add to `App.tsx` or the relevant parent component
5. TypeScript interfaces go in `types/index.ts`

---

## Adding a New API Call

All HTTP calls live in `services/api.ts`. Never use axios directly in a component.

```typescript
// In services/api.ts:
export const getMyData = (): Promise<MyType[]> =>
  api.get('/my-endpoint').then(r => r.data);

// In a component:
import { getMyData } from '../services/api';
```

---

## State Management

No state library (no Redux, no Zustand). All state is local `useState`/`useCallback`/`useEffect`. For global state as the app grows, use React Context — discuss with CTO before introducing a library.

The main data flow:
1. `App.tsx` fetches transactions and passes them as props
2. Components call `onRefresh()` after mutations to trigger a re-fetch
3. Financial Health fetches its own data internally (different endpoint, different scope)

---

## Component Patterns

**Data fetching in a component:**
```tsx
const [data, setData] = useState<MyType | null>(null);
useEffect(() => {
  getMyData().then(setData);
}, []);
```

**Conditional rendering:**
```tsx
{data.length === 0 ? (
  <div className="tx-empty">No items yet.</div>
) : (
  data.map(item => <div key={item.id}>...</div>)
)}
```

**Modals:**
Use the `.modal-bg` + `.modal` pattern. The backdrop close is `onClick={e => e.target === e.currentTarget && onClose()}`.

---

## TypeScript Rules

- All components are `export default function ComponentName(props: Props)`
- Interfaces for props are defined in the same file unless shared across multiple files
- Shared interfaces live in `types/index.ts`
- No `any` except for Recharts tooltip callbacks (documented in `SpendingChart.tsx`)
- Use `import type` for type-only imports

---

## Current Components

### App.tsx
- Owns tab state (`'transactions' | 'health'`)
- Fetches all transactions and passes to Transactions tab
- Computes `categoryBreakdown` for `SpendingChart` from raw transactions

### TransactionList + AddTransactionModal
- `TransactionList` receives transactions as props, calls `onRefresh` after mutations
- `AddTransactionModal` is uncontrolled — handles its own local form state

### SpendingChart
- Receives pre-computed `categoryBreakdown` (not raw transactions) from `App.tsx`
- Custom `<CustomTooltip>` for Recharts popup

### FinancialHealth
- Fetches its own data via `getFinancialHealth(month)`
- Re-fetches on `month` state change

---

## What Not to Do

- Do not add `console.log` to committed code
- Do not add a UI library (MUI, Chakra, Ant Design) without CTO approval — keeping deps lean is intentional
- Do not modify `main.tsx` unless changing the React mount
- Do not import from `react-router-dom` until routing is needed — it's installed but unused
- Do not use `!important` in CSS

---

## Commit Convention

```
feat(web): add portfolio overview page
fix(web): fix spending chart tooltip overflow
style(web): tighten transaction list spacing

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
