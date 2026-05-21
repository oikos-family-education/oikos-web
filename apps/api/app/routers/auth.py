from fastapi import APIRouter, Depends, Response, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token, get_current_user, settings
from app.schemas.auth import (
    LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest,
    LoginResponse, MessageResponse
)
from app.services.auth_service import (
    AuthService, check_rate_limit,
    store_refresh_token, validate_refresh_token, rotate_refresh_token, revoke_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service(db: AsyncSession = Depends(get_db)):
    return AuthService(db)

def _is_secure() -> bool:
    return settings.APP_BASE_URL.startswith("https")

def set_auth_cookies(response: Response, user_id: str) -> str:
    """Set auth cookies and return the raw refresh token for Redis storage."""
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    secure = _is_secure()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    return refresh_token

@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    response: Response,
    req: LoginRequest,
    service: AuthService = Depends(get_auth_service)
):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:login:{ip}", 10, 900)
    
    user = await service.authenticate_user(req)
    refresh_token = set_auth_cookies(response, str(user.id))
    await store_refresh_token(str(user.id), refresh_token)
    return LoginResponse(user=user)

@router.post("/register", response_model=LoginResponse, status_code=201)
async def register(
    request: Request,
    response: Response,
    req: RegisterRequest,
    service: AuthService = Depends(get_auth_service)
):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:register:{ip}", 5, 3600)

    # If an invite token is supplied, validate it BEFORE creating the user.
    # The submitted email must match the application's email.
    if req.invite_token:
        from app.services.beta_service import find_application_by_invite_token
        from datetime import datetime as _dt, timezone as _tz

        app = await find_application_by_invite_token(service.db, req.invite_token)
        if not app:
            raise HTTPException(status_code=400, detail={"detail": "Invite link is invalid.", "code": "invite_invalid"})
        if app.invite_consumed_at is not None:
            raise HTTPException(status_code=400, detail={"detail": "Invite link has already been used.", "code": "invite_used"})
        if app.invite_token_expires_at and app.invite_token_expires_at < _dt.now(_tz.utc):
            raise HTTPException(status_code=400, detail={"detail": "Invite link has expired.", "code": "invite_expired"})
        if req.email.lower() != app.email.lower():
            raise HTTPException(status_code=400, detail={"detail": "Email does not match the invite.", "code": "invite_email_mismatch"})

    user = await service.register_user(req)

    if req.invite_token:
        from app.services.beta_service import consume_invite_token
        await consume_invite_token(service.db, raw_token=req.invite_token, user=user)

    refresh_token = set_auth_cookies(response, str(user.id))
    await store_refresh_token(str(user.id), refresh_token)
    return LoginResponse(user=user)

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    service: AuthService = Depends(get_auth_service)
):
    # Silent rate limit: return 200 even if limited to prevent enumeration
    try:
        ip = request.client.host if request.client else "127.0.0.1"
        await check_rate_limit(f"ratelimit:forgot:{req.email}", 3, 3600)
        await service.forgot_password(req)
    except HTTPException as e:
        if e.status_code == 429:
            pass # Silent limit
        else:
            raise e
    
    return MessageResponse(message="If that email is registered, a reset link has been sent.")

@router.post("/reset-password", response_model=LoginResponse)
async def reset_password(
    request: Request,
    response: Response,
    req: ResetPasswordRequest,
    service: AuthService = Depends(get_auth_service)
):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:reset:{ip}", 5, 3600)
    
    user = await service.reset_password(req)
    refresh_token = set_auth_cookies(response, str(user.id))
    await store_refresh_token(str(user.id), refresh_token)
    return LoginResponse(message="Password reset successfully.", user=user)

@router.get("/me", response_model=LoginResponse)
async def get_me(current_user=Depends(get_current_user)):
    return LoginResponse(user=current_user)

@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    token = request.cookies.get("refresh_token")
    if token:
        await revoke_refresh_token(token, str(current_user.id))
    secure = _is_secure()
    response.delete_cookie("access_token", path="/", samesite="strict", secure=secure, httponly=True)
    response.delete_cookie("refresh_token", path="/", samesite="strict", secure=secure, httponly=True)
    return MessageResponse(message="Logged out successfully.")

@router.post("/refresh", response_model=MessageResponse)
async def refresh(request: Request, response: Response):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:refresh:{ip}", 30, 900)

    old_refresh_token = request.cookies.get("refresh_token")
    if not old_refresh_token:
        raise HTTPException(status_code=401, detail={"detail": "Refresh token is missing.", "code": "invalid_refresh_token"})

    from jose import jwt, JWTError
    try:
        payload = jwt.decode(old_refresh_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=401, detail={"detail": "Refresh token is invalid or expired.", "code": "invalid_refresh_token"})

    if not await validate_refresh_token(old_refresh_token, user_id):
        raise HTTPException(status_code=401, detail={"detail": "Refresh token has been revoked.", "code": "invalid_refresh_token"})

    new_refresh_token = set_auth_cookies(response, user_id)
    await rotate_refresh_token(old_refresh_token, new_refresh_token, user_id)
    return MessageResponse(message="Token refreshed.")
