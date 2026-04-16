"""
bnb.py
======
Parser for Banco Nacional de Bolivia (BNB) PDF account statements.

Extraction method: pdfplumber extract_text() (text already concatenated by caller)

Actual BNB PDF structure (empirically derived from real statements):

  Page 1: Summary page (Resumen de cuenta) — skip all transactions here
  Page 5+: "Esta página se dejó en blanco" — skip

  DEPÓSITOS section:
    Each transaction block:
      Line 0:    TX-TYPE line  (e.g. "ABONO EN CUENTA POR TRANS. INTERBANC. - BNB NET")
      Line 1:    DD/MM/YYYY HH:MMAccount details... COMPROBANTE AMOUNT
      Line 2..N: Continuation (banco name spill-over, "Dato Adicional", etc.)

  RETIROS section — four structural variants:
    Pattern A (ATM/POS):
      DD/MM/YYYY  DEBITO POR COMPRA ATM/POS
      REF  COMPROBANTE  AMOUNT
      HH:MM  Lugar: MERCHANT NAME

    Pattern B (MOVIL):
      DD/MM/YYYY  DEBITO POR PAGO MOVIL BNB
      Cuenta: XX  COMPROBANTE  AMOUNT
      HH:MM  Nombre: PERSON | Banco: BANK

    Pattern C (INTERBANC outgoing):
      DEBITO POR TRANS. INTERBANC.
      DD/MM/YYYY
      Account details  COMPROBANTE  AMOUNT
      HH:MM  [extra lines]

    Pattern D (standalone date):
      DD/MM/YYYY
      DESCRIPTION  COMPROBANTE  AMOUNT
      HH:MM

Block splitting strategy:
  - A new transaction starts when a line matches _TX_START_RE AND the current
    accumulator already contains an amount/comprobante line. If the accumulator
    has no amount line yet, the matching line is appended (handles Pattern C where
    the date line comes after the initial keyword line).
  - Section header changes ("Depósitos" / "Retiros") always flush and reset.
  - "Total depósitos" / "Total retiros" always flush and close the section.

Amount/comprobante anchor:
  - The comprobante code matches [0-9]+[A-Z]+[0-9]+ (e.g. "2P26195078").
  - The amount line = the first line in the block that contains a comprobante AND
    ends with a decimal number (e.g. 1,234.56).
  - Fallback (no comprobante): last line that ends with a decimal.
"""
from __future__ import annotations
import re
import logging
from datetime import datetime

from .base import BankParser

logger = logging.getLogger(__name__)

# ── Patterns ──────────────────────────────────────────────────────────────────

# Date anywhere in a string: DD/MM/YYYY
_DATE_RE = re.compile(r'\b(\d{2}/\d{2}/\d{4})\b')

# Rightmost decimal amount at end of line (the transaction amount)
_AMOUNT_END_RE = re.compile(r'(\d{1,3}(?:,\d{3})*\.\d{2})\s*$')

# Comprobante code: digit-letter(s)-digit sequences like 2P26195078
_COMP_RE = re.compile(r'\b(\d+[A-Z]+\d+)\b')

# Column/section header words — skip these lines entirely
_HEADER_WORDS = frozenset({
    'Fecha', 'Hora', 'Descripción', 'Descripcion',
    'Referencia', 'Comprobante', 'ITF', 'Créditos', 'Creditos',
    'Débitos', 'Debitos', 'N°', 'No.',
})

# Lines that signal the start of a new transaction block
_TX_START_RE = re.compile(
    r'^\d{2}/\d{2}/\d{4}'                          # date at line start
    r'|^(?:ABONO|CR[ÉE]DITO|DEP[ÓO]SITO'
    r'|D[ÉE]BITO|DEB\.'
    r'|RETIRO|PAGO\s+DE|RETENCI[ÓO]N|CARGO'
    r'|COMISI[ÓO]N)',
    re.IGNORECASE,
)

# Section boundary detectors
_SEC_DEPOSITS_RE = re.compile(r'dep[oó]sitos', re.IGNORECASE)
_SEC_WITHDRAWALS_RE = re.compile(r'\bretiros\b', re.IGNORECASE)
_SEC_TOTAL_RE = re.compile(r'total\s+(?:dep[oó]sitos|retiros)', re.IGNORECASE)

# Blank-page marker
_BLANK_PAGE_RE = re.compile(r'dej[oó]\s+en\s+blanco', re.IGNORECASE)

