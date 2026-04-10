"""
banco_ganadero.py
=================
Parser for Banco Ganadero (Bolivia) PDF statements.

Extraction method: pdfplumber extract_text()
Banco Ganadero statements have a clean line-per-transaction layout where
each transaction starts with DD/MM/YYYY HH:MM:SS followed by channel,
transaction number, debit/credit amounts, and a description that may
continue on subsequent lines.
"""
from __future__ import annotations
import re
from datetime import datetime

from .base import BankParser


def _clean_bg_desc(raw: str) -> str:
    """Turn a raw Banco Ganadero description into a short readable label."""
    EMPTY_REFS = {'sin referencia', 'sin datos', 'sin ref'}

    # POS card purchase: "POS MERCHANT NAME Tarj: XXXX BO"
    if raw.upper().startswith('POS '):
        s = raw[4:]
        s = re.sub(r'\s+Tarj:\s+\d+\s+BO\s*$', '', s, flags=re.IGNORECASE).strip()
        return s.title()

    # ACH / QR transfer
    m_transf = re.match(r'^TRANSF\.\s+(?:QR\s+)?ACH\s+Nro\.\s+\d+\s+(.*)', raw, re.IGNORECASE)
    if m_transf:
        rest = m_transf.group(1)
        m_acct = re.search(r'\d{8,}', rest)
        if m_acct:
            after = rest[m_acct.end():].strip()
            after = re.sub(r'\s+(?:sin referencia|sin datos|sin ref)\s*$', '', after, flags=re.IGNORECASE).strip()
            if after:
                return after
        return rest.strip() or raw

    # "Transferencia de ACCOUNT. NAME [MEMO]"
    m_from = re.match(r'^Transferencia\s+de\s+\d+\.\s+(.*)', raw, re.IGNORECASE)
    if m_from:
        s = m_from.group(1).strip()
        s = re.sub(r'\s+Sin\s+referencia\s*$', '', s, flags=re.IGNORECASE).strip()
        return s or raw

    # "Transferencia a ACCOUNT. NAME [MEMO]"
    m_to = re.match(r'^Transferencia\s+a\s+\d+\.\s+(.*)', raw, re.IGNORECASE)
    if m_to:
        s = m_to.group(1).strip()
        s = re.sub(r'\s+Sin\s+referencia\s*$', '', s, flags=re.IGNORECASE).strip()
        return ('→ ' + s) if s else raw

    # "Trans a ACCOUNT. NAME [MEMO]"
    m_trans = re.match(r'^Trans\s+a\s+\d+\.\s+(.*)', raw, re.IGNORECASE)
    if m_trans:
        s = m_trans.group(1).strip()
        s = re.sub(r'\s+Sin\s+referencia\s*$', '', s, flags=re.IGNORECASE).strip()
        return ('→ ' + s) if s else raw

    return raw


class BancoGanaderoParser(BankParser):
    bank_name = "Banco Ganadero"

    def can_parse(self, text: str) -> bool:
        return bool(re.search(r'banco\s+ganadero', text, re.IGNORECASE))

    def parse(self, text: str) -> list[dict]:
        all_lines = text.split('\n')

        date_line_re = re.compile(r'^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}\s+')
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

        amount_re = re.compile(r'(-[\d,]+\.\d{2})\s+(\+[\d,]+\.\d{2})\s+([\d,]+\.\d{2})')

        rows: list[dict] = []
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

            before = block[:m.start()].strip()
            before = re.sub(r'^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}\s+', '', before)
            before = re.sub(r'^.*?\d{6,}\s+', '', before, count=1)
            after = block[m.end():].strip()
            raw_desc = re.sub(r'\s+', ' ', (before + ' ' + after)).strip() or 'Imported'
            desc = _clean_bg_desc(raw_desc)

            tx_type = 'expense' if debit > 0 else 'income'
            amount = debit if debit > 0 else credit

            rows.append({
                'date': tx_date,
                'description': desc,
                'amount': round(amount, 2),
                'type': tx_type,
                'currency': 'BOB',
                'raw_description': raw_desc,
                'category_hint': None,
            })

        return rows
