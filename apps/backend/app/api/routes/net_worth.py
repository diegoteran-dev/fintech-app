from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.net_worth import NetWorth
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


class NetWorthCreate(BaseModel):
    amount_usd: float
    date: datetime
    notes: str | None = None


class NetWorthOut(BaseModel):
    id: int
    amount_usd: float
    date: datetime
    notes: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[NetWorthOut])
def list_net_worth(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(NetWorth)
        .filter(NetWorth.user_id == current_user.id)
        .order_by(NetWorth.date.asc())
        .all()
    )


@router.post("", response_model=NetWorthOut, status_code=201)
def create_net_worth(
    data: NetWorthCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = NetWorth(**data.model_dump(), user_id=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_net_worth(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(NetWorth)
        .filter(NetWorth.id == entry_id, NetWorth.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
