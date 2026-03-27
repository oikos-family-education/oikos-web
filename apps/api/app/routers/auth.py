from fastapi import APIRouter, Depends, Response, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token, get_current_user, settings
from app.schemas.auth import (
    LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest,
    LoginResponse, MessageResponse
)
from app.services.auth_service import AuthService, check_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service(db: AsyncSession = Depends(get_db)):
    return AuthService(db)

def _is_secure() -> bool:
    return settings.APP_BASE_URL.startswith("https")

def set_auth_cookies(response: Response, user_id: str):
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
    set_auth_cookies(response, str(user.id))
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
    
    user = await service.register_user(req)
    set_auth_cookies(response, str(user.id))
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
    set_auth_cookies(response, str(user.id))
    return LoginResponse(message="Password reset successfully.", user=user)

@router.get("/me", response_model=LoginResponse)
async def get_me(current_user=Depends(get_current_user)):
    return LoginResponse(user=current_user)

@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return MessageResponse(message="Logged out successfully.")

@router.post("/refresh", response_model=MessageResponse)
async def refresh(request: Request, response: Response):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:refresh:{ip}", 30, 900)

    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail={"detail": "Refresh token is missing.", "code": "invalid_refresh_token"})

    from jose import jwt, JWTError
    try:
        payload = jwt.decode(refresh_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=401, detail={"detail": "Refresh token is invalid or expired.", "code": "invalid_refresh_token"})

    secure = _is_secure()
    access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)
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
        value=new_refresh_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    return MessageResponse(message="Token refreshed.")
