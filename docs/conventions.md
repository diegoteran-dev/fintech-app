# Conventions — Vault

> Extreme homogeneity. AI predicts better when the repo resembles itself everywhere.
> Read this before writing any code in this project.

## Python (FastAPI backend)

- Version: Python 3.13
- Formatter: `black` (max 100 chars). Run before committing.
- Type hints: required on all function signatures
- Imports: stdlib → third-party → local. One module per line.
- Strings: double quotes always
- No `print()` for errors — use `logging`. No stack traces to the user.
- Activate venv first: `source apps/backend/.venv/bin/activate`

| Type | Convention | Example |
|---|---|---|
| Modules | snake_case | transaction_service.py |
| Classes | PascalCase | TransactionService |
| Functions / variables | snake_case | get_transactions |
| Constants | UPPER_SNAKE | DEFAULT_PAGE_SIZE |
| Private | prefix `_` | _validate_amount |

**Route pattern:**
```python
@router.get("", response_model=list[TransactionOut])
def list_transactions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return transaction_service.list_for_user(db, current_user.id)
```

## TypeScript (React web + Expo mobile)

- Strict mode: always (`"strict": true` in tsconfig)
- All components: `export default function ComponentName(props: Props)`
- Prop interfaces defined in same file unless shared (shared → `types/index.ts`)
- No `any` — use `unknown` and narrow it
- Use `import type` for type-only imports
- No `console.log` in committed code

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | TransactionCard.tsx |
| Hooks | camelCase with `use` prefix | useTransactions.ts |
| Services | camelCase | api.ts |
| Interfaces / types | PascalCase | Transaction, ApiResponse |
| Constants | UPPER_SNAKE | MAX_RETRIES |

## CSS (web only)

All design tokens as CSS custom properties in `apps/web/src/index.css`:
```
--bg: #080C14      --surface: #0D1424    --card: #111C30
--border: #1A2840  --accent: #7C3AED     --text: #E2E8F4
--text-2: #7A8EB0  --green: #10B981      --red: #EF4444
```

- Never add inline hex values — always reference a CSS variable or `CATEGORY_COLORS` from constants.ts
- New CSS classes go at bottom of index.css with a `/* ── SECTION NAME ── */` comment
- No `!important`

## Bank parsers (`apps/backend/app/services/parsers/`)

Each parser extends `BankParser` (base.py) and implements:
- `can_parse(text: str) -> bool` — detect if this parser handles the PDF
- `parse(text: str) -> list[dict]` — extract transactions

Add to `PARSER_REGISTRY` in `__init__.py`. Route auto-detects.

## Alembic migrations

```bash
cd apps/backend && source .venv/bin/activate
alembic revision --autogenerate -m "description_of_change"
alembic upgrade head
```

Always review the generated migration file before applying.

## Comments

Default: none. Only when explaining a non-obvious WHY — a hidden constraint,
a workaround for a known bug. If removing it wouldn't confuse a future reader,
don't write it.

## Commits

```
feat(backend): add transaction export endpoint
fix(web): fix spending chart tooltip on mobile viewport
feat(mobile): add investment summary card to dashboard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Scopes: `backend`, `web`, `mobile`, `shared`, `infra`, `db`