# Category hints applied against the combined block text
_CATEGORY_HINTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r'compra|atm.?pos|pos\b',           re.IGNORECASE), 'Shopping'),
    (re.compile(r'retiro\s+efectivo|retiro\s+atm',  re.IGNORECASE), 'Other'),
    (re.compile(r'interbanc',                        re.IGNORECASE), 'Other'),
    (re.compile(r'\bmovil\b',                        re.IGNORECASE), 'Other'),
    (re.compile(r'interes',                          re.IGNORECASE), 'Investment Returns'),
    (re.compile(r'\biva\b|\bretenci[oó]n\b',         re.IGNORECASE), 'Utilities'),
    (re.compile(r'\bseg\b',                          re.IGNORECASE), 'Insurance'),
    (re.compile(r'transferencia',                    re.IGNORECASE), 'Other'),
    (re.compile(r'debito\s+automatico',              re.IGNORECASE), 'Other'),
]


def _category_hint(text: str) -> str:
    for pattern, hint in _CATEGORY_HINTS:
        if pattern.search(text):
            return hint
    return 'Other'


def _parse_date(date_str: str) -> str | None:
    try:
        return datetime.strptime(date_str, '%d/%m/%Y').strftime('%Y-%m-%d')
    except ValueError:
        logger.warning("BNB: unparseable date %r", date_str)
        return None


def _has_amount_line(block: list[str]) -> bool:
    """Return True if any line in the block looks like an amount anchor."""
    for line in block:
        s = line.strip()
        if _COMP_RE.search(s) and _AMOUNT_END_RE.search(s):
            return True
    # Fallback: any line ends with a decimal
    for line in block:
        if _AMOUNT_END_RE.search(line.strip()):
            return True
    return False


def _find_amount_line(block: list[str]) -> tuple[str | None, str | None]:
    """
    Locate the amount anchor line in the block.
    Returns (amount_line, comprobante_or_None).
    Prefers lines with a comprobante code.
    """
    for line in block:
        s = line.strip()
        m_comp = _COMP_RE.findall(s)
        m_amt = _AMOUNT_END_RE.search(s)
        if m_comp and m_amt:
            return s, m_comp[-1]

    # Fallback: last line that ends with a decimal
    for line in reversed(block):
        s = line.strip()
        if _AMOUNT_END_RE.search(s):
            return s, None

    return None, None


def _extract_tx_type(block: list[str]) -> str:
    """Extract the human-readable transaction type label from the block."""
    kw_re = re.compile(
        r'(ABONO\b.*|CR[ÉE]DITO\b.*|DEP[ÓO]SITO\b.*'
        r'|D[ÉE]BITO\b.*|DEB\.\s*.*'
        r'|RETIRO\b.*|PAGO\s+DE\s+\S+.*|RETENCI[ÓO]N\b.*|CARGO\b.*)',
        re.IGNORECASE,
    )
    for line in block:
        # Strip leading date and time tokens before searching for keywords
        cleaned = re.sub(r'^\d{2}/\d{2}/\d{4}\s*', '', line.strip())
        cleaned = re.sub(r'^\d{2}:\d{2}\s*', '', cleaned)
        m = kw_re.match(cleaned)
        if m:
            result = m.group(1)
            # Remove comprobante code and trailing amount from type label
            result = _COMP_RE.sub('', result).strip()
            result = _AMOUNT_END_RE.sub('', result).strip()
            result = result.rstrip('.').strip()
            if result:
                return result
    return 'Imported'


def _extract_named_field(full_text: str, key: str) -> str | None:
    """
    Extract value after "KEY:" in the joined block text.
    Stops at the next KEY-like token, comprobante, or line end.
    """
    pattern = re.compile(
        key + r'\s*:\s*(.+?)(?=\s*(?:\w[\w\s]*:|\b\d+[A-Z]+\d+\b|\d{1,3}(?:,\d{3})*\.\d{2}$|$))',
        re.IGNORECASE | re.DOTALL,
    )
    m = pattern.search(full_text)
    if m:
        val = m.group(1).strip().rstrip('.')
        # Clean up account numbers that bleed into names
        val = re.sub(r'\s+\d{6,}\s*', ' ', val).strip()
        return val if val else None
    return None


def _build_description(tx_type: str, lugar: str | None, nombre: str | None) -> str:
    if lugar:
        return f"{tx_type} | Lugar: {lugar}"
    if nombre:
        return f"{tx_type} | Nombre: {nombre}"
    return tx_type


