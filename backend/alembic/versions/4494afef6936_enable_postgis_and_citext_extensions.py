"""enable postgis and citext extensions

Revision ID: 4494afef6936
Revises: 
Create Date: 2026-09-16 21:39:19.157267

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4494afef6936'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP EXTENSION IF EXISTS citext")
    # CASCADE: the postgis/postgis base image also auto-installs
    # postgis_topology and postgis_tiger_geocoder, which depend on postgis.
    # Neither is used by the app; this migration only owns the base
    # extension it created.
    op.execute("DROP EXTENSION IF EXISTS postgis CASCADE")
