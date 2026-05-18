from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    institution = Column(String, nullable=True)
    account_type = Column(String, nullable=False)  # "checking", "savings", "investment", "crypto"
    currency = Column(String, nullable=False, default="USD")
    current_balance = Column(Float, nullable=False, default=0.0)
    # Plaid integration fields (populated when linked via Plaid)
    plaid_item_id = Column(String, nullable=True, unique=True)
    plaid_account_id = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")
