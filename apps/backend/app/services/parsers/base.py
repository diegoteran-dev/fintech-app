"""
base.py
=======
Abstract base class for all bank statement parsers.

Each parser is responsible for:
  1. Detecting whether a given PDF text belongs to its bank (can_parse)
  2. Extracting a list of transaction dicts from that text (parse)

Transaction dict shape:
  {
    "date":             "YYYY-MM-DD",
    "description":      str,           # cleaned, human-readable
    "amount":           float,         # always positive
    "type":             "expense" | "income",
    "currency":         "BOB" | "USD" | ...,
    "raw_description":  str,           # original text before cleaning
    "category_hint":    str | None,    # optional hint for categorizer
  }
"""
from __future__ import annotations
from abc import ABC, abstractmethod


class BankParser(ABC):
    # Human-readable bank name returned to the frontend
    bank_name: str = "Unknown Bank"

    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """Return True if this parser recognises the bank from the PDF text."""
        ...

    @abstractmethod
    def parse(self, text: str) -> list[dict]:
        """
        Extract transactions from the full PDF text.
        Returns a list of transaction dicts (see module docstring).
        """
        ...
