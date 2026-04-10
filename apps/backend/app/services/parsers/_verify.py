"""
_verify.py
==========
Inline parser verification — run directly, no pytest needed.
  cd apps/backend && python -m app.services.parsers._verify

Validates parser output against known-good example transactions.
Exits with code 1 on any mismatch.
"""
from __future__ import annotations
import sys


# ── MakroBanx synthetic test text ────────────────────────────────────────────
# Reconstructed from the spec: description line(s) ABOVE the data line.
MAKROBANX_TEXT = """
MAKROBANX Extracto de Cuenta Bs.
LUJAN ZAMBRANA EDUARDO ANDRE
FECHA DESDE: 2026/03/01    FECHA HASTA: 2026/03/31

SALDO INICIAL

CREDITO TRANSFERENCIA ACH MESADA MARZO 2503424986 LUJAN PATRICIA ZAMBRANA SANDOVAL VDA.DE BANCO NAC
2026/03/03 08:15 CREDITO 001 0001 123456 BOL 0.00 600.00 600.00

PAGO POS E.S. ORSAURUBO AX BS SANTA CRUZ BO 07693304
2026/03/03 09:30 PAGPOS 001 0002 234567 BOL 150.00 0.00 450.00

COBRO SEGURO TARJETA DE DEBITO
2026/03/03 10:00 COBRO 001 0003 345678 BOL 19.00 0.00 431.00

COMPRA INTERNET EXT APPLE.COM/BILL 866-712-7753 US
2026/03/06 11:00 COMPRA 001 0004 456789 BOL 34.78 0.00 396.22

COMPRA INTERNET EXT APPLE.COM/BILL 866-712-7753 US
2026/03/06 14:00 COMPRA 001 0005 567890 BOL 41.75 0.00 354.47

DEBITO TRANSFERENCIA ACH 10151446439398 VELA MARTINEZ ERICK GUALBERTO BANCO DE CREDITO DE BOLIVIA S
2026/03/27 15:30 DEBITO 001 0006 678901 BOL 958.00 0.00 1000.00

CREDITO TRANSFERENCIA 1012303951 ZAMBRANA SANDOVAL VDA. DE LUJAN PATRICIA
2026/03/31 16:00 CREDITO 001 0007 789012 BOL 0.00 300.00 1300.00

SALDO ANTERIOR TOTAL DEBITOS TOTAL CREDITOS SALDO A LA FECHA
"""

MAKROBANX_EXPECTED = [
    {"date": "2026-03-03", "amount": 600.00,  "type": "income",  "desc_contains": "CREDITO TRANSFERENCIA ACH MESADA MARZO"},
    {"date": "2026-03-03", "amount": 150.00,  "type": "expense", "desc_contains": "PAGO POS E.S. ORSAURUBO"},
    {"date": "2026-03-03", "amount": 19.00,   "type": "expense", "desc_contains": "COBRO SEGURO TARJETA DE DEBITO"},
    {"date": "2026-03-06", "amount": 34.78,   "type": "expense", "desc_contains": "APPLE.COM/BILL"},
    {"date": "2026-03-06", "amount": 41.75,   "type": "expense", "desc_contains": "APPLE.COM/BILL"},
    {"date": "2026-03-27", "amount": 958.00,  "type": "expense", "desc_contains": "VELA MARTINEZ ERICK"},
    {"date": "2026-03-31", "amount": 300.00,  "type": "income",  "desc_contains": "ZAMBRANA SANDOVAL"},
]

# ── Banco Económico synthetic test text ───────────────────────────────────────
ECONOMICO_TEXT = """
Banco Económico
baneco.com.bo
Extracto de Cuenta
Titular: ROMERO PENAFIEL IGNACIO
Cuenta: 1234567890
Del 01/Mar/2026 al 31/Mar/2026

FECHA HORA NRO TRN./CHEQUE DESCRIPCIÓN DE LA TRANSACCIÓN MONTO (Bs) SALDO (Bs)

02/Mar/2026 09:00 100001 TRASPASO CA/CC CON QR (MOVIL) 20.00 520.00
Nota: TRASP.CTAS.TERCEROS PEAFIEL MOLINA ANA CAROLA

13/Mar/2026 14:30 100002 CREDITO ACH QR 2,774.00 3,294.00
Nota: RODMILA DAZA HURTADO(B. MERCANTIL)ROMERO PENAFIEL IGNACIO 1091022956

15/Mar/2026 10:15 100003 DEBITO POR COMPRA EN COMERCIO ELECTRONIC -13.87 3,280.13
Nota: APPLE.COM/BILL866-712-7753US

24/Mar/2026 11:00 100004 DEBITO POR COMPRA EN COMERCIO ELECTRONIC -24.33 3,255.80
Nota: SpotifyP40B431F6FStockholmSE

28/Mar/2026 08:00 100005 TRASPASO ENTRE CAJAS DE AHORRO(MOVIL) 8,200.00 11,455.80
Nota: TRASP.CTAS.TERCEROS ROMERO MERCADO PABLO IGNACIO

28/Mar/2026 09:00 100006 DEBITO ACH QR -8,138.00 3,317.80
Nota: CHAVEZ VIDAL JHONATAN (B. GANADERO) Servicios Daytona

31/Mar/2026 23:59 100007 INTERESES GANADOS 2.58 3,320.38
Nota: Interes s/1497.47 tasa 2.00000% por 31 dias

31/Mar/2026 23:59 100008 RETENCION DE IMPUESTOS IVA -0.34 3,320.04
Nota: Impuestos Retenidos

Saldo Inicial
Saldo Final
"""

