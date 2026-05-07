"""
<BankName> parser
==================
Parses PDF bank statements from <BankName>.

Detection: looks for "<UNIQUE_STRING_FROM_PDF>" in the text.
Format:    <describe the statement layout, e.g. "one transaction per line, columns: date | description | debit | credit | balance">
Currency:  BOB (change to USD if this is a USD account parser)
"""
from __future__ import annotations
import re
from .base import BankParser


class <BankName>Parser(BankParser):
    bank_name = "<BankName>"

    # ------------------------------------------------------------------ #
    # Detection                                                            #
    # ------------------------------------------------------------------ #

    def can_parse(self, text: str) -> bool:
        """Return True if this PDF belongs to <BankName>."""
        # Use the most unique string you can find in the PDF header/footer.
        # Avoid generic words — the more specific, the fewer false positives.
        return "<UNIQUE_IDENTIFIER_STRING>" in text

    # ------------------------------------------------------------------ #
    # Parsing                                                              #
    # ------------------------------------------------------------------ #

    def parse(self, text: str) -> list[dict]:
        """
        Extract transactions from the PDF text.

        Transaction dict shape (must match this exactly):
            {
                "date":             "YYYY-MM-DD",
                "description":      str,    # cleaned, human-readable
                "amount":           float,  # always positive
                "type":             "expense" | "income",
                "currency":         "BOB",  # or "USD"
                "raw_description":  str,    # original text before cleaning
                "category_hint":    str | None,
            }
        """
        transactions: list[dict] = []

        # ---------- Example: one transaction per line --------------------
        # Adjust the regex to match this bank's actual line format.
        # Common patterns:
        #   "DD/MM/YYYY  Description text          1,234.56   5,678.90"
        #   "MM-DD-YYYY  Description               -1234.56"
        #
        # LINE_RE = re.compile(
        #     r"(\d{2}/\d{2}/\d{4})"   # date group 1
        #     r"\s+"
        #     r"(.+?)"                   # description group 2 (non-greedy)
        #     r"\s+"
        #     r"([\d,]+\.?\d*)"         # amount group 3
        #     r"(?:\s+([\d,]+\.?\d*))?" # optional balance group 4
        # )
        #
        # for line in text.splitlines():
        #     m = LINE_RE.search(line)
        #     if not m:
        #         continue
        #
        #     raw_date, raw_desc, raw_amount, _balance = m.groups()
        #     amount = float(raw_amount.replace(",", ""))
        #     date_obj = _parse_date(raw_date)   # see helper below
        #     desc = raw_desc.strip()
        #
        #     # Heuristic: debit/credit detection
        #     # Option A: separate debit/credit columns (check which column has the value)
        #     # Option B: look for a sign or keyword (DEBITO/CREDITO/CARGO/ABONO)
        #     tx_type = "expense"  # change logic here
        #
        #     transactions.append({
        #         "date":            date_obj,
        #         "description":     _clean(desc),
        #         "amount":          amount,
        #         "type":            tx_type,
        #         "currency":        "BOB",
        #         "raw_description": desc,
        #         "category_hint":   None,
        #     })

        return transactions


# ------------------------------------------------------------------ #
# Helpers (private to this module)                                    #
# ------------------------------------------------------------------ #

def _parse_date(raw: str) -> str:
    """Convert bank date string to YYYY-MM-DD."""
    # Adjust format string to match this bank's date format.
    # Common formats: "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%d"
    from datetime import datetime
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date format: {raw!r}")


def _clean(description: str) -> str:
    """Remove noise from transaction descriptions."""
    # Remove excess whitespace
    desc = re.sub(r"\s+", " ", description).strip()
    # Add bank-specific cleanup rules here, e.g.:
    # desc = desc.replace("CARGO POR ", "")
    return desc
