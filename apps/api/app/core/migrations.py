"""Read-only view of the Alembic script directory (which schema revisions this build knows)."""
import os

from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core.config import settings


def _script_directory() -> ScriptDirectory:
    config = Config(settings.ALEMBIC_INI_PATH)
    # alembic.ini uses a relative script_location; resolve it next to the ini, not the working directory
    location = config.get_main_option("script_location")
    if location and not os.path.isabs(location):
        config.set_main_option(
            "script_location", os.path.join(os.path.dirname(settings.ALEMBIC_INI_PATH), location)
        )
    return ScriptDirectory.from_config(config)


def current_revision() -> str:
    """The head revision this build migrates the database to."""
    return _script_directory().get_current_head()


def known_revisions() -> set[str]:
    return {script.revision for script in _script_directory().walk_revisions()}
