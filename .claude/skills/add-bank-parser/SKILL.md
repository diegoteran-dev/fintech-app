---
name: add-bank-parser
description: Scaffold and implement a new Bolivian/LatAm bank PDF parser. Use when adding support for a new bank's statement format. Argument is the bank name (e.g. "Banco Mercantil").
when_to_use: Use when the user mentions a new bank, a bank statement that fails to parse, or asks to add support for a bank.
allowed-tools: Bash(cat *) Bash(ls *) Bash(cd *) Bash(cp *) Bash(grep *)
argument-hint: "[BankName]"
---

Add a new bank PDF parser for: `$ARGUMENTS`

## Step 1 — Understand the pattern

Read the template to understand the structure:
```bash
cat /Users/diegoteran/Projects/fintech-app/.claude/skills/add-bank-parser/template.py
```

Also read one existing parser for reference:
```bash
cat /Users/diegoteran/Projects/fintech-app/apps/backend/app/services/parsers/banco_ganadero.py
```

## Step 2 — Create the parser file

Derive a snake_case filename from `$ARGUMENTS` (e.g. "Banco Mercantil" → `banco_mercantil.py`).

Create `apps/backend/app/services/parsers/<filename>.py` following the template.

Key implementation decisions to ask Diego if unclear:
- What unique string in the PDF identifies this bank? (check header/footer text)
- What is the date format used? (DD/MM/YYYY, MM/DD/YYYY, etc.)
- Are transactions one-per-line or multi-line?
- What column order? (date, description, debit, credit, balance — order varies by bank)
- What currency? (BOB by default for Bolivian banks, USD for some accounts)

## Step 3 — Register the parser

Edit `apps/backend/app/services/parsers/__init__.py`:
1. Add the import with the other imports
2. Add an instance to `PARSER_REGISTRY` — place it **before** BancoGanaderoParser (most generic, checked last)

The `__init__.py` docstring explains the detection order.

## Step 4 — Test

Ask Diego to paste a few lines of raw text from one of the bank's PDF statements (use `pdftotext` or copy-paste). Then:

1. Test `can_parse()` manually:
```bash
cd /Users/diegoteran/Projects/fintech-app/apps/backend && source .venv/bin/activate
python3 -c "
from app.services.parsers.<filename> import <ClassName>
p = <ClassName>()
sample = '''<paste sample text here>'''
print('can_parse:', p.can_parse(sample))
"
```

2. If Diego has a real PDF, test the full pipeline:
```bash
python3 -c "
from app.services.parsers import detect_and_parse
with open('<path_to_pdf>', 'rb') as f:
    import pdfminer.high_level as ph
    text = ph.extract_text(f)
bank, txns = detect_and_parse(text)
print(f'Bank: {bank}, Transactions: {len(txns)}')
for t in txns[:3]:
    print(t)
"
```

## Step 5 — Summary

Report:
- Parser file created at (path)
- `can_parse()` detection string used
- Number of test transactions extracted (if tested)
- Any edge cases noted for future improvement
