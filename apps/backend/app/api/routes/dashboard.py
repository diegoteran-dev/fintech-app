from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from datetime import datetime

from app.database import get_db
from app.models.transaction import Transaction
from app.api.routes.auth import get_current_user
from app.models.user import User

router = APIRouter()

_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/yearly-overview")
def yearly_overview(
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return income and expenses for all 12 months of a given year (zeros for empty months)."""
    if year is None:
        year = datetime.utcnow().year

    rows = (
        db.query(
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(Transaction.amount_usd).label("total_usd"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            extract("year", Transaction.date) == year,
        )
        .group_by(extract("month", Transaction.date), Transaction.type)
        .all()
    )

    data = {m: {"month": _MONTH_NAMES[m - 1], "income": 0.0, "expenses": 0.0} for m in range(1, 13)}
    for row in rows:
        m = int(row.month)
        if row.type == "income":
            data[m]["income"] = round(row.total_usd or 0, 2)
        elif row.type == "expense":
            data[m]["expenses"] = round(row.total_usd or 0, 2)

    return list(data.values())


@router.get("/monthly-balance")
def monthly_balance(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return income, expenses, and net balance in USD for a given calendar month."""
    now = datetime.utcnow()
    if year is None:
        year = now.year
    if month is None:
        month = now.month

    rows = (
        db.query(
            Transaction.type,
            func.sum(Transaction.amount_usd).label("total_usd"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
        .group_by(Transaction.type)
        .all()
    )

    income_usd = 0.0
    expenses_usd = 0.0
    for row in rows:
        if row.type == "income":
            income_usd = round(row.total_usd or 0, 2)
        elif row.type == "expense":
            expenses_usd = round(row.total_usd or 0, 2)

    return {
        "year": year,
        "month": month,
        "income_usd": income_usd,
        "expenses_usd": expenses_usd,
        "balance_usd": round(income_usd - expenses_usd, 2),
    }
