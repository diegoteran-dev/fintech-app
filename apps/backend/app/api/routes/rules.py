from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user_category_rule import UserCategoryRule
from app.models.category import Category
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("")
def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rules = (
        db.query(UserCategoryRule)
        .filter(UserCategoryRule.user_id == current_user.id)
        .order_by(UserCategoryRule.times_applied.desc(), UserCategoryRule.updated_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "merchant_raw": r.merchant_raw,
            "merchant_fingerprint": r.merchant_fingerprint,
            "transaction_type": r.transaction_type,
            "category": r.category.name if r.category else "Unknown",
            "source": r.source,
            "confidence": r.confidence,
            "times_applied": r.times_applied,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rules
    ]


@router.patch("/{rule_id}")
def update_rule(
    rule_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(UserCategoryRule).filter(
        UserCategoryRule.id == rule_id,
        UserCategoryRule.user_id == current_user.id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    new_category_name = body.get("category")
    if new_category_name:
        cat = db.query(Category).filter(Category.name == new_category_name).first()
        if not cat:
            raise HTTPException(status_code=400, detail=f"Unknown category: {new_category_name}")
        rule.category_id = cat.id

    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "category": rule.category.name}


@router.delete("/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(UserCategoryRule).filter(
        UserCategoryRule.id == rule_id,
        UserCategoryRule.user_id == current_user.id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
