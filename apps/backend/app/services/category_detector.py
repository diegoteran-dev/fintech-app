"""
Bolivian Merchant Category Detector
====================================
Maps transaction descriptions to Vault expense/income categories using
keyword patterns researched from common businesses operating in Bolivia.

Expense categories : Housing · Groceries · Transport · Entertainment ·
                     Shopping · Health · Utilities · Dining · Savings · Other
Income  categories : Salary · Freelance · Investment Returns · Reimbursement · Other

Pattern order matters — more specific rules come first.
All patterns are matched case-insensitively against the cleaned description.

Merchants are sourced from observations in real Banco Ganadero statements
(Santa Cruz, Bolivia) plus publicly-known chains operating across
La Paz, Cochabamba, Santa Cruz, and Tarija.
"""

from __future__ import annotations
import re

# ---------------------------------------------------------------------------
# EXPENSE PATTERNS  (pattern, category)
# ---------------------------------------------------------------------------
EXPENSE_PATTERNS: list[tuple[str, str]] = [

    # ── HEALTH — Pharmacies ─────────────────────────────────────────────────
    # Farmacorp is the largest pharmacy chain in Bolivia (like a CVS)
    (r'farmacorp',          'Health'),
    # Generic farmacia / farmacias keyword covers Farmacia Chavez, Farmacia
    # del Ahorro, Bionorm, Salufarma, etc.
    (r'farmacia',           'Health'),
    (r'bionorm',            'Health'),
    (r'salufarma',          'Health'),
    (r'dr\.?\s*simi',       'Health'),   # Farmacia del Dr. Simi chain
    (r'fasa\b',             'Health'),   # Farmacia Fasa

    # Clinics, hospitals, labs
    (r'hospital',           'Health'),
    (r'cl[ií]nica',         'Health'),
    (r'centro\s+m[eé]dic',  'Health'),
    (r'consultorio',        'Health'),
    (r'laboratorio',        'Health'),
    (r'klinical',           'Health'),   # Klinical Labs
    (r'dentist',            'Health'),
    (r'odontol',            'Health'),
    (r'[oó]ptica',          'Health'),
    (r'san\s+gabriel',      'Health'),   # Clínica San Gabriel (La Paz)
    (r'san\s+juan\s+de\s+dios', 'Health'),

    # Gyms
    (r'smart\s*fit',        'Health'),   # Smart Fit — largest gym chain in Bolivia
    (r'body\s*tech',        'Health'),
    (r'sport\s*life',       'Health'),
    (r'life\s*sport',       'Health'),
    (r'\bgym\b',            'Health'),
    (r'fitness',            'Health'),
    (r'crossfit',           'Health'),

    # ── GROCERIES — Supermarkets ─────────────────────────────────────────────
    # Major chains in Bolivia
    (r'hipermaxi',          'Groceries'),  # largest hypermarket chain
    (r'\bketal\b',          'Groceries'),  # mid-size supermarket, multiple cities
    (r'superseis',          'Groceries'),  # Santa Cruz
    (r'pricesmart',         'Groceries'),  # warehouse club (SC & LP)
    (r'fidalga',            'Groceries'),  # Santa Cruz
    (r'pairumani',          'Groceries'),  # Cochabamba
    (r'aganorsa',           'Groceries'),
    (r'erbol\b',            'Groceries'),
    # IC Norte / IC Sur / IC Mega — Industrial Comercial supermarkets (Santa Cruz)
    (r'\bic\s+(norte|sur|mega|center|urubo|equipet)',  'Groceries'),
    (r'\bic\b.*market',     'Groceries'),
    # ORSA S.R.L. — supermarket in Santa Cruz
    (r'\borsa\b',           'Groceries'),
    # Generic grocery keywords
    (r'supermercado',       'Groceries'),
    (r'minimarket',         'Groceries'),
    (r'despensa',           'Groceries'),
    (r'verduleria',         'Groceries'),
    (r'fruteria',           'Groceries'),
    (r'carniceria',         'Groceries'),
    # "market" alone can match supermarkets; keep after more-specific rules
    (r'\bmarket\b',         'Groceries'),

    # ── DINING — Restaurants, cafés, fast food ───────────────────────────────
    # Global fast food chains present in Bolivia
    (r'mcdonald',           'Dining'),
    (r'\bkfc\b',            'Dining'),
    (r'burger\s*king',      'Dining'),
    (r'subway\b',           'Dining'),
    (r'pizza\s*hut',        'Dining'),
    (r'domino',             'Dining'),
    (r'papa\s*john',        'Dining'),
    (r'pollo\s+campero',    'Dining'),
    (r'pollo\s+nuestro',    'Dining'),
    # Local chains and well-known restaurants in Bolivia
    (r'wistupiku',          'Dining'),   # popular restaurant chain, Santa Cruz
    (r'typica\s+cafe',      'Dining'),   # trendy café, Santa Cruz
    (r'sacha\s+huask',      'Dining'),   # traditional Bolivian restaurant
    (r'hot\s+burger',       'Dining'),
    (r'nativo\s+health',    'Dining'),   # Nativo Healthy Foods
    (r'bolivian\s+foods',   'Dining'),
    (r'omni\s*foods',       'Dining'),
    (r'el\s+forno',         'Dining'),
    (r'pappo\b',            'Dining'),
    (r'dumbo\b',            'Dining'),   # ice-cream chain
    (r'fridolin',           'Dining'),   # ice-cream chain
    (r'bloomsbury',         'Dining'),   # café-bookstore
    (r'cafe\s+alexander',   'Dining'),
    (r'cafe\s+europa',      'Dining'),
    (r'pastas\s+waldo',     'Dining'),
    (r'casa\s+del\s+cojinova', 'Dining'),
    # Chifa — Bolivian-Chinese restaurants (very common)
    (r'\bchifa\b',          'Dining'),
    # Generic dining keywords
    (r'\bcafe\b',           'Dining'),
    (r'cafeter[ií]a',       'Dining'),
    (r'restaurant',         'Dining'),   # matches "restaurant" & "restaurante"
    (r'pizzer[ií]a',        'Dining'),
    (r'\bpizza\b',          'Dining'),
    (r'\bburger\b',         'Dining'),
    (r'sushi',              'Dining'),
    (r'parrilla',           'Dining'),
    (r'asador',             'Dining'),
    (r'heladeria',          'Dining'),
    (r'pasteleria',         'Dining'),
    (r'panaderia',          'Dining'),
    (r'salte[nñ]a',         'Dining'),   # typical Bolivian snack shop
    (r'\bbar\b',            'Dining'),
    (r'cerveceria',         'Dining'),
    (r'rotisserie',         'Dining'),
    (r'\bpropina\b',        'Dining'),   # tip at a restaurant

    # ── TRANSPORT ────────────────────────────────────────────────────────────
    (r'cabify',             'Transport'),
    (r'\buber\b',           'Transport'),
    (r'indrive',            'Transport'),
    (r'in\s*drive',         'Transport'),
    (r'\btaxi\b',           'Transport'),
    # Fuel
    (r'\bypfb\b',           'Transport'),  # Yacimientos Petrolíferos (state fuel)
    (r'petrobras',          'Transport'),
    (r'gasolina',           'Transport'),
    (r'combustible',        'Transport'),
    (r'grifo\b',            'Transport'),  # gas station
    # Parking
    (r'parking',            'Transport'),
    (r'estacionamiento',    'Transport'),
    (r'peaje',              'Transport'),
    # Airlines — Boliviana de Aviación, LATAM, Avianca, etc.
    (r'\bboa\b',            'Transport'),
    (r'avianca',            'Transport'),
    (r'latam\b',            'Transport'),
    (r'american\s+airlines','Transport'),
    (r'aerol[ií]nea',       'Transport'),
    (r'\bvuelo\b',          'Transport'),
    (r'aero\s*sur',         'Transport'),
    # Long-distance buses (Bolivia has many intercity bus companies)
    (r'peh[uú]en',          'Transport'),  # Flota Pehuén
    (r'trans\s+copacabana', 'Transport'),
    (r'\bflota\b',          'Transport'),

    # ── ENTERTAINMENT ─────────────────────────────────────────────────────────
    (r'cinemark',           'Entertainment'),
    (r'cineplanet',         'Entertainment'),
    (r'cine\s*center',      'Entertainment'),
    (r'multicine',          'Entertainment'),
    (r'\bcine\b',           'Entertainment'),
    (r'casino',             'Entertainment'),
    # Digital subscriptions
    (r'netflix',            'Entertainment'),
    (r'spotify',            'Entertainment'),
    (r'youtube\s+premium',  'Entertainment'),
    (r'disney\+',           'Entertainment'),
    (r'disney\s+plus',      'Entertainment'),
    (r'amazon\s+prime',     'Entertainment'),
    (r'\bhbo\b',            'Entertainment'),
    (r'paramount\+',        'Entertainment'),
    (r'apple\s+tv',         'Entertainment'),
    # Gaming
    (r'\bsteam\b',          'Entertainment'),
    (r'playstation',        'Entertainment'),
    (r'\bxbox\b',           'Entertainment'),
    (r'nintendo',           'Entertainment'),

    # ── SHOPPING — Clothing, beauty, general retail ───────────────────────────
    # Malls
    (r'multicenter',        'Shopping'),
    (r'megacenter',         'Shopping'),
    (r'las\s+brisas',       'Shopping'),
    (r'ventura\s+mall',     'Shopping'),
    (r'mall\s+santa\s+cruz','Shopping'),
    (r'\bmall\b',           'Shopping'),
    # Clothing brands with presence in Bolivia
    (r'\bzara\b',           'Shopping'),
    (r'\badidas\b',         'Shopping'),
    (r'\bnike\b',           'Shopping'),
    (r'\bh&m\b',            'Shopping'),
    (r'\bmango\b',          'Shopping'),
    (r'americanino',        'Shopping'),
    (r'punto\s+blanco',     'Shopping'),
    (r'studio\s*f\b',       'Shopping'),
    (r'arturo\s+calle',     'Shopping'),
    (r'esprit\b',           'Shopping'),
    # Electronics / appliances
    (r'tiendas\s+efe',      'Shopping'),
    (r'electro\s*sur',      'Shopping'),
    # E-commerce
    (r'amazon\b',           'Shopping'),
    (r'aliexpress',         'Shopping'),
    (r'mercado\s+libre',    'Shopping'),
    # Beauty & personal care
    (r'mam\s+hair',         'Shopping'),   # MAM Hair Studio (Santa Cruz)
    (r'hair\s+studio',      'Shopping'),
    (r'\bsalon\b',          'Shopping'),
    (r'sal[oó]n\b',         'Shopping'),
    (r'\bspa\b',            'Shopping'),
    (r'peluquer[ií]a',      'Shopping'),
    (r'barber[ií]a',        'Shopping'),
    (r'belleza',            'Shopping'),
    (r'estetica',           'Shopping'),
    # Credit card payment to ATC (ADM Tarjetas de Crédito) — shopping proxy
    (r'atc\s+sa',           'Shopping'),
    (r'adm\s+tarjetas',     'Shopping'),

    # ── UTILITIES — Bills, insurance, telecom ─────────────────────────────────
    # Insurance (seguro = insurance in Spanish — covers car, health, home, etc.)
    (r'seguro',             'Utilities'),
    (r'insurance',          'Utilities'),
    (r'p[oó]liza',         'Utilities'),
    # Electricity by city
    (r'\belfec\b',          'Utilities'),  # Empresa de Luz y Fuerza — Cochabamba
    (r'electropaz',         'Utilities'),  # La Paz
    (r'\bcre\b',            'Utilities'),  # Cooperativa Rural de Electrificación — SC
    (r'sedecom',            'Utilities'),  # La Paz distribution
    # Water by city
    (r'saguapac',           'Utilities'),  # Santa Cruz
    (r'\bsemapa\b',         'Utilities'),  # Cochabamba
    (r'epsas\b',            'Utilities'),  # La Paz / El Alto
    (r'setar\b',            'Utilities'),  # Tarija
    (r'aguas\s+de\s+la\s+paz', 'Utilities'),
    (r'\baaps\b',           'Utilities'),
    # Telecoms (mobile & internet)
    (r'\btigo\b',           'Utilities'),
    (r'\bentel\b',          'Utilities'),
    (r'\bviva\b',           'Utilities'),
    (r'\bclaro\b',          'Utilities'),
    (r'\bcotas\b',          'Utilities'),  # Cooperativa de Telecomunicaciones — SC
    (r'\baxs\b',            'Utilities'),  # internet provider
    (r'\bnet\s+uno\b',      'Utilities'),
    (r'bolivianet',         'Utilities'),
    (r'internet',           'Utilities'),
    (r'telefon',            'Utilities'),
    # Gas
    (r'\bgas\s+domicil',    'Utilities'),
    # Tax withholding (shows up in BG statements)
    (r'retencion.*impuesto', 'Utilities'),
    (r'impuesto.*iva',       'Utilities'),

    # ── HOUSING ───────────────────────────────────────────────────────────────
    (r'alquiler',           'Housing'),
    (r'arriendo',           'Housing'),
    (r'anticresis',         'Housing'),
    (r'condominio',         'Housing'),
    (r'administracion.*edificio', 'Housing'),
    (r'inmobiliaria',       'Housing'),
    (r'arrendamiento',      'Housing'),
    (r'propietario',        'Housing'),

    # ── SAVINGS — Internal transfers treated as savings movements ─────────────
    # Transfers to own savings accounts (common pattern in BG statements)
    (r'trans\s+a\s+\d+.*teran', 'Savings'),  # transfer to own account
]

