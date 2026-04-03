from datetime import datetime, date
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


@router.post("/generate-recurring", response_model=dict)
def generate_recurring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate copies of recurring transactions for the current month if not already generated."""
    today = date.today()
    current_month_start = datetime(today.year, today.month, 1)

    # Determine previous month
    if today.month == 1:
        prev_year = today.year - 1
        prev_month = 12
    else:
        prev_year = today.year
        prev_month = today.month - 1

    prev_month_start = datetime(prev_year, prev_month, 1)
    if prev_month == 12:
        prev_month_end = datetime(prev_year + 1, 1, 1)
    else:
        prev_month_end = datetime(prev_year, prev_month + 1, 1)

    # Find recurring transactions from the previous month
    recurring = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.is_recurring == True,  # noqa: E712
            Transaction.date >= prev_month_start,
            Transaction.date < prev_month_end,
        )
        .all()
    )

    # Check which haven't been generated this month yet (match by description + category + type)
    already_this_month = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= current_month_start,
        )
        .all()
    )
    existing_keys = {(t.description, t.category, t.type) for t in already_this_month}

    generated = 0
    for tx in recurring:
        key = (tx.description, tx.category, tx.type)
        if key not in existing_keys:
            new_tx = Transaction(
                description=tx.description,
                amount=tx.amount,
                currency=tx.currency,
                amount_usd=tx.amount_usd,
                category=tx.category,
                type=tx.type,
                date=current_month_start,
                is_recurring=True,
                user_id=current_user.id,
            )
            db.add(new_tx)
            generated += 1

    if generated > 0:
        db.commit()

    return {"generated": generated}


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
