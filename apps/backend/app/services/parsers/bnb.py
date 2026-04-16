"""
bnb.py
======
Parser for Banco Nacional de Bolivia (BNB) PDF account statements.

Extraction method: pdfplumber extract_text() (text already concatenated by caller)

BNB statement structure:
  - Page 1 is a summary page — contains "Depósitos" / "Retiros" totals but no
    individual transactions. The actual transaction lines start on page 2.
  - A section header line containing "Depósitos" (or "Depositos") introduces
    CREDIT rows (income, sign = +1).
  - A section header line containing "Retiros" introduces DEBIT rows
    (expense, sign = -1).
  - "Total depósitos" / "Total retiros" close their respective sections.
  - The last page may contain "Esta página se dejó en blanco" — skip.

Each transaction block spans multiple lines:
  Line 0 (trigger): DD/MM/YYYY  HH:MM — starts the block
  Lines 1..N-2:     description lines (transaction type, Lugar:, Nombre:, etc.)
  Line N-1 (last):  reference code  [comprobante code]  AMOUNT

Comprobante code format: matches r'\\d+[A-Z]\\d+' (e.g. "2P26195078",
"61539165492P32134059"). If found it is stored as "comprobante:CODE" in
raw_description for deduplication purposes.
"""
from __future__ import annotations
import re
import logging
from datetime import datetime

from .base import BankParser

logger = logging.getLogger(__name__)

# ── Patterns ──────────────────────────────────────────────────────────────────

# Transaction trigger: a line that starts with DD/MM/YYYY  HH:MM
_DATE_RE = re.compile(r'^(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2})')

# Rightmost decimal number on a line (the transaction amount)
_AMOUNT_RE = re.compile(r'(\d{1,3}(?:,\d{3})*\.\d{2})\s*$')

# Comprobante code: digit-letter-digit sequences like 2P26195078
_COMP_RE = re.compile(r'\b(\d+[A-Z]\d+)\b')

# Words that indicate a header row — skip these lines
_SKIP_WORDS = frozenset({
    'Fecha', 'Hora', 'Descripción', 'Descripcion', 'Referencia',
    'Comprobante', 'ITF', 'Créditos', 'Creditos', 'Débitos', 'Debitos',
})

# Category hint mapping (applied to the first description line / transaction type)
_CATEGORY_HINTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r'compra|atm/pos|pos\b',          re.IGNORECASE), 'Shopping'),
    (re.compile(r'retiro\s+efectivo|retiro\s+atm', re.IGNORECASE), 'Other'),
    (re.compile(r'interbanc',                      re.IGNORECASE), 'Other'),
    (re.compile(r'\bmovil\b',                      re.IGNORECASE), 'Other'),
    (re.compile(r'interes',                        re.IGNORECASE), 'Investment Returns'),
    (re.compile(r'\biva\b|\bretencion\b',          re.IGNORECASE), 'Utilities'),
    (re.compile(r'\bseg\b',                        re.IGNORECASE), 'Insurance'),
    (re.compile(r'transferencia',                  re.IGNORECASE), 'Other'),
    (re.compile(r'debito\s+automatico',            re.IGNORECASE), 'Other'),
]


def _category_hint(tx_type_line: str) -> str | None:
    for pattern, hint in _CATEGORY_HINTS:
        if pattern.search(tx_type_line):
            return hint
    return 'Other'


def _extract_comprobante(last_line: str, amount_str: str) -> str | None:
    """
    Find the comprobante code in the last line of a transaction block.
    The comprobante typically appears between the reference code and the amount.
    Returns the code string, or None if not found.
    """
    # Remove the trailing amount from consideration
    search_area = last_line[:last_line.rfind(amount_str)].strip()
    matches = _COMP_RE.findall(search_area)
    if matches:
        # Take the LAST match (closest to the amount = comprobante position)
        return matches[-1]
    return None


def _parse_date(date_str: str) -> str | None:
    """Convert DD/MM/YYYY to YYYY-MM-DD."""
    try:
        return datetime.strptime(date_str, '%d/%m/%Y').strftime('%Y-%m-%d')
    except ValueError:
        logger.warning("BNB: unparseable date %r", date_str)
        return None


def _build_description(desc_lines: list[str]) -> str:
    """
    Assemble a human-readable description from the collected description lines
    (everything between the date line and the last reference+amount line).

    Priority formats:
      "{tx_type} | Lugar: {merchant}"
      "{tx_type} | Nombre: {name} | Banco: {bank} | Dato Adicional: {note}"
      "{tx_type} | Nombre: {name}"
      "{tx_type}"
    """
    if not desc_lines:
        return 'Imported'

    tx_type = desc_lines[0].strip()
    rest = desc_lines[1:]

    lugar: str | None = None
    nombre: str | None = None
    banco: str | None = None
    dato: str | None = None

    for line in rest:
        stripped = line.strip()
        if re.match(r'^Lugar\s*:', stripped, re.IGNORECASE):
            lugar = re.sub(r'^Lugar\s*:\s*', '', stripped, flags=re.IGNORECASE).strip()
        elif re.match(r'^Nombre\s*:', stripped, re.IGNORECASE):
            nombre = re.sub(r'^Nombre\s*:\s*', '', stripped, flags=re.IGNORECASE).strip()
        elif re.match(r'^Banco\s*:', stripped, re.IGNORECASE):
            banco = re.sub(r'^Banco\s*:\s*', '', stripped, flags=re.IGNORECASE).strip()
        elif re.match(r'^Dato\s+Adicional\s*:', stripped, re.IGNORECASE):
            dato = re.sub(r'^Dato\s+Adicional\s*:\s*', '', stripped, flags=re.IGNORECASE).strip()

    if lugar:
        return f"{tx_type} | Lugar: {lugar}"

    if nombre:
        parts = [f"{tx_type} | Nombre: {nombre}"]
        if banco:
            parts.append(f"Banco: {banco}")
        if dato:
            parts.append(f"Dato Adicional: {dato}")
        return ' | '.join(parts)

    return tx_type


