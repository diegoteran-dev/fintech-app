from sqlalchemy import Column, String, DateTime, func
from app.database import Base


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    token = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
