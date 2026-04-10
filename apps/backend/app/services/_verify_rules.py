"""
_verify_rules.py
================
Inline tests for the per-user categorization rule memory system.
No pytest needed — run directly:

  cd apps/backend && python -m app.services._verify_rules

Exits with code 1 on any failure.
"""
from __future__ import annotations
import sys


def run() -> None:
    from app.services.categorization import extract_fingerprint, save_user_rule, get_user_category

    failures = 0

    # ── 1. extract_fingerprint (pure function, no DB) ─────────────────────────
    print("\n=== extract_fingerprint ===")

    def fp_check(desc: str, expected_contains: str) -> None:
        nonlocal failures
        result = extract_fingerprint(desc)
        if expected_contains.lower() in result.lower():
            print(f"  OK   {desc[:65]!r}\n       → {result!r}")
        else:
            print(f"  FAIL {desc[:65]!r}\n       → {result!r}"
                  f"\n       expected to contain: {expected_contains!r}")
            failures += 1

    fp_check(
        "COMPRA INTERNET EXT APPLE.COM/BILL 866-712-7753 US",
        "apple.com/bill",
    )
    fp_check(
        "DEBITO ACH QR Nota: FARMACORP S.A.-SUC 199 SANTA CRUZ BO 10630056",
        "farmacorp",
    )
    fp_check(
        "NETFLIX.COM 844-5052993 US",
        "netflix.com",
    )
    fp_check(
        "LUJAN PATRICIA ZAMBRANA SANDOVAL VDA.DE",
        "lujan patricia",
    )
    fp_check(
        "FREDYJOB MENGOA MONTES DE OCA (B. SOL)",
        "fredyjob mengoa",
    )

    # Both noisy Apple descriptions should produce the SAME fingerprint
    fp1 = extract_fingerprint("COMPRA INTERNET EXT APPLE.COM/BILL 866-712-7753 US")
    fp2 = extract_fingerprint("DEBITO POS APPLE.COM/BILL 855-999-1234 US")
    if fp1 == fp2:
        print(f"  OK   Two Apple descriptions → same fingerprint: {fp1!r}")
    else:
        print(f"  FAIL Apple fingerprints differ: {fp1!r} vs {fp2!r}")
        failures += 1

    # Empty description → empty fingerprint
    result_empty = extract_fingerprint("")
    if result_empty == "":
        print("  OK   empty description → empty fingerprint")
    else:
        print(f"  FAIL empty description → {result_empty!r} (expected '')")
        failures += 1

    # ── 2. DB-backed tests (in-memory SQLite) ─────────────────────────────────
    print("\n=== Rule persistence (in-memory DB) ===")

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    import app.models  # noqa: F401 — registers all models with metadata

    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    from app.models.user import User
    from app.models.category import Category
    from app.models.user_category_rule import UserCategoryRule

    # Seed test user and categories
    test_user = User(email="test@example.com", hashed_password="x", full_name="Test")
    db.add(test_user)
    db.flush()

    cat_ent = Category(name="Entertainment", is_system=True)
    cat_sal = Category(name="Salary", is_system=True)
    cat_groc = Category(name="Groceries", is_system=True)
    db.add_all([cat_ent, cat_sal, cat_groc])
    db.flush()

    # ── 2a. save_user_rule inserts a row ──────────────────────────────────────
    save_user_rule(
        db, test_user.id,
        "COMPRA INTERNET EXT APPLE.COM/BILL 866-712-7753 US",
        "Entertainment", "manual_create",
    )
    row_count = (
        db.query(UserCategoryRule)
        .filter(UserCategoryRule.user_id == test_user.id)
        .count()
    )
    if row_count == 1:
        print("  OK   save_user_rule() inserted 1 rule")
    else:
        print(f"  FAIL save_user_rule() inserted {row_count} rules (expected 1)")
        failures += 1

    # ── 2b. Same merchant, different noise → same fingerprint → upsert ────────
    # "DEBITO POS APPLE.COM/BILL 855-999-1234 US" → fingerprint "apple.com/bill us"
    # Same as the rule stored above → should UPDATE, not INSERT
    save_user_rule(
        db, test_user.id,
        "DEBITO POS APPLE.COM/BILL 855-999-1234 US",
        "Entertainment", "manual_edit",
    )
    row_count2 = (
        db.query(UserCategoryRule)
        .filter(UserCategoryRule.user_id == test_user.id)
        .count()
    )
    if row_count2 == 1:
        print("  OK   save_user_rule() same fingerprint → updated (still 1 row)")
    else:
        print(
            f"  FAIL save_user_rule() same fingerprint → {row_count2} rows "
            f"(expected 1 — upsert failed)"
        )
        failures += 1

    # ── 2c. get_user_category — fingerprint match ─────────────────────────────
    # Different phone number, different noise → same fingerprint "apple.com/bill us"
    match = get_user_category(
        db, test_user.id, "COMPRA APPLE.COM/BILL 877-000-0000 US"
    )
    if match and match[0] == "Entertainment" and match[2] in ("exact", "fingerprint"):
        print(f"  OK   get_user_category() fingerprint match → {match}")
    else:
        print(
            f"  FAIL get_user_category() → {match} "
            f"(expected ('Entertainment', 100, 'fingerprint'))"
        )
        failures += 1

    # ── 2d. get_user_category — no rules for user → None ─────────────────────
    other_user = User(
        email="other@example.com", hashed_password="x", full_name="Other"
    )
    db.add(other_user)
    db.flush()
    match2 = get_user_category(
        db, other_user.id, "COMPRA APPLE.COM/BILL 877-000-0000 US"
    )
    if match2 is None:
        print("  OK   get_user_category() — no rules for user → None")
    else:
        print(
            f"  FAIL get_user_category() — should return None for user "
            f"with no rules, got {match2}"
        )
        failures += 1

    # ── 2e. get_user_category — unknown description → None ───────────────────
    match3 = get_user_category(
        db, test_user.id, "ZXQW COMPLETELY UNKNOWN MERCHANT 99999999"
    )
    if match3 is None:
        print("  OK   get_user_category() — unknown description → None")
    else:
        print(
            f"  FAIL get_user_category() — unknown desc should return None, got {match3}"
        )
        failures += 1

    # ── 2f. Fuzzy match (≥ 0.82) ─────────────────────────────────────────────
    # Store: "FARMACORP S.A.-SUC 199 SANTA CRUZ BO 10630056" via Nota
    save_user_rule(
        db, test_user.id,
        "DEBITO ACH QR Nota: FARMACORP S.A.-SUC 199 SANTA CRUZ BO 10630056",
        "Groceries", "manual_create",
    )
    # Query: same merchant, stripped of "nota:" context — fingerprint should be close
    match4 = get_user_category(
        db, test_user.id, "COMPRA POS FARMACORP S.A. SANTA CRUZ BO"
    )
    if match4 and match4[0] == "Groceries":
        print(f"  OK   get_user_category() fuzzy/fingerprint match → {match4}")
    else:
        print(
            f"  FAIL get_user_category() fuzzy match → {match4} (expected Groceries)"
        )
        failures += 1

    # ── 2g. Empty description → None ─────────────────────────────────────────
    match5 = get_user_category(db, test_user.id, "")
    if match5 is None:
        print("  OK   get_user_category() empty description → None")
    else:
        print(f"  FAIL get_user_category() empty description → {match5}")
        failures += 1

    # ── 2h. times_applied increments on match ────────────────────────────────
    rule = (
        db.query(UserCategoryRule)
        .filter(UserCategoryRule.user_id == test_user.id)
        .order_by(UserCategoryRule.id)
        .first()
    )
    if rule and rule.times_applied >= 1:
        print(f"  OK   times_applied incremented → {rule.times_applied}")
    else:
        print(f"  FAIL times_applied not incremented (got {rule.times_applied if rule else 'None'})")
        failures += 1

    db.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*40}")
    if failures == 0:
        print("ALL CHECKS PASSED ✓")
    else:
        print(f"{failures} CHECK(S) FAILED ✗")
        sys.exit(1)


if __name__ == "__main__":
    run()
