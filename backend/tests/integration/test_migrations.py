from alembic import command
from tests.conftest import _alembic_config


def test_migrations_upgrade_downgrade_upgrade_cleanly() -> None:
    config = _alembic_config()
    command.downgrade(config, "base")
    command.upgrade(config, "head")
