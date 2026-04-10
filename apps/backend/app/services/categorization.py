"""
categorization.py
=================
Per-user categorization rule memory system.

Public API
----------
extract_fingerprint(description: str) -> str
    Reduces a noisy transaction description to its core merchant/person name.
    Deterministic — same input always yields same output.

save_user_rule(db, user_id, description, category_name, source) -> None
    Upserts a rule row whenever a user confirms a category.

get_user_category(db, user_id, description) -> (category_name, confidence, match_level) | None
    Tries three match levels in order and returns the best result, or None.

Match levels (tried in order):
  1. EXACT    — normalize(description) == normalize(stored_merchant_raw)        confidence=100
  2. FINGERPRINT — fingerprint(description) == stored_fingerprint               confidence=100
  3. FUZZY    — SequenceMatcher ratio ≥ 0.82 on fingerprints                   confidence=int(ratio*100)
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Filler words stripped during fingerprint extraction
# ---------------------------------------------------------------------------
_FILLER: frozenset[str] = frozenset({
    "transferencia", "debito", "debitos", "credito", "creditos", "ach", "qr",
    "pago", "pos", "compra", "internet", "ext", "movil", "traspaso", "entre",
    "cajas", "ahorro", "terceros", "banco", "nacional", "ganadero", "economico",
    "bisa", "mercantil", "sol", "s.a", "srl", "ltd", "the", "de", "del", "en",
    "a", "por", "con", "para", "desde", "hasta", "via", "al",
})

# Transaction IDs: 8+ chars, must have at least one letter AND one digit (e.g. FT26062RCW1M)
# Applied BEFORE lowercasing to catch all-caps patterns.
_TX_ID_RE = re.compile(
    r'\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,}\b'
)

# Pure numeric tokens of 6+ digits (account numbers, transaction codes)
_LONG_NUM_RE = re.compile(r'\b\d{6,}\b')

# Phone-number-like sequences (digit, 8+ digit-or-dash, digit)
_PHONE_RE = re.compile(r'\b\d[\d\-]{8,}\d\b')

# Punctuation to strip — keep "/" and "." (needed for APPLE.COM/BILL)
_PUNCT_RE = re.compile(r"[^\w\s/.]")

# Normalization (no kept punctuation — used only for Level-1 exact match)
_NORM_PUNCT_RE = re.compile(r"[^\w\s]")


# ---------------------------------------------------------------------------
# Core utility
# ---------------------------------------------------------------------------

def extract_fingerprint(description: str) -> str:
    """
    Reduce a noisy transaction description to its core merchant/person name.

    Examples:
        "COMPRA INTERNET EXT APPLE.COM/BILL 866-712-7753 US"
            → "apple.com/bill us"
        "DEBITO ACH QR Nota: FARMACORP S.A.-SUC 199 SANTA CRUZ BO 10630056"
            → "farmacorp suc 199 santa cruz bo"
        "LUJAN PATRICIA ZAMBRANA SANDOVAL VDA.DE"
            → "lujan patricia zambrana sandoval vda."
        "FREDYJOB MENGOA MONTES DE OCA (B. SOL)"
            → "fredyjob mengoa montes oca"
    """
    if not description or not description.strip():
        return ""

    # If "nota:" is present, use the text AFTER it as the primary signal
    # (Banco Económico format: "MAIN_DESC | Nota: MERCHANT_NAME")
    text_lower = description.lower()
    if "nota:" in text_lower:
        idx = text_lower.find("nota:")
        text = description[idx + 5:].strip()
    else:
        text = description

    # 1. Remove transaction IDs before lowercasing (they're uppercase)
    text = _TX_ID_RE.sub(" ", text)

    # 2. Lowercase
    text = text.lower()

    # 3. Remove phone numbers (e.g. 866-712-7753)
    text = _PHONE_RE.sub(" ", text)

    # 4. Strip punctuation, keeping / and .
    text = _PUNCT_RE.sub(" ", text)

    # 5. Remove long numeric tokens (account numbers, etc.)
    text = _LONG_NUM_RE.sub(" ", text)

    # 6. Tokenize, remove filler words and single-character tokens
    tokens = []
    for t in text.split():
        t_base = t.strip(".")          # "s.a." → "s.a" for filler comparison
        if t_base in _FILLER:
            continue
        if len(t_base) <= 1:           # skip single chars like "b"
            continue
        tokens.append(t)

    return " ".join(tokens).strip()


def _normalize(text: str) -> str:
    """Lowercase, strip all punctuation, collapse whitespace."""
    t = _NORM_PUNCT_RE.sub(" ", text.lower())
    return re.sub(r"\s+", " ", t).strip()


# ---------------------------------------------------------------------------
# Rule persistence
# ---------------------------------------------------------------------------

def save_user_rule(
    db: Session,
    user_id: int,
    description: str,
    category_name: str,
    source: str,
) -> None:
    """
    Upsert a per-user categorization rule.

    source: "manual_edit" | "manual_create" | "bulk_categorize"

    Silently skips if description is blank or fingerprint extracts to empty.
    """
    from app.models.user_category_rule import UserCategoryRule
    from app.models.category import Category

    if not description or not description.strip():
        return
    if not category_name or not category_name.strip():
        return

    fingerprint = extract_fingerprint(description)
    if not fingerprint:
        return

    # Resolve or create category
    cat = db.query(Category).filter(Category.name == category_name).first()
    if cat is None:
        cat = Category(name=category_name, is_system=False)
        db.add(cat)
        db.flush()

    existing = (
        db.query(UserCategoryRule)
        .filter(
            UserCategoryRule.user_id == user_id,
            UserCategoryRule.merchant_fingerprint == fingerprint,
        )
        .first()
    )

    if existing:
        existing.merchant_raw = description
        existing.category_id = cat.id
        existing.source = source
        existing.updated_at = datetime.utcnow()
        db.commit()
        logger.info(
            "Rule updated: user=%d fingerprint=%r category=%r",
            user_id, fingerprint, category_name,
        )
    else:
        rule = UserCategoryRule(
            user_id=user_id,
            merchant_raw=description,
            merchant_fingerprint=fingerprint,
            category_id=cat.id,
            source=source,
            confidence=100,
            times_applied=0,
        )
        db.add(rule)
        db.commit()
        logger.info(
            "Rule saved: user=%d fingerprint=%r category=%r",
            user_id, fingerprint, category_name,
        )


# ---------------------------------------------------------------------------
# Rule lookup
# ---------------------------------------------------------------------------

def get_user_category(
    db: Session,
    user_id: int,
    description: str,
) -> tuple[str, int, str] | None:
    """
    Look up a user's personal categorization rules for a given description.

    Returns (category_name, confidence, match_level) or None.
    match_level: "exact" | "fingerprint" | "fuzzy"

    Matching is scoped entirely to user_id — never crosses user boundaries.
    """
    from app.models.user_category_rule import UserCategoryRule
    from app.models.category import Category

    if not description or not description.strip():
        return None

    # Fast exit: if the user has no rules at all, skip all processing
    has_rules = (
        db.query(UserCategoryRule.id)
        .filter(UserCategoryRule.user_id == user_id)
        .first()
    )
    if has_rules is None:
        return None

    # Load all rules for this user (kept small by the unique fingerprint constraint)
    rules = (
        db.query(UserCategoryRule)
        .filter(UserCategoryRule.user_id == user_id)
        .all()
    )

    new_norm = _normalize(description)
    new_fp = extract_fingerprint(description)

    best_fuzzy: tuple[float, UserCategoryRule] | None = None

    for rule in rules:
        # Defensive: skip rules whose category was deleted
        cat = db.get(Category, rule.category_id)
        if cat is None:
            logger.warning(
                "Rule id=%d references deleted category_id=%d — skipping",
                rule.id, rule.category_id,
            )
            continue

        # Level 1 — exact (normalized raw description)
        if new_norm == _normalize(rule.merchant_raw):
            _bump_rule(db, rule)
            return (cat.name, 100, "exact")

        # Level 2 — fingerprint exact match
        if new_fp and new_fp == rule.merchant_fingerprint:
            _bump_rule(db, rule)
            return (cat.name, 100, "fingerprint")

        # Level 3 — fuzzy on fingerprints (collect best ≥ 0.82)
        if new_fp and rule.merchant_fingerprint:
            ratio = SequenceMatcher(
                None, new_fp, rule.merchant_fingerprint
            ).ratio()
            if ratio >= 0.82:
                if best_fuzzy is None or ratio > best_fuzzy[0]:
                    best_fuzzy = (ratio, rule)

    if best_fuzzy is not None:
        ratio, rule = best_fuzzy
        cat = db.get(Category, rule.category_id)
        if cat is not None:
            _bump_rule(db, rule)
            return (cat.name, int(ratio * 100), "fuzzy")

    return None


def _bump_rule(db: Session, rule) -> None:
    """Increment times_applied and update last_applied_at."""
    rule.times_applied = (rule.times_applied or 0) + 1
    rule.last_applied_at = datetime.utcnow()
    db.commit()
