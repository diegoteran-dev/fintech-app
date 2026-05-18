import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func

from app.database import get_db
from app.models.transaction import Transaction
from app.api.routes.auth import get_current_user
from app.api.routes.utils import get_cached_rate
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/yearly-overview")
def yearly_overview(
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return income and expenses (USD) for all 12 months of a given year."""
    if year is None:
        year = datetime.utcnow().year

    # Use COALESCE so NULL amount_usd falls back to raw amount
    rows = (
        db.query(
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(func.coalesce(Transaction.amount_usd, Transaction.amount)).label("total_usd"),
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
    """
    Return income, expenses, and net balance for a calendar month.
    Amounts in both USD and BOB (using the live cached exchange rate).
    """
    now = datetime.utcnow()
    if year is None:
        year = now.year
    if month is None:
        month = now.month

    rows = (
        db.query(
            Transaction.type,
            func.sum(func.coalesce(Transaction.amount_usd, Transaction.amount)).label("total_usd"),
            func.count(Transaction.id).label("count"),
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
        logger.debug("monthly_balance row: type=%s count=%d total_usd=%s", row.type, row.count, row.total_usd)
        if row.type == "income":
            income_usd = round(row.total_usd or 0, 2)
        elif row.type == "expense":
            expenses_usd = round(row.total_usd or 0, 2)

    rate = get_cached_rate()
    logger.info(
        "monthly_balance %d-%02d: income_usd=%.2f expenses_usd=%.2f rate=%.4f",
        year, month, income_usd, expenses_usd, rate,
    )

    return {
        "year": year,
        "month": month,
        "income_usd": income_usd,
        "expenses_usd": expenses_usd,
        "balance_usd": round(income_usd - expenses_usd, 2),
        "income_bob": round(income_usd * rate, 2),
        "expenses_bob": round(expenses_usd * rate, 2),
        "balance_bob": round((income_usd - expenses_usd) * rate, 2),
        "rate": rate,
    }
