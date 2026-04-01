# AGENTS.md — Vault Backend

> Read this before touching any backend code. It is the authoritative guide for the Vault Engineer working in `apps/backend`.

---

## Stack

- **Python 3.13** + **FastAPI 0.115** + **Uvicorn** (with `reload=True`)
- **SQLAlchemy 2.0** ORM (declarative, sync session)
- **SQLite** via `vault.db` — gitignored, auto-created on first run
- **Pydantic 2.12** for request/response validation
- **Alembic 1.15** — configured but migrations not yet written

---

## How to Run

```bash
cd apps/backend
source .venv/bin/activate   # Python 3.13 venv
python main.py              # starts on :8000 with hot reload
```

Swagger UI: `http://localhost:8000/docs`

---

## File Map

```
apps/backend/
├── main.py               ← Entry point. Register all routers here.
├── requirements.txt      ← Pinned deps. Add new packages here + re-pip-install.
├── .env.example          ← Copy to .env before running.
├── vault.db              ← SQLite file (gitignored, created at runtime).
└── app/
    ├── database.py       ← Engine, SessionLocal, Base, get_db() dependency.
    ├── models/
    │   ├── user.py           ← User model (not yet wired to auth).
    │   └── transaction.py    ← Transaction model (active).
    ├── schemas/
    │   └── transaction.py    ← Pydantic schemas for transactions + financial health.
    └── api/routes/
        ├── health.py             ← GET /api/health
        ├── transactions.py       ← CRUD for transactions
        └── financial_health.py   ← 50/30/20 analysis endpoint
```

---

## Adding a New Endpoint

1. **Create the model** in `app/models/your_feature.py` extending `Base`:
   ```python
   from app.database import Base
   from sqlalchemy import Column, Integer, String
   class MyModel(Base):
       __tablename__ = "my_table"
       id = Column(Integer, primary_key=True, index=True)
   ```

2. **Create schemas** in `app/schemas/your_feature.py`:
   ```python
   from pydantic import BaseModel, ConfigDict
   class MyModelCreate(BaseModel): ...
   class MyModelOut(MyModelCreate):
       id: int
       model_config = ConfigDict(from_attributes=True)
   ```

3. **Create the router** in `app/api/routes/your_feature.py`:
   ```python
   from fastapi import APIRouter, Depends
   from sqlalchemy.orm import Session
   from app.database import get_db
   router = APIRouter()
   @router.get("", response_model=list[MyModelOut])
   def list_items(db: Session = Depends(get_db)): ...
   ```

4. **Register in `main.py`**:
   ```python
   from app.api.routes import your_feature
   app.include_router(your_feature.router, prefix="/api/your-feature", tags=["your-feature"])
   ```

5. The table is created automatically via `Base.metadata.create_all(bind=engine)` in `main.py`.

---

## Database Rules

- **Never edit `vault.db` directly** — all DB changes go through SQLAlchemy.
- **No raw SQL** — use ORM queries only. Example:
  ```python
  db.query(Transaction).filter(Transaction.type == "expense").order_by(Transaction.date.desc()).all()
  ```
- **Alembic is not yet active.** Until it is, schema changes are handled by `create_all()`. Before any real user data exists, a `drop_all() + create_all()` is acceptable for development. Once Alembic is activated, never touch `create_all()` for schema changes.
- **SQLite → Postgres migration** will happen before launch. Write queries that are compatible with both (avoid SQLite-only features).

---

## Current Models

### Transaction
| Field | Type | Notes |
|-------|------|-------|
| id | Integer | Primary key |
| description | String | Required |
| amount | Float | Always positive |
| category | String | See categories below |
| type | String | `"income"` or `"expense"` |
| date | DateTime | User-specified date |
| created_at | DateTime | Server-set timestamp |

**Expense categories:** Housing, Groceries, Transport, Entertainment, Shopping, Health, Utilities, Dining, Savings, Other

**Income categories:** Salary, Freelance, Investment Returns, Other

---

## Financial Health Logic

`app/api/routes/financial_health.py` implements the 50/30/20 rule:

- **Needs (50%):** Housing, Groceries, Transport, Health, Utilities
- **Wants (30%):** Entertainment, Shopping, Dining
- **Savings (20%):** Savings

Grade is calculated as `score = 100 - total_deviation` where deviation is the sum of absolute differences between actual and target percentages. Grade thresholds: A≥90, B≥75, C≥60, D≥45, F<45.

When adding new expense categories, update `NEEDS`, `WANTS`, or `SAVINGS` sets in this file accordingly.

---

## Auth (Not Yet Implemented)

The `User` model exists but is not wired to anything. When implementing auth:
1. Use FastAPI's `OAuth2PasswordBearer` or a JWT middleware
2. Add `user_id` foreign key to `Transaction`
3. Scope all queries to the authenticated user
4. Suggested library: `python-jose` for JWT, `passlib[bcrypt]` for password hashing

---

## Testing

No tests yet. When adding:
- Use `pytest` + `httpx.AsyncClient` with an in-memory SQLite DB
- Add `pytest` and `httpx` to `requirements.txt`
- Test file convention: `tests/test_transactions.py`

---

## Environment Variables

Copy `.env.example` to `.env`:
```
DATABASE_URL=sqlite:///./vault.db
SECRET_KEY=change-me-in-production
ENVIRONMENT=development
```

`DATABASE_URL` overrides the SQLite default for future Postgres migrations.

---

## Commit Convention

```
feat(backend): add user authentication
fix(backend): handle missing transaction category
refactor(backend): extract pagination helper

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
