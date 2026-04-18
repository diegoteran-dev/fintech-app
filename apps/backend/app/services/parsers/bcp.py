"""
bcp.py
======
Parser for Banco de Crédito de Bolivia (BCP) BOB account statements.

Detection string: "Extracto de Cuenta por Mes" (unique to BCP headers)

Statement format
----------------
Header (repeated per page):
    Extracto de Cuenta por Mes
    Nro. Cuenta: XXX  Periodo: Mes YYYY
    Cliente: ...  Moneda: Bolivianos
    Saldo Inicial: X.XX  Saldo Final: X.XX
    Fecha Consulta ...  Tipo Cuenta: ...
    Fecha  Hora  Descripción  Medio de Atención  Lugar  Monto  Saldo

Transaction rows:
    DD/MM/YYYY HH:MM:SS  <description ...> <lugar>  MONTO  SALDO
    [optional continuation lines with more description text]

CHALLENGE 1 — signed Monto column:
    Negative Monto  → expense (debit).   e.g. -297.00
    Positive Monto  → income (credit).   e.g. 1,300.00

CHALLENGE 2 — continuation lines follow the data line:
    The data line holds a partial description; subsequent non-date lines
    before the next data line belong to the same transaction.

CHALLENGE 3 — page headers interleaved with transactions:
    "Página N de M" and the column-header row appear at every page break.
    These are detected and discarded by _SKIP_RE.
"""
from __future__ import annotations
import re
import logging
from datetime import datetime

from .base import BankParser

logger = logging.getLogger(__name__)

# Data line starts with DD/MM/YYYY HH:MM:SS
_DATA_LINE_RE = re.compile(r'^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}')

# Signed numeric token — last two on a data line are Monto and Saldo
_NUM_RE = re.compile(r'-?\d[\d,]*\.\d{2}')

# Lines to discard (headers, page labels, column titles)
_SKIP_RE = re.compile(
    r'^(Extracto\s+de\s+Cuenta|Nro\.\s+Cuenta|Cliente:|Saldo\s+(Inicial|Final)|'
    r'Fecha\s+Consulta|Fecha\s+Hora|P[aá]gina\s+\d+\s+de\s+\d+)',
    re.IGNORECASE,
)


def _parse_amount(token: str) -> float:
    return float(token.replace(',', ''))


class BCPParser(BankParser):
    bank_name = "Banco de Crédito de Bolivia (BCP)"

    def can_parse(self, text: str) -> bool:
        return bool(re.search(r'Extracto\s+de\s+Cuenta\s+por\s+Mes', text, re.IGNORECASE))

    def parse(self, text: str) -> list[dict]:
        lines = [ln.strip() for ln in text.split('\n')]

        # ── Phase 1: group lines into (data_line, [continuation_lines]) ──────
        groups: list[tuple[str, list[str]]] = []
        current_data: str | None = None
        current_cont: list[str] = []

        for ln in lines:
            if not ln:
                continue
            if _SKIP_RE.match(ln):
                continue
            if _DATA_LINE_RE.match(ln):
                if current_data is not None:
                    groups.append((current_data, current_cont))
                current_data = ln
                current_cont = []
            else:
                if current_data is not None:
                    current_cont.append(ln)
                # lines before first data line are header noise — ignore

        if current_data is not None:
            groups.append((current_data, current_cont))

        # ── Phase 2: parse each group into a transaction dict ─────────────────
        rows: list[dict] = []
        for data_line, continuation in groups:
            # Date: first 10 chars  DD/MM/YYYY
            date_str = data_line[:10]
            try:
                tx_date = datetime.strptime(date_str, '%d/%m/%Y').strftime('%Y-%m-%d')
            except ValueError:
                logger.warning("BCP: unparseable date %s", date_str)
                continue

            # Find all signed numeric tokens; last two are Monto and Saldo
            nums = _NUM_RE.findall(data_line)
            if len(nums) < 2:
                logger.debug("BCP: skipping row with <2 numeric tokens: %s", data_line)
                continue

            monto_str = nums[-2]
            try:
                monto = _parse_amount(monto_str)
            except ValueError:
                continue

            if monto == 0:
                continue

            # Description: text from after HH:MM:SS to before the Monto token
            # data_line[:19] = "DD/MM/YYYY HH:MM:SS", position 20 onwards is content
            after_dt = data_line[20:].strip()
            monto_pos = after_dt.rfind(monto_str)
            desc_on_data_line = after_dt[:monto_pos].strip() if monto_pos > 0 else after_dt

            # Combine with continuation lines for full raw description
            all_parts = [desc_on_data_line] + continuation
            raw_desc = ' '.join(p for p in all_parts if p).strip() or 'Imported'

            tx_type = 'expense' if monto < 0 else 'income'
            amount = abs(monto)

            rows.append({
                'date': tx_date,
                'description': raw_desc,
                'amount': round(amount, 2),
                'type': tx_type,
                'currency': 'BOB',
                'raw_description': raw_desc,
                'category_hint': None,
            })

        return rows
