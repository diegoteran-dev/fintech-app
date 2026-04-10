from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Literal


class TransactionCreate(BaseModel):
    description: str
    amount: float
    currency: str = "USD"
    category: str
    type: Literal["income", "expense"]
    date: datetime
    is_recurring: bool = False


class TransactionOut(TransactionCreate):
    id: int
    amount_usd: float | None
    is_recurring: bool
    is_reviewed: bool = False
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None
    amount: float | None = None


class CategoryBreakdown(BaseModel):
    category: str
    amount: float
    percentage: float


class RuleAnalysis(BaseModel):
    label: str
    actual_pct: float
    target_pct: float
    amount: float
    categories: list[str]
    status: str  # "on_track" | "over" | "under"


class FinancialHealthOut(BaseModel):
    grade: str
    score: float
    total_income: float
    total_expenses: float
    rules: list[RuleAnalysis]
    category_breakdown: list[CategoryBreakdown]
    month: str
