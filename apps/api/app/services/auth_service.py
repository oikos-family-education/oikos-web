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

_REFRESH_TTL = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

async def store_refresh_token(user_id: str, token: str) -> None:
    hashed = hash_token(token)
    pipe = redis_client.pipeline()
    pipe.setex(f"rt:{hashed}", _REFRESH_TTL, user_id)
    pipe.sadd(f"rt_user:{user_id}", hashed)
    pipe.expire(f"rt_user:{user_id}", _REFRESH_TTL)
    await pipe.execute()

async def validate_refresh_token(token: str, user_id: str) -> bool:
    hashed = hash_token(token)
    stored = await redis_client.get(f"rt:{hashed}")
    return stored == user_id

async def rotate_refresh_token(old_token: str, new_token: str, user_id: str) -> None:
    old_hashed = hash_token(old_token)
    new_hashed = hash_token(new_token)
    pipe = redis_client.pipeline()
    pipe.delete(f"rt:{old_hashed}")
    pipe.srem(f"rt_user:{user_id}", old_hashed)
    pipe.setex(f"rt:{new_hashed}", _REFRESH_TTL, user_id)
    pipe.sadd(f"rt_user:{user_id}", new_hashed)
    pipe.expire(f"rt_user:{user_id}", _REFRESH_TTL)
    await pipe.execute()

async def revoke_refresh_token(token: str, user_id: str) -> None:
    hashed = hash_token(token)
    pipe = redis_client.pipeline()
    pipe.delete(f"rt:{hashed}")
    pipe.srem(f"rt_user:{user_id}", hashed)
    await pipe.execute()

async def revoke_all_refresh_tokens(user_id: str) -> None:
    hashes = await redis_client.smembers(f"rt_user:{user_id}")
    if hashes:
        pipe = redis_client.pipeline()
        for h in hashes:
            pipe.delete(f"rt:{h}")
        pipe.delete(f"rt_user:{user_id}")
        await pipe.execute()

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
        # Email blacklist (populated by bans) — rejected with a generic error
        from app.services.moderation_service import is_email_blacklisted
        if await is_email_blacklisted(self.db, req.email):
            raise HTTPException(
                status_code=400,
                detail={"detail": "We cannot create an account with this email.", "code": "email_blocked"},
            )

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

        # Block/ban enforcement — auto-lift if a temporary block has expired
        if user.moderation_status == "blocked":
            now = datetime.now(timezone.utc)
            if user.moderation_expires_at and user.moderation_expires_at < now:
                user.moderation_status = "active"
                user.moderation_reason = None
                user.moderation_expires_at = None
                await self.db.commit()
            else:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "detail": f"Your account is blocked. Reason: {user.moderation_reason or 'no reason given'}. Contact support.",
                        "code": "account_blocked",
                    },
                )
        if user.moderation_status == "banned":
            raise HTTPException(
                status_code=403,
                detail={"detail": "Your account is banned.", "code": "account_banned"},
            )

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
        await revoke_all_refresh_tokens(str(user.id))
        return user
