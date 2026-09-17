import enum
import uuid
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.modules.auth.models import RefreshToken


class UserStatus(enum.StrEnum):
    pending_profile = "pending_profile"
    active = "active"
    suspended = "suspended"
    shadow_hidden = "shadow_hidden"
    deactivated = "deactivated"
    deleted = "deleted"


class ConsentType(enum.StrEnum):
    terms = "terms"
    privacy = "privacy"
    location = "location"
    marketing = "marketing"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # citext column — case-insensitive, unique phone in E.164 format.
    # BR-21: raw GPS coordinates never stored here.
    phone_e164: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), nullable=False, default=UserStatus.pending_profile
    )
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    consents: Mapped[list["Consent"]] = relationship(
        "Consent", back_populates="user", lazy="selectin"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", lazy="noload"
    )


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (UniqueConstraint("user_id", "consent_type", name="uq_consent_user_type"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_type: Mapped[ConsentType] = mapped_column(
        Enum(ConsentType, name="consent_type"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="consents")


class BlockedPhoneHash(Base):
    """Stores HMAC-SHA256(pepper, phone) hashes of phones blocked under BR-01.
    Never stores the raw phone number — only the hash.
    """

    __tablename__ = "blocked_phone_hashes"

    phone_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    blocked_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
