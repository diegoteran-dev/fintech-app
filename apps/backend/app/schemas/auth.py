import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    invite_code: str | None = None    # legacy: raw code value
    invite_token: str | None = None   # preferred: one-time opaque token


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    dob: datetime.date | None = None
    country: str | None = None
    is_admin: bool = False
    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    dob: datetime.date | None = None
    country: str | None = None
    full_name: str | None = None
