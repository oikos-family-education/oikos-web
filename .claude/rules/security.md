---
globs: apps/api/**/*.py, apps/web/middleware.ts, apps/web/providers/**/*.tsx
---

# Security Conventions

## Authentication
- JWT tokens in httpOnly cookies (`access_token`, `refresh_token`)
- NO Authorization headers — auth is entirely cookie-based
- `get_current_user` dependency in `app/core/security.py` validates cookies
- Frontend uses `credentials: 'include'` on all API fetches

## Protected routes (frontend)
- Middleware (`apps/web/middleware.ts`) checks for `access_token` cookie
- New protected routes must be added to the `PROTECTED_PATHS` array
- AuthProvider redirects to `/login` if `/api/v1/auth/me` fails
- AuthProvider redirects to `/onboarding/family` if `user.has_family` is false

## Rate limiting
- Redis-backed rate limiting on auth endpoints
- Handle 429 (Too Many Requests) in frontend error handling
- Handle 423 (Account Locked) for repeated login failures

## Secrets
- Never commit `.env` files
- Config loaded via pydantic-settings in `app/core/config.py`
- JWT secret, DATABASE_URL, REDIS_URL are environment variables

## Password handling
- bcrypt hashing via passlib CryptContext
- Minimum 10 characters
- Reset tokens: `secrets.token_urlsafe(32)`, hashed with SHA-256, 1-hour expiry
