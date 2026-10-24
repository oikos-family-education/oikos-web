from fastapi import HTTPException, Request, status

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


async def require_desktop_origin(request: Request) -> None:
    """Route dependency for the unauthenticated desktop endpoints: refuse cross-site requests (CSRF).

    A page on another site can send a simple form POST to 127.0.0.1 without a CORS preflight, and
    its Host header is legitimate; the browser's Origin header is what tells it apart."""
    if request.headers.get("origin") not in settings.DESKTOP_ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "Request must come from the Oikos app.", "code": "bad_origin"},
        )
