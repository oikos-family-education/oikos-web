from fastapi import APIRouter, Depends, Request, Response

from app.routers.auth import get_auth_service, set_auth_cookies
from app.schemas.auth import LocalResetPasswordRequest, LoginResponse
from app.services.auth_service import AuthService, check_rate_limit, store_refresh_token

router = APIRouter(prefix="/auth", tags=["auth-local"])


@router.post("/local-reset-password", response_model=LoginResponse)
async def local_reset_password(
    request: Request,
    response: Response,
    req: LocalResetPasswordRequest,
    service: AuthService = Depends(get_auth_service),
):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:localreset:{ip}", 5, 3600)

    user = await service.local_reset_password(req)
    refresh_token = set_auth_cookies(response, str(user.id))
    await store_refresh_token(str(user.id), refresh_token)
    return LoginResponse(message="Password reset successfully.", user=user)
