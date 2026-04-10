from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, func
from datetime import datetime
from sqlalchemy.orm import relationship
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    amount_usd = Column(Float, nullable=True)  # USD equivalent, populated on create
    category = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "income" | "expense"
    date = Column(DateTime, nullable=False, default=datetime.utcnow)
    merchant = Column(String, nullable=True)
    # FKs — nullable during migration to multi-user; will become required post-auth
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    is_recurring = Column(Boolean, default=False, nullable=False, server_default='0')
    is_reviewed = Column(Boolean, default=False, nullable=False, server_default='false')
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
