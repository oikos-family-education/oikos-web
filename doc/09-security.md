# 9. Security

Canonical rules live in [.claude/rules/security.md](../.claude/rules/security.md). This page expands on them.

## Authentication

- **JWT access + refresh tokens** issued by FastAPI, HS256, secret in `JWT_SECRET_KEY`.
- Both tokens are stored as **httpOnly, SameSite, Secure cookies**. The frontend never reads or writes them directly.
- The access token has a short TTL (default 30 min); the refresh token has a long TTL (default 30 days) and rotates on use.
- **No Authorization headers anywhere.** Do not add one — it breaks CSRF assumptions and bypasses cookie protections.
- The single server-side source of truth for "who is this request?" is `get_current_user` in [apps/api/app/core/security.py](../apps/api/app/core/security.py).
- All frontend fetches use `credentials: 'include'`.

## Route protection

### Backend
- Any endpoint needing auth adds `current_user: User = Depends(get_current_user)`.
- Family-scoped endpoints should also verify the resource belongs to `current_user.family_id` before returning or mutating.

### Frontend
- [apps/web/middleware.ts](../apps/web/middleware.ts) checks for the `access_token` cookie and redirects to `/login` for any path in `PROTECTED_PATHS`.
- `AuthProvider` performs a second layer of check by calling `/api/v1/auth/me`; on 401 it redirects to `/login`, and on `has_family === false` it redirects to `/onboarding/family`.
- **When you add a protected page, add its path to `PROTECTED_PATHS`.**

## Password handling

- Hashed with **bcrypt** via `passlib.CryptContext`.
- Minimum length **10 characters** (validated on the frontend via Zod and on the backend).
- Reset tokens are generated with `secrets.token_urlsafe(32)`, stored as SHA-256 hashes, and expire after 1 hour.

## Rate limiting & account lockout

- Redis-backed sliding windows on auth endpoints:
  - `/auth/login` ~ 10 / 15 min
  - `/auth/register` ~ 5 / hour
  - `/auth/forgot-password` and `/auth/reset-password` ~ 5 / hour
- Repeated failed logins increment `users.failed_login_attempts` and eventually set `users.locked_until`.
- Frontend handles:
  - `401` — credentials invalid.
  - `423` — account locked.
  - `429` — rate limited (back off and retry).

## CORS

- Origins configured in `Settings.CORS_ORIGINS`. Default in dev: `http://localhost:3000`.
- In production, set exact origins. Do not use `*` with credentials.

## Secrets

- Never commit `.env` files.
- Config loaded via `pydantic-settings` in [apps/api/app/core/config.py](../apps/api/app/core/config.py).
- Required env: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`.

## Common mistakes to avoid

- **Do not** serialise the ORM `User` model directly into a response — always use a Pydantic schema that excludes `hashed_password`.
- **Do not** trust a `family_id` passed by the client in a request body. Resolve it from `current_user`.
- **Do not** write raw SQL with user input. Use SQLAlchemy core/ORM binding.
- **Do not** add a "remember me" or "stay signed in" flag by extending access-token TTL. Rely on the refresh token.
- **Do not** log full request bodies or cookies.
- **Do not** return different messages for "email not found" vs "password wrong" on login.

## Security reviews

Run the `/security-review` or `/oikos-security-scan` skill before shipping a large change. They check for common OWASP issues and mis-scoped data access.
