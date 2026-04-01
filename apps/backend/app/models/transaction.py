from sqlalchemy import Column, Integer, String, Float, DateTime, func
from datetime import datetime
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "income" | "expense"
    date = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, server_default=func.now())
