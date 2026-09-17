import uuid

from pydantic import BaseModel

from app.modules.users.models import UserStatus


class OtpRequestBody(BaseModel):
    phone: str


class OtpVerifyBody(BaseModel):
    phone: str
    code: str
    device_id: str


class RefreshBody(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class OtpVerifyResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user_status: UserStatus
    user_id: uuid.UUID
