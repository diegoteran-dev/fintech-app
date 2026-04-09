from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from collections import defaultdict
from app.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetOut
from app.api.deps import get_current_user
from app.services.exchange_rate import from_usd

router = APIRouter()


def _month_spending(user_id: int, db: Session, year: int, month: int, currency: str) -> float:
    """Return total expense spending for a category in the given month, converted to target currency."""
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    txs = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.date >= start,
        Transaction.date < end,
        Transaction.type == "expense",
    ).all()

    by_category: dict[str, float] = defaultdict(float)
    for tx in txs:
        # Use native amount if it matches the budget currency, otherwise convert via USD
        if str(tx.currency).upper() == currency.upper():
            amount = float(tx.amount)
        else:
            usd = float(tx.amount_usd if tx.amount_usd is not None else tx.amount)
            amount = from_usd(usd, currency)
        by_category[str(tx.category)] += amount
    return dict(by_category)


def _build_out(budget: Budget, spending: dict[str, float]) -> BudgetOut:
    cat_name = budget.category.name
    currency = str(budget.currency) if budget.currency else "USD"
    spent = round(spending.get(cat_name, 0.0), 2)
    pct = round(spent / budget.amount * 100, 1) if budget.amount > 0 else (100.0 if spent > 0 else 0.0)
    return BudgetOut(
        id=budget.id,
        category=cat_name,
        amount=budget.amount,
        currency=currency,
        period=budget.period,
        spent=spent,
        percentage=pct,
        created_at=budget.created_at or datetime.utcnow(),
    )


@router.get("", response_model=list[BudgetOut])
def get_budgets(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month:
        year, m = map(int, month.split("-"))
    else:
        now = datetime.utcnow()
        year, m = now.year, now.month

    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .order_by(Budget.created_at)
        .all()
    )
    # Build spending lookup per currency (one DB pass per unique currency used)
    spending_by_currency: dict[str, dict[str, float]] = {}
    for b in budgets:
        cur = str(b.currency) if b.currency else "USD"
        if cur not in spending_by_currency:
            spending_by_currency[cur] = _month_spending(current_user.id, db, year, m, cur)
    return [_build_out(b, spending_by_currency[str(b.currency) if b.currency else "USD"]) for b in budgets]


@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = db.query(Category).filter(Category.name == data.category).first()
    if not category:
        category = Category(name=data.category, icon="📦", color="#6B7280", is_system=False)
        db.add(category)
        db.flush()

    existing = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.category_id == category.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Budget already exists for this category")

    currency = data.currency.upper() if data.currency else "USD"
    budget = Budget(
        user_id=current_user.id,
        category_id=category.id,
        amount=data.amount,
        currency=currency,
        period=data.period,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    now = datetime.utcnow()
    spending = _month_spending(current_user.id, db, now.year, now.month, currency)
    return _build_out(budget, spending)


@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == current_user.id,
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    if data.amount is not None:
        budget.amount = data.amount
    if data.currency is not None:
        budget.currency = data.currency.upper()
    if data.period is not None:
        budget.period = data.period

    db.commit()
    db.refresh(budget)
    now = datetime.utcnow()
    currency = str(budget.currency) if budget.currency else "USD"
    spending = _month_spending(current_user.id, db, now.year, now.month, currency)
    return _build_out(budget, spending)


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == current_user.id,
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