# ---------------------------------------------------------------------------
# INCOME PATTERNS
# ---------------------------------------------------------------------------
INCOME_PATTERNS: list[tuple[str, str]] = [
    # Investment / interest
    (r'intereses\s+ganados',    'Investment Returns'),
    (r'interes\s+ganado',       'Investment Returns'),
    (r'dividendo',              'Investment Returns'),
    (r'rendimiento',            'Investment Returns'),
    (r'ganancia',               'Investment Returns'),

    # Salary / allowance
    (r'\bsalario\b',            'Salary'),
    (r'\bsueldo\b',             'Salary'),
    (r'n[oó]mina',              'Salary'),
    (r'\bmesada\b',             'Salary'),   # monthly family allowance
    (r'\bpension\b',            'Salary'),
    (r'bono\b',                 'Salary'),
    (r'aguinaldo',              'Salary'),   # Christmas bonus

    # Freelance
    (r'freelance',              'Freelance'),
    (r'honorario',              'Freelance'),
    (r'servicio.*profes',       'Freelance'),
    (r'consultor[ií]a',         'Freelance'),

    # Reimbursement — money owed paid back, shared expenses, cost splits
    (r'reembolso',              'Reimbursement'),
    (r'devoluci[oó]n',          'Reimbursement'),
    (r'cobro\b',                'Reimbursement'),
    (r'pago\s+de\s+deuda',      'Reimbursement'),
    (r'gastos\s+varios',        'Reimbursement'),
    (r'\bgastos\b',             'Reimbursement'),  # "gastos" in memo = cost reimbursement
    (r'\bgym\b',                'Reimbursement'),  # family paying back gym
    (r'\bpelu',                 'Reimbursement'),  # family paying back haircut
]


def detect_category(description: str, tx_type: str) -> str:
    """
    Return the best Vault category for a transaction.

    Args:
        description: Cleaned merchant / transaction description.
        tx_type:     'income' or 'expense'.

    Returns:
        Category string matching one of the Vault expense or income categories.
    """
    desc_lower = description.lower()
    patterns = INCOME_PATTERNS if tx_type == 'income' else EXPENSE_PATTERNS
    for pattern, category in patterns:
        if re.search(pattern, desc_lower):
            return category
    return 'Other'
