from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AccountCreate(BaseModel):
    name: str
    institution: Optional[str] = None
    account_type: str  # "checking" | "savings" | "investment" | "crypto"
    currency: str = "USD"
    current_balance: float = 0.0


class AccountUpdate(BaseModel):
    current_balance: float


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    institution: Optional[str]
    account_type: str
    currency: str
    current_balance: float
    created_at: Optional[datetime]
