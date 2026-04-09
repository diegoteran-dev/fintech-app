from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # nullable to support OAuth-only users
    full_name = Column(String, nullable=True)
    auth_provider = Column(String, nullable=True)  # "local", "google", etc.
    auth_provider_id = Column(String, nullable=True, index=True)  # external OAuth sub/id
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    accounts = relationship("Account", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    net_worth_entries = relationship("NetWorth", back_populates="user")
    holdings = relationship("Holding", back_populates="user")
