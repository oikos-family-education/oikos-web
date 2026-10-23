from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

def _find_env_file() -> str:
    """Walk up from this file's directory to find the nearest .env."""
    current = Path(__file__).resolve().parent
    for _ in range(6):
        candidate = current / ".env"
        if candidate.exists():
            return str(candidate)
        current = current.parent
    return ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str
    DATABASE_SYNC_URL: str

    # Deployment mode: "cloud" is the hosted service, "desktop" is the packaged local app
    APP_MODE: Literal["cloud", "desktop"] = "cloud"
    APP_VERSION: str = "0.0.0"

    # Redis (optional: unused in desktop mode)
    REDIS_URL: str = ""

    # Desktop mode storage
    SESSIONS_DB_PATH: str = ""
    BACKUP_DIR: str = ""

    # Alembic config, used to stamp backups with the schema revision
    ALEMBIC_INI_PATH: str = str(Path(__file__).resolve().parents[2] / "alembic.ini")

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 365

    # Email
    EMAIL_PROVIDER: str = "resend"
    RESEND_API_KEY: str = ""
    EMAIL_FROM_ADDRESS: str = "no-reply@oikos.family"

    APP_BASE_URL: str = "http://localhost:3000"

settings = Settings()
