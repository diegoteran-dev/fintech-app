"""
banco_economico.py
==================
Parser for Banco Económico (Bolivia) BOB account statements.

Extraction method: pdfplumber extract_text()
Banco Económico statements have one transaction per block with:
  - A main description line starting with a date (DD/Mon/YYYY HH:MM)
  - An optional "Nota:" sub-line with the merchant/person name
  - A MONTO column that is already signed (negative = expense, positive = income)

CHALLENGE 3 — Spanish month abbreviations (accented + unaccented):
  DD/Mon/YYYY where Mon is Ene, Feb, Mar, Abr, May, Jun,
  Jul, Ago, Sep, Oct, Nov, Dic (case-insensitive).

CHALLENGE 4 — "Nota:" sub-lines:
  Lines starting with "Nota:" are continuation of the previous transaction.
  Merged into description as "{main} | {nota}".

CHALLENGE 5 — garbled encoding:
  Some merchant names have corrupted characters from PDF font encoding.
  We pass them through as-is (decoded with errors="replace").
  We never crash on bad bytes.

CHALLENGE 6 — large pass-through transactions:
  Import all amounts regardless of size.
"""
from __future__ import annotations
import re
import logging
from datetime import datetime

from .base import BankParser

logger = logging.getLogger(__name__)

# Spanish month map — both accented and unaccented variants
_MONTH_MAP: dict[str, str] = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
}

# Transaction date pattern: DD/Mon/YYYY or DD/Mon./YYYY (some PDFs add a dot)
_DATE_RE = re.compile(
    r'^(\d{1,2})/([A-Za-záéíóúÁÉÍÓÚ]{3})\.?/(\d{4})',
)

# A full transaction line starts with date and contains a signed amount.
# The signed amount (MONTO) may appear anywhere after the date block.
_TX_LINE_RE = re.compile(
    r'^(\d{1,2}/[A-Za-záéíóúÁÉÍÓÚ]{3}\.?/\d{4})',
)

# Numeric amount with optional sign and thousands separator
# e.g. -1,234.56 or 8,200.00 or -13.87
_AMOUNT_RE = re.compile(r'(-?\d[\d,]*\.\d{2})')

# Lines to skip (headers, summaries)
_SKIP_RE = re.compile(
    r'^(FECHA|HORA|NRO|DESCRIPCI[OÓ]N|MONTO|SALDO'
    r'|Saldo\s+Inicial|Saldo\s+Final|Saldo\s+a\s+la\s+Fecha'
    r'|Retenciones\s+Judiciales|RETENCI'
    r'|P[AÁ]GINA|Banco\s+Econ[oó]mico|baneco'
    r'|Titular:|Cuenta:|Del\s+\d|Extracto|EXTRACTO)',
    re.IGNORECASE,
)

# Category hints for special transaction types
_HINT_MAP: list[tuple[str, str]] = [
    (r'intereses\s+ganados',        'Investment Returns'),
    (r'retencion.*impuesto',        'Utilities'),
    (r'impuesto.*iva',              'Utilities'),
]


def _parse_date(day: str, mon: str, year: str) -> str | None:
    """Convert DD, Mon, YYYY to YYYY-MM-DD. Returns None on unknown month."""
    m = _MONTH_MAP.get(mon.lower()[:3])
    if not m:
        logger.warning("BancoEconomico: unknown month abbreviation %r", mon)
        return None
    try:
        return datetime(int(year), int(m), int(day)).strftime('%Y-%m-%d')
    except ValueError as exc:
        logger.warning("BancoEconomico: invalid date %s/%s/%s — %s", day, mon, year, exc)
        return None


def _category_hint(description: str) -> str | None:
    desc_lower = description.lower()
    for pattern, hint in _HINT_MAP:
        if re.search(pattern, desc_lower):
            return hint
    return None


