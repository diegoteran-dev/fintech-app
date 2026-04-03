from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from app.api.deps import get_current_user
from app.services.exchange_rate import to_usd
from app.services.category_detector import detect_category

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


def _clean_bg_desc(raw: str) -> str:
    """Turn a raw Banco Ganadero description into a short readable label."""
    import re

    EMPTY_REFS = {'sin referencia', 'sin datos', 'sin ref'}

    # POS card purchase: "POS MERCHANT NAME Tarj: XXXX BO" → "Merchant Name"
    if raw.upper().startswith('POS '):
        s = raw[4:]
        s = re.sub(r'\s+Tarj:\s+\d+\s+BO\s*$', '', s, flags=re.IGNORECASE).strip()
        return s.title()

    # ACH / QR transfer: "TRANSF. [QR ]ACH Nro. TXREF BANK ACCOUNT NAME [MEMO]"
    m_transf = re.match(r'^TRANSF\.\s+(?:QR\s+)?ACH\s+Nro\.\s+\d+\s+(.*)', raw, re.IGNORECASE)
    if m_transf:
        rest = m_transf.group(1)          # "BANK ACCOUNT NAME MEMO"
        # skip the account number (8+ digits) — everything after it is name + memo
        m_acct = re.search(r'\d{8,}', rest)
        if m_acct:
            after = rest[m_acct.end():].strip()
            # Strip trailing empty-ref phrases even when other text precedes them
            after = re.sub(r'\s+(?:sin referencia|sin datos|sin ref)\s*$', '', after, flags=re.IGNORECASE).strip()
            if after:
                return after
        # no account number or empty memo — return whatever is left
        return rest.strip() or raw

    # "Transferencia de ACCOUNT. NAME [MEMO]" — incoming payment
    m_from = re.match(r'^Transferencia\s+de\s+\d+\.\s+(.*)', raw, re.IGNORECASE)
    if m_from:
        s = m_from.group(1).strip()
        s = re.sub(r'\s+Sin\s+referencia\s*$', '', s, flags=re.IGNORECASE).strip()
        return s or raw

    # "Transferencia a ACCOUNT. NAME [MEMO]" — outgoing payment
    m_to = re.match(r'^Transferencia\s+a\s+\d+\.\s+(.*)', raw, re.IGNORECASE)
    if m_to:
        s = m_to.group(1).strip()
        s = re.sub(r'\s+Sin\s+referencia\s*$', '', s, flags=re.IGNORECASE).strip()
        return ('→ ' + s) if s else raw

    # "Trans a ACCOUNT. NAME [MEMO]" — quick internal transfer
    m_trans = re.match(r'^Trans\s+a\s+\d+\.\s+(.*)', raw, re.IGNORECASE)
    if m_trans:
        s = m_trans.group(1).strip()
        s = re.sub(r'\s+Sin\s+referencia\s*$', '', s, flags=re.IGNORECASE).strip()
        return ('→ ' + s) if s else raw

    return raw


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

    all_lines: list[str] = []
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                all_lines.extend(text.split('\n'))

    date_line_re = re.compile(r'^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}\s+')
    # Skip page footers and summary lines that are not transaction data
    skip_re = re.compile(r'^(Página|SALDO|CANTIDAD|FECHA HORA)')

    blocks: list[str] = []
    current: list[str] = []
    for raw in all_lines:
        line = raw.strip()
        if not line or skip_re.match(line):
            continue
        if date_line_re.match(line):
            if current:
                blocks.append(' '.join(current))
            current = [line]
        elif current:
            current.append(line)
    if current:
        blocks.append(' '.join(current))

    # KEY FIX: amounts appear on the DATE line itself (not at end of block),
    # followed by continuation description lines appended after.
    # Do NOT anchor with $ — match anywhere in the joined block.
    amount_re = re.compile(r'(-[\d,]+\.\d{2})\s+(\+[\d,]+\.\d{2})\s+([\d,]+\.\d{2})')

    rows_out: list[dict] = []
    for block in blocks:
        m = amount_re.search(block)
        if not m:
            continue

        debit = abs(float(m.group(1).replace(',', '')))
        credit = float(m.group(2).replace(',', '').replace('+', ''))

        if debit == 0 and credit == 0:
            continue

        date_m = re.match(r'(\d{2}/\d{2}/\d{4})', block)
        if not date_m:
            continue
        try:
            tx_date = datetime.strptime(date_m.group(1), '%d/%m/%Y').strftime('%Y-%m-%d')
        except ValueError:
            continue

        # Description = inline text before amounts (after date+time+channel+txnum)
        #             + continuation lines that follow the amounts
        before = block[:m.start()].strip()
        before = re.sub(r'^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}\s+', '', before)
        before = re.sub(r'^.*?\d{6,}\s+', '', before, count=1)  # remove channel + txnum

        after = block[m.end():].strip()

        raw_desc = re.sub(r'\s+', ' ', (before + ' ' + after)).strip() or 'Imported'
        desc = _clean_bg_desc(raw_desc)

        tx_type = 'expense' if debit > 0 else 'income'
        amount = debit if debit > 0 else credit

        rows_out.append({
            'date': tx_date,
            'description': desc,
            'amount': round(amount, 2),
            'type': tx_type,
            'currency': 'BOB',
            'category': detect_category(desc, tx_type),
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
