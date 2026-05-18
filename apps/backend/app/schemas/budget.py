from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Literal


class BudgetCreate(BaseModel):
    category: str
    amount: float
    currency: str = "USD"
    period: Literal["monthly", "weekly", "yearly"] = "monthly"


class BudgetUpdate(BaseModel):
    amount: float | None = None
    currency: str | None = None
    period: Literal["monthly", "weekly", "yearly"] | None = None


class BudgetOut(BaseModel):
    id: int
    category: str
    amount: float
    currency: str
    period: str
    spent: float
    percentage: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=False)
