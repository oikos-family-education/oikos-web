from fastapi import HTTPException, status

from app.core.config import settings


def is_desktop() -> bool:
    return settings.APP_MODE == "desktop"


async def require_cloud_mode() -> None:
    """Route dependency: hides cloud-only endpoints (404) when running as the desktop app."""
    if is_desktop():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


async def require_desktop_mode() -> None:
    """Route dependency: hides desktop-only endpoints (404) when running as the cloud service."""
    if not is_desktop():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