def _flush_block(block: list[str], section: str) -> dict | None:
    """Convert a collected block of lines into a transaction dict."""
    if not block:
        return None

    full_text = ' '.join(line.strip() for line in block)

    # Extract date from anywhere in the block
    date_match = _DATE_RE.search(full_text)
    if not date_match:
        logger.debug("BNB: block has no date — skipping: %r", full_text[:80])
        return None
    tx_date = _parse_date(date_match.group(1))
    if tx_date is None:
        return None

    # Find amount and comprobante
    amount_line, comprobante = _find_amount_line(block)
    if amount_line is None:
        logger.debug("BNB: block has no amount line — skipping: %r", full_text[:80])
        return None

    amount_match = _AMOUNT_END_RE.search(amount_line)
    if not amount_match:
        return None
    amount_str = amount_match.group(1)
    amount = float(amount_str.replace(',', ''))

    # Extract description fields
    tx_type = _extract_tx_type(block)
    lugar = _extract_named_field(full_text, r'Lugar')
    nombre = (
        _extract_named_field(full_text, r'Nombre\s+Originante')
        or _extract_named_field(full_text, r'Nombre')
    )
    description = _build_description(tx_type, lugar, nombre)

    sign = 1.0 if section == 'deposits' else -1.0
    tx_type_label = 'income' if section == 'deposits' else 'expense'

    raw_desc = (
        f"{description} comprobante:{comprobante}"
        if comprobante
        else f"{description} | ref:{amount_line[-50:]}"
    )

    return {
        'date': tx_date,
        'description': description,
        'amount': round(abs(sign * amount), 2),
        'type': tx_type_label,
        'currency': 'BOB',
        'raw_description': raw_desc,
        'category_hint': _category_hint(full_text),
        'comprobante': comprobante,
    }


class BNBParser(BankParser):
    bank_name = "Banco Nacional de Bolivia (BNB)"

    def can_parse(self, text: str) -> bool:
        return bool(re.search(
            r'bnb\.com\.bo|banco\s+nacional\s+de\s+bolivia|bnb\s+net',
            text, re.IGNORECASE,
        ))

    def parse(self, text: str) -> list[dict]:
        lines = text.split('\n')

        rows: list[dict] = []
        current_section: str | None = None
        block: list[str] = []

        for raw_line in lines:
            line = raw_line.strip()

            if not line:
                continue

            # Skip blank-page marker
            if _BLANK_PAGE_RE.search(line):
                continue

            # Skip column headers
            if any(word in line for word in _HEADER_WORDS):
                continue

            line_lower = line.lower()

            # ── Section end ───────────────────────────────────────────────────
            if _SEC_TOTAL_RE.search(line_lower):
                if block and current_section:
                    result = _flush_block(block, current_section)
                    if result:
                        rows.append(result)
                block = []
                current_section = None
                continue

            # ── Section start ─────────────────────────────────────────────────
            if _SEC_DEPOSITS_RE.search(line_lower) and not _SEC_TOTAL_RE.search(line_lower):
                if block and current_section:
                    result = _flush_block(block, current_section)
                    if result:
                        rows.append(result)
                block = []
                current_section = 'deposits'
                continue

            if _SEC_WITHDRAWALS_RE.search(line_lower) and not _SEC_TOTAL_RE.search(line_lower):
                if block and current_section:
                    result = _flush_block(block, current_section)
                    if result:
                        rows.append(result)
                block = []
                current_section = 'withdrawals'
                continue

            # Outside any transaction section — skip
            if current_section is None:
                continue

            # ── Transaction block splitting ───────────────────────────────────
            if _TX_START_RE.match(line):
                # Only start a new block if the current one is already "complete"
                # (i.e. it already has an amount/comprobante line).
                # Otherwise, this date/keyword line belongs to the current block
                # (handles Pattern C deposits and multi-date withdrawal variants).
                if block and _has_amount_line(block):
                    result = _flush_block(block, current_section)
                    if result:
                        rows.append(result)
                    block = [line]
                else:
                    block.append(line)
            else:
                # Continuation line
                if block:
                    block.append(line)
                # Lines before the very first transaction start are ignored

        # Flush the final block
        if block and current_section:
            result = _flush_block(block, current_section)
            if result:
                rows.append(result)

        logger.info(
            "BNB: parsed %d transactions (%d deposits, %d withdrawals)",
            len(rows),
            sum(1 for r in rows if r['type'] == 'income'),
            sum(1 for r in rows if r['type'] == 'expense'),
        )
        return rows
