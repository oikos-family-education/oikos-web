import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.desktop import RestoreResponse
from app.services.auth_service import check_rate_limit, clear_all_sessions
from app.services.backup.importer import BackupError, restore_backup

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/desktop", tags=["desktop"])


@router.post("/restore", response_model=RestoreResponse)
async def restore(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Replace all data on this computer with a .oikos backup. Runs before anyone is logged in."""
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:restore:{ip}", 10, 3600)

    data = await file.read()
    try:
        emails = await restore_backup(db, data)
    except BackupError as exc:
        raise HTTPException(status_code=400, detail={"detail": exc.message, "code": exc.code})
    except Exception:
        # The restore rolled back, so nothing has changed
        logger.exception("Backup restore failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "The backup could not be restored. Nothing was changed.", "code": "restore_failed"},
        )
    await clear_all_sessions()
    return RestoreResponse(emails=emails)
