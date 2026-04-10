"""
makrobanx.py
============
Parser for MakroBanx (Bolivia) BOB account statements.

Extraction method: pdfplumber extract_text()
MakroBanx statements have a two-line-per-transaction structure:
  Line N:   Description text (may span multiple lines for long merchant names)
  Line N+1: Data line starting with YYYY/MM/DD HH:MM followed by numeric
            columns for TRANSACCION, SUC, COD.DEP., NUM, COD.BCA.,
            DEBITOS, CREDITOS, SALDO

CHALLENGE 1 — description on separate line from data:
  After splitting text into lines we identify "data lines" by the regex
  r'^\\d{4}/\\d{2}/\\d{2}\\s+\\d{2}:\\d{2}'. Everything between two consecutive
  data lines (excluding headers and skip patterns) is the description for
  the FOLLOWING data line.

CHALLENGE 2 — DEBITOS / CREDITOS are separate unsigned columns:
  We parse the last 3 numeric tokens on the data line as:
    DEBITOS  CREDITOS  SALDO
  If DEBITOS > 0  -> expense (amount = DEBITOS)
  If CREDITOS > 0 -> income  (amount = CREDITOS)
  Both zero       -> skip row
"""
from __future__ import annotations
import re
import logging
from datetime import datetime

from .base import BankParser

logger = logging.getLogger(__name__)

# A data line starts with YYYY/MM/DD HH:MM
_DATA_LINE_RE = re.compile(r'^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}')

# Numeric value: digits, optional thousands-commas, mandatory decimal point
_NUM_RE = re.compile(r'\d[\d,]*\.\d{2}')

# Lines to skip entirely (headers, summaries, balance labels)
_SKIP_RE = re.compile(
    r'^(FECHA|HORA|TRANSACCION|SUC|COD\.DEP|NUM|COD\.BCA|DEBITOS|CREDITOS|SALDO'
    r'|SALDO\s+INICIAL|SALDO\s+ANTERIOR|TOTAL\s+DEBITOS|TOTAL\s+CREDITOS'
    r'|P[AÁ]GINA|MAKROBANX|Extracto|EXTRACTO|PERIODO|CUENTA|TITULAR)',
    re.IGNORECASE,
)


def _parse_amount(token: str) -> float:
    return float(token.replace(',', ''))


class MakroBanxParser(BankParser):
    bank_name = "MakroBanx"

    def can_parse(self, text: str) -> bool:
        return bool(re.search(r'makrobanx', text, re.IGNORECASE))

    def parse(self, text: str) -> list[dict]:
        lines = [ln.strip() for ln in text.split('\n')]

        # ── Phase 1: classify each line ──────────────────────────────────────
        # A line is either a "data line" (starts with date+time) or a
        # "description line" (everything else that isn't blank or a skip).
        classified: list[tuple[str, str]] = []  # ("data"|"desc"|"skip", line)
        for ln in lines:
            if not ln:
                continue
            if _DATA_LINE_RE.match(ln):
                classified.append(('data', ln))
            elif _SKIP_RE.match(ln):
                classified.append(('skip', ln))
            else:
                classified.append(('desc', ln))

        # ── Phase 2: pair descriptions with data lines ────────────────────────
        # Walk forward; accumulate desc lines; flush when we hit a data line.
        rows: list[dict] = []
        pending_desc_lines: list[str] = []

        for kind, ln in classified:
            if kind == 'desc':
                pending_desc_lines.append(ln)
            elif kind == 'data':
                raw_desc = ' '.join(pending_desc_lines).strip() or 'Imported'
                pending_desc_lines = []  # reset for next transaction

                # Parse the data line
                # Find all numeric tokens (DEBITOS, CREDITOS, SALDO are last 3)
                nums = _NUM_RE.findall(ln)
                if len(nums) < 3:
                    logger.debug("MakroBanx: skipping row with <3 numeric tokens: %s", ln)
                    continue

                debitos_str, creditos_str = nums[-3], nums[-2]
                debitos = _parse_amount(debitos_str)
                creditos = _parse_amount(creditos_str)

                if debitos == 0 and creditos == 0:
                    continue

                # Date: first 10 chars are YYYY/MM/DD
                date_str = ln[:10]
                try:
                    tx_date = datetime.strptime(date_str, '%Y/%m/%d').strftime('%Y-%m-%d')
                except ValueError:
                    logger.warning("MakroBanx: unparseable date %s", date_str)
                    continue

                if debitos > 0:
                    tx_type = 'expense'
                    amount = debitos
                else:
                    tx_type = 'income'
                    amount = creditos

                rows.append({
                    'date': tx_date,
                    'description': raw_desc,
                    'amount': round(amount, 2),
                    'type': tx_type,
                    'currency': 'BOB',
                    'raw_description': raw_desc,
                    'category_hint': None,
                })
            # skip lines: discard, do NOT accumulate into description

        return rows
