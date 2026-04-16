"""Quick validation of BNBParser — run with: python test_bnb_parser.py"""
import sys
sys.path.insert(0, '.')

from app.services.parsers.bnb import BNBParser

parser = BNBParser()

# Test can_parse
assert parser.can_parse("Visit bnb.com.bo for more info"), "FAIL: bnb.com.bo"
assert parser.can_parse("Banco Nacional de Bolivia"), "FAIL: full name"
assert parser.can_parse("BNB NET transfer"), "FAIL: BNB NET"
assert not parser.can_parse("MakroBanx statement"), "FAIL: should not match MakroBanx"
assert not parser.can_parse("Banco Económico statement"), "FAIL: should not match BEco"
assert not parser.can_parse("BANCO GANADERO"), "FAIL: should not match Ganadero"

print("✓ can_parse tests passed")

# Test registry routing
from app.services.parsers import detect_and_parse, PARSER_REGISTRY
print("Registry order:", [p.__class__.__name__ for p in PARSER_REGISTRY])
matched = next((p for p in PARSER_REGISTRY if p.can_parse("bnb.com.bo BNB NET")), None)
assert matched is not None, "FAIL: no parser matched BNB text"
assert matched.__class__.__name__ == "BNBParser", f"FAIL: routed to {matched.__class__.__name__}"
print("✓ Registry routing correct")

# Test a minimal parse with synthetic BNB-like text
sample_text = """
Banco Nacional de Bolivia
BNB NET — Cuenta Corriente

Depósitos
Fecha Hora Descripción Referencia Comprobante Créditos
15/03/2026 10:25
DEPOSITO EN EFECTIVO
Lugar: AGENCIA CENTRAL
123456 2P26195078 1,500.00
17/03/2026 14:05
TRANSFERENCIA INTERBANCARIA
Nombre: JUAN PEREZ GOMEZ
Banco: BANCO UNION
20/03/2026 09:00
1234567 9X12345678 800.00
Total depósitos

Retiros
Fecha Hora Descripción Referencia Comprobante Débitos
18/03/2026 11:30
COMPRA EN COMERCIO
Lugar: RESTAURANTE EL SOL
654321 3Q87654321 250.00
Total retiros
"""

rows = parser.parse(sample_text)
print(f"\nParsed {len(rows)} rows from synthetic BNB text:")
for r in rows:
    print(f"  [{r['type']:7}] {r['date']}  {r['amount']:10.2f} BOB  {r['description'][:60]}")
    if r.get('comprobante'):
        print(f"           comprobante: {r['comprobante']}")

# Verify sign logic: deposits → income, withdrawals → expense
incomes = [r for r in rows if r['type'] == 'income']
expenses = [r for r in rows if r['type'] == 'expense']
assert len(expenses) >= 1, "FAIL: should have at least 1 expense from Retiros section"
print(f"\n✓ Section sign logic: {len(incomes)} income(s), {len(expenses)} expense(s)")

# Verify comprobante extraction
rows_with_comp = [r for r in rows if r.get('comprobante')]
print(f"✓ Comprobante extracted on {len(rows_with_comp)}/{len(rows)} rows")

# Verify currency
assert all(r['currency'] == 'BOB' for r in rows), "FAIL: all transactions should be BOB"
print("✓ Currency = BOB for all rows")

print("\nAll tests passed!")
