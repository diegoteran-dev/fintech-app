from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from app.api.deps import get_current_user
from app.services.exchange_rate import to_usd
from app.services.category_detector import detect_category
from app.services.categorization import save_user_rule, get_user_category

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
    from_import: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx_data = data.model_dump()
    currency = tx_data.get("currency", "USD").upper()
    tx_data["currency"] = currency
    tx_data["amount_usd"] = to_usd(tx_data["amount"], currency)

    # Duplicate detection — comprobante-based (strongest, BNB statements)
    comprobante = tx_data.get("comprobante")
    if comprobante:
        existing = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.comprobante == comprobante,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="duplicate")

    # Duplicate detection — date + amount + description (fallback for all banks)
    if tx_data.get("date"):
        tx_date = tx_data["date"]
        if isinstance(tx_date, str):
            from datetime import datetime as _dt
            try:
                tx_date = _dt.fromisoformat(tx_date.replace("Z", "+00:00"))
            except ValueError:
                tx_date = None
        if tx_date:
            existing = db.query(Transaction).filter(
                Transaction.user_id == current_user.id,
                Transaction.description == tx_data.get("description"),
                Transaction.amount == tx_data.get("amount"),
                Transaction.date == tx_date,
            ).first()
            if existing:
                raise HTTPException(status_code=409, detail="duplicate")

    # Manual creates (not from import): save user rule + mark as reviewed
    if not from_import:
        tx_data["is_reviewed"] = True
        save_user_rule(
            db,
            user_id=current_user.id,
            description=tx_data["description"],
            category_name=tx_data["category"],
            source="manual_create",
        )
    else:
        tx_data["is_reviewed"] = False

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Parse a bank statement PDF and return transaction rows (not saved yet).
    Supports: Banco Ganadero, MakroBanx, Banco Económico.
    Bank is auto-detected from PDF content.
    """
    import io
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber not installed")

    from app.services.parsers import detect_and_parse

    contents = await file.read()

    # Extract full text from all pages using pdfplumber
    full_text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text_parts.append(text)
    full_text = "\n".join(full_text_parts)

    if not full_text.strip():
        raise HTTPException(status_code=422, detail="No se pudo extraer texto del PDF.")

    try:
        _bank_name, rows = detect_and_parse(full_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Apply categorization — user rules first, global categorizer as fallback
    rows_out: list[dict] = []
    for row in rows:
        desc = row["description"]
        tx_type = row["type"]
        hint = row.get("category_hint")

        # Try user's personal rules first
        user_match = get_user_category(db, current_user.id, desc)
        if user_match:
            category_name, _confidence, match_level = user_match
            category = category_name
            # High-confidence matches (exact/fingerprint) are marked reviewed
            is_reviewed = match_level in ("exact", "fingerprint")
        elif hint:
            category = hint
            is_reviewed = False
        else:
            category = detect_category(desc, tx_type)
            is_reviewed = False

        rows_out.append({
            "date": row["date"],
            "description": desc,
            "amount": row["amount"],
            "type": tx_type,
            "currency": row.get("currency", "BOB"),
            "category": category,
            "is_reviewed": is_reviewed,
            "comprobante": row.get("comprobante"),
        })

    return rows_out


@router.get("/months", response_model=list[str])
def get_transaction_months(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct YYYY-MM strings for months that have transactions, newest first."""
    rows = (
        db.query(Transaction.date)
        .filter(Transaction.user_id == current_user.id, Transaction.date.isnot(None))
        .all()
    )
    months = sorted(
        {row[0].strftime('%Y-%m') for row in rows if row[0]},
        reverse=True,
    )
    return months


@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int,
    data: TransactionUpdate,
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
    updates = data.model_dump(exclude_none=True)

    # If category is being changed, save/update the user rule
    if 'category' in updates and updates['category'] != tx.category:
        save_user_rule(
            db,
            user_id=current_user.id,
            description=tx.description,
            category_name=updates['category'],
            source="manual_edit",
        )
        tx.is_reviewed = True

    for field, value in updates.items():
        setattr(tx, field, value)
    if 'amount' in updates:
        tx.amount_usd = to_usd(tx.amount, tx.currency)
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
