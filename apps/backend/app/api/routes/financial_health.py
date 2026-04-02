from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from collections import defaultdict
from app.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import FinancialHealthOut, RuleAnalysis, CategoryBreakdown
from app.api.deps import get_current_user

router = APIRouter()

NEEDS = {"Housing", "Groceries", "Transport", "Health", "Utilities"}
WANTS = {"Entertainment", "Shopping", "Dining"}
SAVINGS = {"Savings"}

RULES_DEF = [
    {"label": "Needs",   "target_pct": 50.0, "categories": sorted(NEEDS)},
    {"label": "Wants",   "target_pct": 30.0, "categories": sorted(WANTS)},
    {"label": "Savings", "target_pct": 20.0, "categories": sorted(SAVINGS)},
]


def _grade(score: float) -> str:
    if score >= 90: return "A"
    if score >= 75: return "B"
    if score >= 60: return "C"
    if score >= 45: return "D"
    return "F"


@router.get("", response_model=FinancialHealthOut)
def get_financial_health(
    month: str = Query(default=None, description="YYYY-MM"),
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

    total_income = sum(t.amount for t in txs if t.type == "income")
    by_category: dict[str, float] = defaultdict(float)
    for t in txs:
        if t.type == "expense":
            by_category[t.category] += t.amount

    total_expenses = sum(by_category.values())
    base = total_income if total_income > 0 else total_expenses

    rules: list[RuleAnalysis] = []
    total_deviation = 0.0

    for rule in RULES_DEF:
        amount = sum(by_category.get(c, 0) for c in rule["categories"])
        actual_pct = (amount / base * 100) if base > 0 else 0.0
        deviation = abs(actual_pct - rule["target_pct"])
        total_deviation += deviation

        if actual_pct > rule["target_pct"] + 2:
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
