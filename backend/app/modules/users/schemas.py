import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.modules.users.models import ConsentType, UserStatus


class ConsentResponse(BaseModel):
    consent_type: ConsentType
    version: str
    granted_at: datetime
    withdrawn_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserMeResponse(BaseModel):
    id: uuid.UUID
    status: UserStatus
    has_dob: bool
    needs_consent: bool
    consents: list[ConsentResponse]

    model_config = {"from_attributes": True}


class SetDobRequest(BaseModel):
    dob: date


class GrantConsentRequest(BaseModel):
    consent_type: ConsentType
    version: str