ECONOMICO_EXPECTED = [
    {"date": "2026-03-02", "amount": 20.00,    "type": "income",  "desc_contains": "TRASPASO CA/CC CON QR", "nota_contains": "PEAFIEL MOLINA ANA CAROLA"},
    {"date": "2026-03-13", "amount": 2774.00,  "type": "income",  "desc_contains": "CREDITO ACH QR",        "nota_contains": "RODMILA DAZA"},
    {"date": "2026-03-15", "amount": 13.87,    "type": "expense", "desc_contains": "DEBITO POR COMPRA",     "nota_contains": "APPLE.COM"},
    {"date": "2026-03-24", "amount": 24.33,    "type": "expense", "desc_contains": "DEBITO POR COMPRA",     "nota_contains": "Spotify"},
    {"date": "2026-03-28", "amount": 8200.00,  "type": "income",  "desc_contains": "TRASPASO ENTRE CAJAS",  "nota_contains": "ROMERO MERCADO PABLO"},
    {"date": "2026-03-28", "amount": 8138.00,  "type": "expense", "desc_contains": "DEBITO ACH QR",         "nota_contains": "CHAVEZ VIDAL"},
    {"date": "2026-03-31", "amount": 2.58,     "type": "income",  "desc_contains": "INTERESES GANADOS",     "nota_contains": "Interes s/1497"},
    {"date": "2026-03-31", "amount": 0.34,     "type": "expense", "desc_contains": "RETENCION",             "nota_contains": "Impuestos"},
]


def _check(label: str, rows: list[dict], expected: list[dict]) -> int:
    failures = 0
    if len(rows) != len(expected):
        print(f"  FAIL [{label}]: expected {len(expected)} rows, got {len(rows)}")
        for i, r in enumerate(rows):
            print(f"    [{i}] {r['date']} {r['type']} {r['amount']} | {r['description'][:80]}")
        return 1

    for i, (row, exp) in enumerate(zip(rows, expected)):
        errs = []
        if row["date"] != exp["date"]:
            errs.append(f"date {row['date']!r} != {exp['date']!r}")
        if abs(row["amount"] - exp["amount"]) > 0.001:
            errs.append(f"amount {row['amount']} != {exp['amount']}")
        if row["type"] != exp["type"]:
            errs.append(f"type {row['type']!r} != {exp['type']!r}")
        if exp.get("desc_contains") and exp["desc_contains"].lower() not in row["description"].lower():
            errs.append(f"description missing {exp['desc_contains']!r} in {row['description']!r}")
        if exp.get("nota_contains") and exp["nota_contains"].lower() not in row["description"].lower():
            errs.append(f"nota missing {exp['nota_contains']!r} in {row['description']!r}")

        if errs:
            print(f"  FAIL [{label}] row {i}: {'; '.join(errs)}")
            print(f"       got: {row}")
            failures += 1
        else:
            print(f"  OK   [{label}] row {i}: {row['date']} {row['type']} {row['amount']} | {row['description'][:70]}")

    return failures


def run() -> None:
    from app.services.parsers import (
        MakroBanxParser, BancoEconomicoParser, BancoGanaderoParser,
        detect_and_parse,
    )

    total_failures = 0

    # ── 1. MakroBanx ────────────────────────────────────────────────────────
    print("\n=== MakroBanx ===")
    parser = MakroBanxParser()
    assert parser.can_parse(MAKROBANX_TEXT), "MakroBanx.can_parse() returned False"
    rows = parser.parse(MAKROBANX_TEXT)
    total_failures += _check("MakroBanx", rows, MAKROBANX_EXPECTED)

    # ── 2. Banco Económico ───────────────────────────────────────────────────
    print("\n=== Banco Económico ===")
    parser2 = BancoEconomicoParser()
    assert parser2.can_parse(ECONOMICO_TEXT), "BancoEconomico.can_parse() returned False"
    rows2 = parser2.parse(ECONOMICO_TEXT)
    total_failures += _check("BancoEconomico", rows2, ECONOMICO_EXPECTED)

    # ── 3. detect_and_parse routing ──────────────────────────────────────────
    print("\n=== detect_and_parse routing ===")
    bg_text = "Banco Ganadero extracto 01/01/2026 12:00:00 "
    name, _ = detect_and_parse(bg_text)
    if name != "Banco Ganadero":
        print(f"  FAIL: Ganadero text routed to {name!r}")
        total_failures += 1
    else:
        print(f"  OK   Ganadero text → {name}")

    name2, _ = detect_and_parse(MAKROBANX_TEXT)
    if name2 != "MakroBanx":
        print(f"  FAIL: MakroBanx text routed to {name2!r}")
        total_failures += 1
    else:
        print(f"  OK   MakroBanx text → {name2}")

    name3, _ = detect_and_parse(ECONOMICO_TEXT)
    if name3 != "Banco Económico":
        print(f"  FAIL: Económico text routed to {name3!r}")
        total_failures += 1
    else:
        print(f"  OK   Económico text → {name3}")

    # ── 4. Unknown format ────────────────────────────────────────────────────
    print("\n=== Unknown format ===")
    try:
        detect_and_parse("Este es un PDF de otro banco desconocido.")
        print("  FAIL: no ValueError raised for unknown format")
        total_failures += 1
    except ValueError as e:
        if "Bancos soportados" in str(e):
            print(f"  OK   ValueError raised: {e}")
        else:
            print(f"  FAIL: wrong error message: {e}")
            total_failures += 1

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{'='*40}")
    if total_failures == 0:
        print("ALL CHECKS PASSED ✓")
    else:
        print(f"{total_failures} CHECK(S) FAILED ✗")
        sys.exit(1)


if __name__ == "__main__":
    run()
