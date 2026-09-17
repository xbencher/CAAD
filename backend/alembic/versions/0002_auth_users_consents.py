"""Create users, refresh_tokens, consents, blocked_phone_hashes tables.

Revision ID: 0002
Revises: 4494afef6936
Create Date: 2026-09-16
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002"
down_revision = "4494afef6936"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enum types (raw SQL so create_table doesn't try to auto-create them) ─
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE user_status AS ENUM (
                'pending_profile','active','suspended',
                'shadow_hidden','deactivated','deleted'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE consent_type AS ENUM (
                'terms','privacy','location','marketing'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # citext for case-insensitive phone storage
        sa.Column(
            "phone_e164",
            sa.String(20),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending_profile",
                "active",
                "suspended",
                "shadow_hidden",
                "deactivated",
                "deleted",
                name="user_status",
                create_type=False,
            ),
            nullable=False,
            server_default="pending_profile",
        ),
        sa.Column("dob", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("phone_e164", name="uq_users_phone_e164"),
    )
    op.create_index("ix_users_phone_e164", "users", ["phone_e164"])

    # ── refresh_tokens ────────────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(200), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "replaced_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("refresh_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])

    # ── consents ──────────────────────────────────────────────────────────────
    op.create_table(
        "consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "consent_type",
            postgresql.ENUM(
                "terms",
                "privacy",
                "location",
                "marketing",
                name="consent_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "consent_type", name="uq_consent_user_type"),
    )
    op.create_index("ix_consents_user_id", "consents", ["user_id"])

    # ── blocked_phone_hashes ──────────────────────────────────────────────────
    op.create_table(
        "blocked_phone_hashes",
        sa.Column("phone_hash", sa.Text(), primary_key=True),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("blocked_phone_hashes")
    op.drop_index("ix_consents_user_id", table_name="consents")
    op.drop_table("consents")
    op.drop_index("ix_refresh_tokens_family_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_users_phone_e164", table_name="users")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS consent_type")
    op.execute("DROP TYPE IF EXISTS user_status")
