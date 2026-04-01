from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Literal


class TransactionCreate(BaseModel):
    description: str
    amount: float
    category: str
    type: Literal["income", "expense"]
    date: datetime


class TransactionOut(TransactionCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


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
