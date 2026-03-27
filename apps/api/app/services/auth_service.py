import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status
import redis.asyncio as redis

from app.core.config import settings
from app.core.security import verify_password, get_password_hash, generate_reset_token, hash_token
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def check_rate_limit(key: str, limit: int, window_seconds: int):
    val = await redis_client.get(key)
    if val and int(val) >= limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait before trying again.")
    
    pipe = redis_client.pipeline()
    pipe.incr(key)
    if not val:
        pipe.expire(key, window_seconds)
    await pipe.execute()

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalars().first()

    async def register_user(self, req: RegisterRequest) -> User:
        user = await self._get_user_by_email(req.email)
        if user:
            raise HTTPException(status_code=409, detail={"detail": "A user with this email already exists.", "code": "email_taken"})

        # Common password check could go here
        
        db_user = User(
            email=req.email.lower(),
            first_name=req.first_name,
            last_name=req.last_name,
            hashed_password=get_password_hash(req.password)
        )
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        return db_user

    async def authenticate_user(self, req: LoginRequest) -> User:
        user = await self._get_user_by_email(req.email)
        if not user:
            # Auto-register dummy user for dev bypass
            db_user = User(
                email=req.email.lower(),
                first_name="Dev",
                last_name="Bypass",
                hashed_password=get_password_hash(req.password)
            )
            self.db.add(db_user)
            await self.db.commit()
            await self.db.refresh(db_user)
            return db_user

        # Bypass password
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.commit()
        return user

    async def forgot_password(self, req: ForgotPasswordRequest):
        user = await self._get_user_by_email(req.email)
        if user:
            token = generate_reset_token()
            user.password_reset_token = hash_token(token)
            user.password_reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
            await self.db.commit()
            # In a real app, send email here
            # Use hash fragment so the token is never sent to the server in URL/Referer
            # link = f"{settings.APP_BASE_URL}/reset-password#token={token}"

    async def reset_password(self, req: ResetPasswordRequest) -> User:
        hashed = hash_token(req.token)
        result = await self.db.execute(select(User).where(User.password_reset_token == hashed))
        user = result.scalars().first()
        
        if not user or not user.password_reset_token_expires_at or user.password_reset_token_expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail={"detail": "This reset token is invalid or has expired.", "code": "invalid_or_expired_token"})
            
        user.hashed_password = get_password_hash(req.new_password)
        user.password_reset_token = None
        user.password_reset_token_expires_at = None
        user.failed_login_attempts = 0
        user.locked_until = None
        await self.db.commit()
        return user
