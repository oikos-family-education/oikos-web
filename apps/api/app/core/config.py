import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DATABASE_SYNC_URL: str
    
    # Redis
    REDIS_URL: str
    
    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Email
    EMAIL_PROVIDER: str = "resend"
    RESEND_API_KEY: str = ""
    EMAIL_FROM_ADDRESS: str = "no-reply@oikos.family"
    
    APP_BASE_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        # We also want to support env vars natively in CI/docker without .env file
        env_file_encoding = "utf-8"

settings = Settings()
