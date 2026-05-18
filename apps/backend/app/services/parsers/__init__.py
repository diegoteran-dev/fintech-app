"""
parsers/__init__.py
===================
Central registry for all bank statement parsers.

Detection order matters — more specific signatures come first:
  1. MakroBanxParser      — "MAKROBANX" (very unique string, no false positives)
  2. BCPParser             — "Extracto de Cuenta por Mes" (BCP-specific header)
  3. BancoEconomicoParser  — "baneco.com.bo" or "BANCO ECONOMICO" / "Banco Económico"
  4. BNBParser             — "bnb.com.bo" or "Banco Nacional de Bolivia" or "BNB NET"
  5. BancoGanaderoParser   — "Banco Ganadero" (most common, checked last)

Adding a new bank in the future:
  1. Create apps/backend/app/services/parsers/<bankname>.py
  2. Implement BankParser.can_parse() and BankParser.parse()
  3. Import and insert into PARSER_REGISTRY below
  Nothing else needs to change.
"""
from .makrobanx import MakroBanxParser
from .bcp import BCPParser
from .banco_economico import BancoEconomicoParser
from .bnb import BNBParser
from .banco_ganadero import BancoGanaderoParser

PARSER_REGISTRY = [
    MakroBanxParser(),
    BCPParser(),
    BancoEconomicoParser(),
    BNBParser(),
    BancoGanaderoParser(),
]


def detect_and_parse(text: str) -> tuple[str, list[dict]]:
    """
    Detect which bank the PDF belongs to and parse its transactions.

    Returns:
        (bank_name, list_of_transaction_dicts)

    Raises:
        ValueError: if no registered parser recognises the PDF.
    """
    for parser in PARSER_REGISTRY:
        if parser.can_parse(text):
            return (parser.bank_name, parser.parse(text))

    raise ValueError(
        "Formato de extracto no reconocido. "
        "Bancos soportados: Banco Ganadero, MakroBanx, Banco Económico, BNB, BCP."
    )


__all__ = [
    "PARSER_REGISTRY",
    "detect_and_parse",
    "MakroBanxParser",
    "BCPParser",
    "BancoEconomicoParser",
    "BNBParser",
    "BancoGanaderoParser",
]
