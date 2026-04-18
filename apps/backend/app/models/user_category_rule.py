from sqlalchemy import (
    Boolean, Column, Integer, String, Text, DateTime, ForeignKey,
    UniqueConstraint, Index, func,
)
from sqlalchemy.orm import relationship
from app.database import Base


class UserCategoryRule(Base):
    __tablename__ = "user_category_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    merchant_raw = Column(Text, nullable=False)
    merchant_fingerprint = Column(Text, nullable=False)
    transaction_type = Column(String(10), nullable=True)  # 'income' | 'expense' | null (both)
    category_id = Column(
        Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    source = Column(String(32), nullable=False)  # manual_edit | manual_create | bulk_categorize
    confidence = Column(Integer, nullable=False, server_default="100")
    times_applied = Column(Integer, nullable=False, server_default="0")
    last_applied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())

    user = relationship("User")
    category = relationship("Category")

    __table_args__ = (
        UniqueConstraint("user_id", "merchant_fingerprint", "transaction_type", name="uq_user_fingerprint_type"),
        Index("ix_ucr_user_fingerprint", "user_id", "merchant_fingerprint"),
    )
