from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, func
from datetime import datetime
from sqlalchemy.orm import relationship
from app.database import Base


class NetWorth(Base):
    __tablename__ = "net_worth"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount_usd = Column(Float, nullable=False)
    date = Column(DateTime, nullable=False, default=datetime.utcnow)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="net_worth_entries")
