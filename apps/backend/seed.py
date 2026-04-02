"""
Seed script — populates vault.db with default categories and sample dev data.
Run from apps/backend/ with the venv activated:
    python seed.py
"""
from datetime import datetime, timedelta, UTC

from app.database import SessionLocal
from app.models import User, Transaction, Category, Account, Budget

DEFAULT_CATEGORIES = [
    # Expense — Needs
    {"name": "Housing",       "icon": "🏠", "color": "#6366F1", "is_system": True},
    {"name": "Groceries",     "icon": "🛒", "color": "#10B981", "is_system": True},
    {"name": "Transport",     "icon": "🚗", "color": "#F59E0B", "is_system": True},
    {"name": "Health",        "icon": "💊", "color": "#EF4444", "is_system": True},
    {"name": "Utilities",     "icon": "💡", "color": "#8B5CF6", "is_system": True},
    # Expense — Wants
    {"name": "Entertainment", "icon": "🎬", "color": "#EC4899", "is_system": True},
    {"name": "Shopping",      "icon": "🛍️",  "color": "#F97316", "is_system": True},
    {"name": "Dining",        "icon": "🍽️",  "color": "#14B8A6", "is_system": True},
    # Savings
    {"name": "Savings",       "icon": "💰", "color": "#22C55E", "is_system": True},
    # Catch-all
    {"name": "Other",         "icon": "📦", "color": "#6B7280", "is_system": True},
    # Income
    {"name": "Salary",            "icon": "💼", "color": "#3B82F6", "is_system": True},
    {"name": "Freelance",         "icon": "💻", "color": "#A855F7", "is_system": True},
    {"name": "Investment Returns", "icon": "📈", "color": "#0EA5E9", "is_system": True},
]


def seed():
    db = SessionLocal()
    try:
        # --- Categories ---
        existing_categories = {c.name for c in db.query(Category).all()}
        for cat_data in DEFAULT_CATEGORIES:
            if cat_data["name"] not in existing_categories:
                db.add(Category(**cat_data))
        db.commit()
        print(f"  ✓ {len(DEFAULT_CATEGORIES)} categories seeded")

        # --- Dev user ---
        dev_user = db.query(User).filter_by(email="dev@vault.local").first()
        if not dev_user:
            dev_user = User(
                email="dev@vault.local",
                full_name="Dev User",
                hashed_password="$2b$12$placeholder_not_real",
                auth_provider="local",
            )
            db.add(dev_user)
            db.commit()
            db.refresh(dev_user)
            print("  ✓ Dev user created (dev@vault.local)")
        else:
            print("  - Dev user already exists")

        # --- Sample account ---
        checking = db.query(Account).filter_by(user_id=dev_user.id, name="Main Checking").first()
        if not checking:
            checking = Account(
                user_id=dev_user.id,
                name="Main Checking",
                institution="Chase",
                account_type="checking",
                currency="USD",
                current_balance=3250.00,
            )
            db.add(checking)
            db.commit()
            db.refresh(checking)
            print("  ✓ Sample checking account created")

        # --- Sample transactions ---
        existing_count = db.query(Transaction).filter_by(user_id=dev_user.id).count()
        if existing_count == 0:
            now = datetime.now(UTC)
            sample_transactions = [
                Transaction(description="Monthly Rent", amount=1200.00, category="Housing",
                            type="expense", date=now - timedelta(days=2), user_id=dev_user.id,
                            account_id=checking.id, merchant="Landlord"),
                Transaction(description="Whole Foods", amount=95.40, category="Groceries",
                            type="expense", date=now - timedelta(days=3), user_id=dev_user.id,
                            account_id=checking.id, merchant="Whole Foods"),
                Transaction(description="Salary", amount=4500.00, category="Salary",
                            type="income", date=now - timedelta(days=1), user_id=dev_user.id,
                            account_id=checking.id),
                Transaction(description="Netflix", amount=15.99, category="Entertainment",
                            type="expense", date=now - timedelta(days=5), user_id=dev_user.id,
                            account_id=checking.id, merchant="Netflix"),
                Transaction(description="Uber", amount=22.50, category="Transport",
                            type="expense", date=now - timedelta(days=4), user_id=dev_user.id,
                            account_id=checking.id, merchant="Uber"),
                Transaction(description="Emergency Fund", amount=500.00, category="Savings",
                            type="expense", date=now - timedelta(days=6), user_id=dev_user.id,
                            account_id=checking.id),
            ]
            db.add_all(sample_transactions)
            db.commit()
            print(f"  ✓ {len(sample_transactions)} sample transactions created")
        else:
            print(f"  - {existing_count} transactions already exist for dev user")

        # --- Sample budgets ---
        existing_budgets = db.query(Budget).filter_by(user_id=dev_user.id).count()
        if existing_budgets == 0:
            housing_cat = db.query(Category).filter_by(name="Housing").first()
            groceries_cat = db.query(Category).filter_by(name="Groceries").first()
            if housing_cat and groceries_cat:
                db.add_all([
                    Budget(user_id=dev_user.id, category_id=housing_cat.id,
                           amount=1200.00, period="monthly"),
                    Budget(user_id=dev_user.id, category_id=groceries_cat.id,
                           amount=300.00, period="monthly"),
                ])
                db.commit()
                print("  ✓ Sample budgets created")

        print("\nSeed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding vault.db...")
    seed()
