"""Users router — thin HTTP layer. Business logic lives in service.py."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.modules.auth.deps import get_current_user
from app.modules.users import service as svc
from app.modules.users.models import ConsentType, User
from app.modules.users.schemas import (
    ConsentResponse,
    GrantConsentRequest,
    SetDobRequest,
    UserMeResponse,
)

router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserMeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> UserMeResponse:
    return await svc.get_user_me(current_user, settings)


@router.post("/users/me/dob", status_code=status.HTTP_204_NO_CONTENT)
async def set_dob(
    body: SetDobRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    await svc.set_dob(current_user, body.dob, session, settings)


@router.post("/users/me/consents", response_model=ConsentResponse, status_code=status.HTTP_200_OK)
async def grant_consent(
    body: GrantConsentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ConsentResponse:
    return await svc.grant_consent(current_user, body.consent_type, body.version, session)


@router.delete(
    "/users/me/consents/{consent_type}", status_code=status.HTTP_204_NO_CONTENT
)
async def withdraw_consent(
    consent_type: ConsentType,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await svc.withdraw_consent(current_user.id, consent_type, session)


@router.get("/users/me/consents", response_model=list[ConsentResponse])
async def list_consents(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ConsentResponse]:
    return await svc.list_consents(current_user.id, session)
