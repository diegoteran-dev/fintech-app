from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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


@router.post("/parse-pdf", response_model=list[dict])
async def parse_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Parse a Banco Ganadero PDF statement and return rows (not saved)."""
    import io
    import re
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber not installed")

    contents = await file.read()
    rows_out = []

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            for row in table:
                if not row or len(row) < 7:
                    continue
                # Skip header rows
                fecha = (row[0] or '').strip()
                if not fecha or not re.match(r'\d{2}/\d{2}/\d{4}', fecha):
                    continue

                raw_desc = (row[4] or '').strip().replace('\n', ' ')
                raw_debit = (row[5] or '').strip()
                raw_credit = (row[6] or '').strip()

                def parse_amount(s: str) -> float:
                    cleaned = re.sub(r'[^0-9.]', '', s.replace(',', ''))
                    try:
                        return float(cleaned)
                    except ValueError:
                        return 0.0

                debit = parse_amount(raw_debit)
                credit = parse_amount(raw_credit)

                if debit == 0 and credit == 0:
                    continue

                # DD/MM/YYYY → ISO date
                try:
                    tx_date = datetime.strptime(fecha, '%d/%m/%Y').strftime('%Y-%m-%d')
                except ValueError:
                    continue

                tx_type = 'expense' if debit > 0 else 'income'
                amount = debit if debit > 0 else credit

                # Clean description: take first meaningful line
                desc = re.sub(r'\s+', ' ', raw_desc).strip()
                if not desc:
                    desc = 'Imported'

                rows_out.append({
                    'date': tx_date,
                    'description': desc,
                    'amount': round(amount, 2),
                    'type': tx_type,
                    'currency': 'BOB',
                })

    return rows_out


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
