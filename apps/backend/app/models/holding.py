from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    asset_type = Column(String, nullable=False)   # "stock" | "etf" | "metal" | "crypto"
    ticker = Column(String, nullable=False)        # e.g. "AAPL", "BTC", "GLD"
    name = Column(String, nullable=True)           # e.g. "Apple Inc."
    quantity = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="holdings")