def _flush_block(
    block_lines: list[str],
    section: str,
) -> dict | None:
    """
    Convert a collected block of lines into a transaction dict.
    Returns None if the block cannot be parsed.
    """
    if len(block_lines) < 2:
        return None

    date_line = block_lines[0]
    date_match = _DATE_RE.match(date_line)
    if not date_match:
        return None

    tx_date = _parse_date(date_match.group(1))
    if tx_date is None:
        return None

    last_line = block_lines[-1].strip()
    amount_match = _AMOUNT_RE.search(last_line)
    if not amount_match:
        return None

    amount_str = amount_match.group(1)
    amount = float(amount_str.replace(',', ''))

    comprobante = _extract_comprobante(last_line, amount_str)

    # Description lines = everything between date line and last line
    desc_lines = [ln.strip() for ln in block_lines[1:-1] if ln.strip()]
    description = _build_description(desc_lines)

    sign = 1.0 if section == 'deposits' else -1.0
    tx_type = 'income' if section == 'deposits' else 'expense'
    final_amount = round(abs(sign * amount), 2)

    # category hint from first desc line (the transaction type label)
    hint = _category_hint(desc_lines[0].strip() if desc_lines else '')

    # raw_description: embed comprobante for dedup
    if comprobante:
        raw_desc = f"{description} comprobante:{comprobante}"
    else:
        raw_desc = f"{description} | ref: {last_line}"

    return {
        'date': tx_date,
        'description': description,
        'amount': final_amount,
        'type': tx_type,
        'currency': 'BOB',
        'raw_description': raw_desc,
        'category_hint': hint,
        'comprobante': comprobante,
    }


class BNBParser(BankParser):
    bank_name = "Banco Nacional de Bolivia (BNB)"

    def can_parse(self, text: str) -> bool:
        return bool(re.search(
            r'bnb\.com\.bo|banco\s+nacional\s+de\s+bolivia|bnb\s+net',
            text, re.IGNORECASE
        ))

    def parse(self, text: str) -> list[dict]:
        lines = [ln.strip() for ln in text.split('\n')]

        rows: list[dict] = []
        current_section: str | None = None  # "deposits" | "withdrawals" | None
        block_lines: list[str] = []

        for line in lines:
            if not line:
                continue

            # Blank page marker — ignore
            if 'dejó en blanco' in line or 'dejo en blanco' in line.lower():
                continue

            # Section transitions
            line_lower = line.lower()

            if re.search(r'total\s+dep[oó]sitos', line_lower):
                # Close deposits section — flush any pending block
                if block_lines and current_section:
                    result = _flush_block(block_lines, current_section)
                    if result:
                        rows.append(result)
                block_lines = []
                current_section = None
                continue

            if re.search(r'total\s+retiros', line_lower):
                # Close withdrawals section — flush any pending block
                if block_lines and current_section:
                    result = _flush_block(block_lines, current_section)
                    if result:
                        rows.append(result)
                block_lines = []
                current_section = None
                continue

            if re.search(r'dep[oó]sitos', line_lower) and not re.search(r'total', line_lower):
                # Enter deposits section — flush any pending block first
                if block_lines and current_section:
                    result = _flush_block(block_lines, current_section)
                    if result:
                        rows.append(result)
                block_lines = []
                current_section = 'deposits'
                continue

            if re.search(r'\bretiros\b', line_lower) and not re.search(r'total', line_lower):
                # Enter withdrawals section — flush any pending block first
                if block_lines and current_section:
                    result = _flush_block(block_lines, current_section)
                    if result:
                        rows.append(result)
                block_lines = []
                current_section = 'withdrawals'
                continue

            # Skip header rows
            if any(word in line for word in _SKIP_WORDS):
                continue

            # Skip lines when we're not in a section
            if current_section is None:
                continue

            # Check if this line starts a new transaction
            if _DATE_RE.match(line):
                # Flush the previous block before starting a new one
                if block_lines:
                    result = _flush_block(block_lines, current_section)
                    if result:
                        rows.append(result)
                block_lines = [line]
            else:
                # Continuation line for the current block
                if block_lines:
                    block_lines.append(line)

        # Flush the last block
        if block_lines and current_section:
            result = _flush_block(block_lines, current_section)
            if result:
                rows.append(result)

        return rows
