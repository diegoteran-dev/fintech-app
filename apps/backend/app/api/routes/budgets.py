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

router = APIRouter()


def _month_spending(user_id: int, db: Session, year: int, month: int) -> dict[str, float]:
    """Return expense spending by category (string) for the given month."""
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
        amount = float(tx.amount_usd if tx.amount_usd is not None else tx.amount)
        by_category[str(tx.category)] += amount
    return dict(by_category)


def _build_out(budget: Budget, spending: dict[str, float]) -> BudgetOut:
    cat_name = budget.category.name
    spent = round(spending.get(cat_name, 0.0), 2)
    pct = round(spent / budget.amount * 100, 1) if budget.amount > 0 else 0.0
    return BudgetOut(
        id=budget.id,
        category=cat_name,
        amount=budget.amount,
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
    spending = _month_spending(current_user.id, db, year, m)
    return [_build_out(b, spending) for b in budgets]


@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = db.query(Category).filter(Category.name == data.category).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{data.category}' not found")

    existing = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.category_id == category.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Budget already exists for this category")

    budget = Budget(
        user_id=current_user.id,
        category_id=category.id,
        amount=data.amount,
        period=data.period,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    now = datetime.utcnow()
    spending = _month_spending(current_user.id, db, now.year, now.month)
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
    if data.period is not None:
        budget.period = data.period

    db.commit()
    db.refresh(budget)
    now = datetime.utcnow()
    spending = _month_spending(current_user.id, db, now.year, now.month)
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