class BancoEconomicoParser(BankParser):
    bank_name = "Banco Económico"

    def can_parse(self, text: str) -> bool:
        # Domain URL is a definitive match — only appears in Banco Económico's own header.
        if re.search(r'baneco\.com\.bo', text, re.IGNORECASE):
            return True
        # Fallback to name match, but exclude if Banco Ganadero is present —
        # "BANCO ECONOMICO" appears as a QR/transfer counterparty in BG statements.
        if re.search(r'banco\s+econ[oó]mico', text, re.IGNORECASE):
            return not bool(re.search(r'banco\s+ganadero', text, re.IGNORECASE))
        return False

    def parse(self, text: str) -> list[dict]:
        # Decode safety: text is already a str from pdfplumber; garbled chars
        # come through as replacement characters which we leave as-is.
        lines = [ln.strip() for ln in text.split('\n')]

        # ── Phase 1: build raw transaction records ────────────────────────────
        # Each record: {"main": str, "nota_parts": list[str]}
        records: list[dict] = []
        current: dict | None = None

        for ln in lines:
            if not ln:
                continue
            if _SKIP_RE.match(ln):
                continue

            if ln.lower().startswith('nota:'):
                # Nota sub-line for the current transaction
                nota_text = ln[5:].strip()  # strip "Nota:"
                if current is not None:
                    current['nota_parts'].append(nota_text)
                continue

            if _TX_LINE_RE.match(ln):
                # New transaction line
                if current is not None:
                    records.append(current)
                current = {'main': ln, 'nota_parts': []}
            else:
                # Continuation line — could be overflow of description or nota
                if current is not None:
                    # If we already have nota parts, this is a nota continuation
                    if current['nota_parts']:
                        current['nota_parts'].append(ln)
                    else:
                        # It's a continuation of the main description
                        current['main'] += ' ' + ln

        if current is not None:
            records.append(current)

        # ── Phase 2: parse each record into a transaction dict ────────────────
        rows: list[dict] = []

        for rec in records:
            main = rec['main']

            # Extract date
            dm = _DATE_RE.match(main)
            if not dm:
                logger.debug("BancoEconomico: no date match on: %s", main[:60])
                continue

            tx_date = _parse_date(dm.group(1), dm.group(2), dm.group(3))
            if tx_date is None:
                continue

            # Extract all numeric amounts from the line
            # The MONTO is the second-to-last numeric value; SALDO is the last.
            # (Column order: ... DESCRIPCIÓN | MONTO | SALDO)
            amounts = _AMOUNT_RE.findall(main)
            if len(amounts) < 2:
                logger.debug("BancoEconomico: <2 amounts on: %s", main[:60])
                continue

            # MONTO is the second-to-last, SALDO is last
            monto_str = amounts[-2]
            try:
                monto = float(monto_str.replace(',', ''))
            except ValueError:
                logger.warning("BancoEconomico: unparseable amount %r", monto_str)
                continue

            if monto == 0:
                continue

            # Build description
            # Strip date + time prefix from main line to get the description text
            # Format: "DD/Mon/YYYY HH:MM  NRO_TRN  DESCRIPCIÓN  MONTO  SALDO"
            # We want just DESCRIPCIÓN — everything after NRO_TRN up to the amounts.
            after_date = main[dm.end():].strip()
            # Remove time (HH:MM or HH:MM:SS)
            after_date = re.sub(r'^\d{2}:\d{2}(?::\d{2})?\s*', '', after_date)
            # Remove transaction number (long digit string)
            after_date = re.sub(r'^\d{6,}\s*', '', after_date)
            # Remove trailing amounts (MONTO + SALDO) — use regex to avoid
            # substring collisions (e.g. '20.00' appears inside '520.00')
            after_date = re.sub(r'(\s+-?\d[\d,]*\.\d{2}){2}\s*$', '', after_date).strip()
            desc_main = after_date.strip() or 'Imported'

            # Merge nota
            if rec['nota_parts']:
                nota_text = ' '.join(rec['nota_parts']).strip()
                raw_desc = f"{desc_main} | Nota: {nota_text}"
            else:
                raw_desc = desc_main

            tx_type = 'expense' if monto < 0 else 'income'
            amount = abs(monto)

            rows.append({
                'date': tx_date,
                'description': raw_desc,
                'amount': round(amount, 2),
                'type': tx_type,
                'currency': 'BOB',
                'raw_description': raw_desc,
                'category_hint': _category_hint(raw_desc),
            })

        return rows
