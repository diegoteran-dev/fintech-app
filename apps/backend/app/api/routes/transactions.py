from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionOut
from app.api.deps import get_current_user
from app.services.exchange_rate import to_usd

router = APIRouter()


@router.get("", response_model=list[TransactionOut])
def get_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc())
        .all()
    )


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx_data = data.model_dump()
    currency = tx_data.get("currency", "USD").upper()
    tx_data["currency"] = currency
    tx_data["amount_usd"] = to_usd(tx_data["amount"], currency)
    tx = Transaction(**tx_data, user_id=current_user.id)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
