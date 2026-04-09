from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from collections import defaultdict
from typing import TypedDict
from app.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import FinancialHealthOut, RuleAnalysis, CategoryBreakdown
from app.api.deps import get_current_user

router = APIRouter()

NEEDS = {"Housing", "Groceries", "Transport", "Health", "Utilities", "Insurance", "Education"}
WANTS = {"Entertainment", "Shopping", "Dining", "Personal Care", "Travel", "Gifts & Donations"}
SAVINGS = {"Savings"}


class RuleDef(TypedDict):
    label: str
    target_pct: float
    categories: list[str]


RULES_DEF: list[RuleDef] = [
    {"label": "Needs",   "target_pct": 50.0, "categories": sorted(NEEDS)},
    {"label": "Wants",   "target_pct": 30.0, "categories": sorted(WANTS)},
    {"label": "Savings", "target_pct": 20.0, "categories": sorted(SAVINGS)},
]


def _grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 45:
        return "D"
    return "F"


@router.get("", response_model=FinancialHealthOut)
def get_financial_health(
    month: str = Query(default=None, description="YYYY-MM"),
    needs: float = Query(default=50.0, ge=0, le=100),
    wants: float = Query(default=30.0, ge=0, le=100),
    savings: float = Query(default=20.0, ge=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month:
        year, m = map(int, month.split("-"))
    else:
        now = datetime.utcnow()
        year, m = now.year, now.month

    month_str = f"{year:04d}-{m:02d}"
    start = datetime(year, m, 1)
    end = datetime(year + 1, 1, 1) if m == 12 else datetime(year, m + 1, 1)

    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start,
        Transaction.date < end,
    ).all()

    def _usd(t) -> float:
        """Return USD equivalent of a transaction amount."""
        return float(t.amount_usd if t.amount_usd is not None else t.amount)

    total_income = sum(_usd(t) for t in txs if t.type == "income")
    by_category: dict[str, float] = defaultdict(float)
    for t in txs:
        if t.type == "expense":
            by_category[str(t.category)] += _usd(t)

    total_expenses = sum(by_category.values())
    base = total_income if total_income > 0 else total_expenses

    rules_def = [
        {"label": "Needs",   "target_pct": needs,   "categories": sorted(NEEDS)},
        {"label": "Wants",   "target_pct": wants,   "categories": sorted(WANTS)},
        {"label": "Savings", "target_pct": savings, "categories": sorted(SAVINGS)},
    ]

    rules: list[RuleAnalysis] = []
    total_deviation = 0.0

    for rule in rules_def:
        amount = sum(by_category.get(c, 0) for c in rule["categories"])
        actual_pct = (amount / base * 100) if base > 0 else 0.0

        # Over-saving is not penalized — only under-saving counts as deviation.
        # Over-spending on needs/wants still penalizes in both directions.
        if rule["label"] == "Savings":
            deviation = max(0.0, rule["target_pct"] - actual_pct)
        else:
            deviation = abs(actual_pct - rule["target_pct"])
        total_deviation += deviation

        if rule["label"] == "Savings" and actual_pct > rule["target_pct"] + 2:
            status = "on_track"
        elif actual_pct > rule["target_pct"] + 2:
            status = "over"
        elif actual_pct < rule["target_pct"] - 2:
            status = "under"
        else:
            status = "on_track"

        rules.append(RuleAnalysis(
            label=rule["label"],
            actual_pct=round(actual_pct, 1),
            target_pct=rule["target_pct"],
            amount=round(amount, 2),
            categories=rule["categories"],
            status=status,
        ))

    score = max(0.0, min(100.0, 100.0 - total_deviation))

    breakdown = [
        CategoryBreakdown(
            category=cat,
            amount=round(amount, 2),
            percentage=round(amount / total_expenses * 100, 1) if total_expenses > 0 else 0,
        )
        for cat, amount in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
    ]

    return FinancialHealthOut(
        grade=_grade(score),
        score=round(score, 1),
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        rules=rules,
        category_breakdown=breakdown,
        month=month_str,
    )
