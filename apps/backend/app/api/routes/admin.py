import os
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.app_settings import AppSetting
from app.models.invite_token import InviteToken
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

INVITE_CODE_KEY = "invite_code"
TOKEN_TTL_DAYS = 7


def _require_admin(current_user: User):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")


def _get_or_create_invite(db: Session) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == INVITE_CODE_KEY).first()
    if not row:
        code = secrets.token_urlsafe(12)
        db.add(AppSetting(key=INVITE_CODE_KEY, value=code))
        db.commit()
        return code
    return row.value


@router.get("/invite")
def get_invite(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    code = _get_or_create_invite(db)
    return {"invite_code": code}


@router.post("/invite/rotate")
def rotate_invite(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    code = secrets.token_urlsafe(12)
    row = db.query(AppSetting).filter(AppSetting.key == INVITE_CODE_KEY).first()
    if row:
        row.value = code
    else:
        db.add(AppSetting(key=INVITE_CODE_KEY, value=code))
    db.commit()
    return {"invite_code": code}


@router.post("/invite/token")
def generate_invite_link(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a one-time invite link. The token is opaque and never exposes the raw invite code."""
    _require_admin(current_user)
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)
    db.add(InviteToken(token=token, expires_at=expires))
    db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "https://vault-by-diego.vercel.app")
    return {"url": f"{frontend_url}/?t={token}", "expires_in_days": TOKEN_TTL_DAYS}
