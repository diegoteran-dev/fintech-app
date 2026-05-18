from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    icon = Column(String, nullable=True)
    color = Column(String, nullable=True)  # hex color, e.g. "#7C3AED"
    is_system = Column(Boolean, nullable=False, default=True)  # True = default, False = user-created
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    budgets = relationship("Budget", back_populates="category")
