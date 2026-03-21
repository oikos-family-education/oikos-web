# SPEC-001 — Project Bootstrap & Authentication (Login)

**Project:** Oikos — Open Source Family Education Platform  
**Spec version:** 1.0  
**Status:** Draft  
**Phase:** Phase 0 — Foundation  
**Author:** Oikos Core Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Scope](#2-scope)
3. [Out of Scope](#3-out-of-scope)
4. [Project Structure](#4-project-structure)
5. [Environment Configuration](#5-environment-configuration)
6. [Database Migrations](#6-database-migrations)
7. [Authentication Feature — Login](#7-authentication-feature--login)
8. [Authentication Feature — Forgot Password](#8-authentication-feature--forgot-password)
9. [Authentication Feature — Create Account](#9-authentication-feature--create-account)
10. [Validation Rules](#10-validation-rules)
11. [API Contract](#11-api-contract)
12. [Security Requirements](#12-security-requirements)
13. [Testing Requirements](#13-testing-requirements)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Open Questions](#15-open-questions)

---

## 1. Overview

This spec covers two things delivered together as the true "day zero" of Oikos:

1. **Project bootstrap** — the monorepo skeleton, Docker Compose stack, and database migration system that every subsequent feature depends on.
2. **Authentication flows** — login with email and password, forgot password, and create new account. This is the first user-facing feature and the foundation all other features are gated behind.

Everything specified here must be production-grade from the start. Auth is a trust surface. Security shortcuts taken here become permanent liabilities.

---

## 2. Scope

| Area | Included |
|---|---|
| Monorepo scaffold | Yes |
| Docker Compose (dev + prod profiles) | Yes |
| CI/CD skeleton (GitHub Actions) | Yes |
| Database migration system | Yes |
| Login (email + password) | Yes |
| Forgot password flow (email token) | Yes |
| Create new account (registration) | Yes |
| Form validation (client + server) | Yes |
| JWT / session management | Yes |
| Rate limiting on auth endpoints | Yes |

---

## 3. Out of Scope

The following are explicitly deferred to later specs:

- Social login (Google, Apple)
- Two-factor authentication (2FA)
- Magic link login
- Family profile creation (happens after registration — SPEC-002)
- Role-based access control (RBAC)
- Admin panel

---

## 4. Project Structure

The repository must be initialised as a **Turborepo monorepo** with the following structure. No application code is written outside this structure.

```
oikos/
├── apps/
│   ├── web/                        # Next.js 14 frontend (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── forgot-password/
│   │   │   │       └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   └── auth/
│   │   │       ├── LoginForm.tsx
│   │   │       ├── RegisterForm.tsx
│   │   │       └── ForgotPasswordForm.tsx
│   │   └── package.json
│   │
│   └── api/                        # FastAPI backend
│       ├── alembic/                # Migration engine (see §6)
│       │   ├── versions/           # Migration files live here
│       │   └── env.py
│       ├── app/
│       │   ├── main.py
│       │   ├── core/
│       │   │   ├── config.py       # Settings via pydantic-settings
│       │   │   ├── security.py     # Hashing, JWT utilities
│       │   │   └── database.py     # SQLAlchemy engine + session
│       │   ├── models/
│       │   │   └── user.py         # SQLAlchemy ORM model
│       │   ├── schemas/
│       │   │   └── auth.py         # Pydantic request/response schemas
│       │   ├── routers/
│       │   │   └── auth.py         # /auth/* endpoints
│       │   └── services/
│       │       └── auth_service.py # Business logic
│       ├── tests/
│       │   └── test_auth.py
│       ├── alembic.ini
│       └── requirements.txt
│
├── packages/
│   ├── ui/                         # Shared React component library
│   ├── types/                      # Shared TypeScript types
│   └── config/                     # Shared ESLint, Tailwind, tsconfig
│
├── docs/                           # Documentation (Markdown)
├── scripts/                        # Dev and deployment scripts
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, test, type-check on PR
│       └── migrate.yml             # Run migrations on deploy
├── docker-compose.yml              # Development stack
├── docker-compose.prod.yml         # Production overrides
├── .env.example                    # All required env vars documented
├── turbo.json
└── README.md
```

### 4.1 Technology Versions (pinned)

| Technology | Version |
|---|---|
| Node.js | 20 LTS |
| Next.js | 14.x (App Router) |
| Python | 3.12 |
| FastAPI | 0.111.x |
| SQLAlchemy | 2.0.x |
| Alembic | 1.13.x |
| PostgreSQL | 16 |
| Redis | 7 |

All versions must be pinned exactly in `package.json`, `requirements.txt`, and base Docker images. No floating `latest` tags in production images.

---

## 5. Environment Configuration

A single `.env.example` file at the repository root documents **every** required environment variable. Developers copy this to `.env` to run locally. No variable may be used in code without a corresponding entry in `.env.example` with a comment explaining its purpose.

```dotenv
# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://oikos:oikos@localhost:5432/oikos
# Synchronous URL required by Alembic migration runner
DATABASE_SYNC_URL=postgresql://oikos:oikos@localhost:5432/oikos

# ─── Redis ───────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ─── Auth / JWT ──────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
JWT_SECRET_KEY=replace_me_with_a_real_secret
# Algorithm used for JWT signing (do not change without migration plan)
JWT_ALGORITHM=HS256
# Access token lifetime in minutes
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
# Refresh token lifetime in days
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# ─── Email ────────────────────────────────────────────────────────────────────
# Provider: resend | postmark | smtp
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_replace_me
# "From" address for all system emails
EMAIL_FROM_ADDRESS=no-reply@oikos.family
EMAIL_FROM_NAME=Oikos

# ─── Application ─────────────────────────────────────────────────────────────
# Public base URL — used in email links
APP_BASE_URL=http://localhost:3000
# Environment: development | staging | production
APP_ENV=development
```

---

## 6. Database Migrations

### 6.1 Chosen Tool: Alembic

Oikos uses **Alembic** as its database migration tool. Alembic is to Python/SQLAlchemy what Flyway is to the JVM ecosystem. It provides:

- Versioned, sequential migration scripts
- Auto-generation of migration files from SQLAlchemy model diffs
- An `alembic_version` table in the database tracking applied migrations
- Upgrade and downgrade paths per migration

### 6.2 Migration File Convention

Every migration file must follow this naming and structure convention:

**File name format:**
```
{revision_id}_{YYYY_MM_DD}_{short_description}.py
```

Example:
```
0001_2024_01_15_create_users_table.py
```

**File structure:**
```python
"""create users table

Revision ID: 0001
Revises: None
Create Date: 2024-01-15 10:00:00.000000

Description:
    Initial users table for email/password authentication.
    Stores hashed passwords only. Plain-text passwords are never persisted.
"""

from alembic import op
import sqlalchemy as sa

# ─── Identifiers ─────────────────────────────────────────────────────────────
revision = "0001"
down_revision = None          # None = this is the first migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply this migration."""
    # DDL statements here
    pass


def downgrade() -> None:
    """Roll back this migration."""
    # Reverse DDL statements here
    pass
```

**Rules:**
- Every migration **must** implement both `upgrade()` and `downgrade()`
- Downgrade may raise `NotImplementedError` only for destructive data migrations (with a comment explaining why)
- Migrations are **immutable** once merged to `main`. Never edit a migration that has been applied to any environment. Create a new migration instead.
- Migrations must be **idempotent** where possible (use `checkfirst=True` on index creation, etc.)

### 6.3 Running Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Roll back to a specific revision
alembic downgrade 0001

# Show current applied revision
alembic current

# Show migration history
alembic history --verbose

# Auto-generate a new migration from model changes
alembic revision --autogenerate -m "add reset_token to users"
```

### 6.4 Migrations in Docker / CI

- The API container must **not** run migrations automatically on startup in production. Migrations are run as a separate step before the new container version is started.
- In the development Docker Compose stack, a one-off service `migrate` runs `alembic upgrade head` before the API service starts.
- The GitHub Actions `migrate.yml` workflow runs migrations as a deployment step.

```yaml
# docker-compose.yml (development)
services:
  migrate:
    build: ./apps/api
    command: alembic upgrade head
    depends_on:
      db:
        condition: service_healthy
    env_file: .env

  api:
    build: ./apps/api
    depends_on:
      migrate:
        condition: service_completed_successfully
```

### 6.5 Initial Migration — 0001: Create Users Table

This is the first and only migration delivered in this spec.

**Table: `users`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY, DEFAULT gen_random_uuid() | Never auto-increment integers for user IDs |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | Stored lowercase, trimmed |
| `hashed_password` | `VARCHAR(255)` | NOT NULL | bcrypt hash only; plain text never stored |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT TRUE | False = soft-deleted or suspended |
| `is_verified` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | True after email verification (future spec) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Updated via trigger |
| `last_login_at` | `TIMESTAMPTZ` | NULLABLE | Set on successful login |
| `password_reset_token` | `VARCHAR(255)` | NULLABLE, UNIQUE | Hashed token for forgot-password flow |
| `password_reset_token_expires_at` | `TIMESTAMPTZ` | NULLABLE | Expiry for the reset token |
| `failed_login_attempts` | `INTEGER` | NOT NULL, DEFAULT 0 | For lockout logic |
| `locked_until` | `TIMESTAMPTZ` | NULLABLE | NULL = not locked |

**Indexes:**

```sql
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_password_reset_token ON users (password_reset_token)
  WHERE password_reset_token IS NOT NULL;
CREATE INDEX idx_users_created_at ON users (created_at);
```

**Trigger: `set_updated_at`**

A reusable trigger function is created in the same migration to automatically set `updated_at` on any row update. This function will be reused by all future tables.

```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

---

## 7. Authentication Feature — Login

### 7.1 User Story

> As a registered Oikos user, I want to log in with my email address and password so that I can access my family's dashboard.

### 7.2 UI — Login Page (`/login`)

The login page is a standalone, full-page layout (no sidebar, no navigation) with the following elements, in order:

1. **Oikos logo + wordmark** — centred at the top
2. **Heading** — "Welcome back"
3. **Subheading** — "Sign in to your Oikos account"
4. **Email field** — label "Email address", type `email`, autocomplete `email`
5. **Password field** — label "Password", type `password`, autocomplete `current-password`
   - Toggle to show/hide password (eye icon)
6. **"Forgot your password?"** — right-aligned link below the password field, routes to `/forgot-password`
7. **Submit button** — "Sign in", full width, primary style
8. **Divider** — "Don't have an account?"
9. **Register link** — "Create a free account", routes to `/register`

**States:**

| State | Description |
|---|---|
| Default | Form is empty, submit button enabled |
| Loading | Spinner on button, button disabled, fields disabled |
| Field error | Inline error message under relevant field, field border turns error colour |
| Form error | Banner above the form for non-field errors (e.g. "Invalid email or password") |
| Success | Redirect to `/dashboard` (or the `?redirect` param if present) |
| Account locked | Banner: "Your account has been temporarily locked. Try again in X minutes." |

### 7.3 Flow

```
User fills form
  → Client-side validation passes?
      No  → Show inline field errors, do not submit
      Yes → POST /api/v1/auth/login
              → 200 OK
                  → Store access token (httpOnly cookie)
                  → Store refresh token (httpOnly cookie)
                  → Redirect to /dashboard
              → 401 Unauthorized
                  → Show banner: "Invalid email or password."
                  → Do NOT indicate which field is wrong (prevents enumeration)
              → 423 Locked
                  → Show lockout banner with remaining minutes
              → 422 Validation Error
                  → Map server errors to field errors
              → 429 Too Many Requests
                  → Show banner: "Too many attempts. Please wait before trying again."
              → 5xx
                  → Show banner: "Something went wrong. Please try again."
```

### 7.4 Token Storage

- **Access token**: `httpOnly`, `Secure`, `SameSite=Lax` cookie, 30-minute lifetime
- **Refresh token**: `httpOnly`, `Secure`, `SameSite=Lax` cookie, 30-day lifetime
- Tokens are **never** stored in `localStorage` or `sessionStorage`
- The frontend never reads token values directly; the browser sends them automatically

---

## 8. Authentication Feature — Forgot Password

### 8.1 User Story

> As a user who has forgotten their password, I want to request a reset link by email so that I can regain access to my account.

### 8.2 UI — Forgot Password Page (`/forgot-password`)

1. **Back link** — "← Back to sign in", routes to `/login`
2. **Heading** — "Reset your password"
3. **Subheading** — "Enter your email and we'll send you a reset link."
4. **Email field** — label "Email address", type `email`, autocomplete `email`
5. **Submit button** — "Send reset link", full width
6. **Success state** — Replace the form with a message:
   > "If an account exists for **{email}**, you'll receive a reset link shortly. Check your spam folder if you don't see it."

   **This message is identical whether or not the email exists in the system** (prevents user enumeration).

### 8.3 Reset Link Page (`/reset-password?token={token}`)

1. **Heading** — "Choose a new password"
2. **New password field** — label "New password", type `password`, autocomplete `new-password`
   - Show password strength indicator (weak / fair / strong)
3. **Confirm password field** — label "Confirm new password", type `password`, autocomplete `new-password`
4. **Submit button** — "Reset password"
5. **Success state** — Banner: "Your password has been reset. Signing you in…" → auto-redirect to `/dashboard`
6. **Invalid/expired token state** — Error banner: "This reset link is invalid or has expired. [Request a new one]" → link to `/forgot-password`

### 8.4 Flow

```
User submits email
  → POST /api/v1/auth/forgot-password
      → Always returns 200 (never reveals if email exists)
      → If email found in DB:
          → Generate cryptographically secure random token (32 bytes)
          → Hash the token with SHA-256 before storing in DB
          → Store hashed token + expiry (1 hour from now) on user record
          → Send email with link: {APP_BASE_URL}/reset-password?token={raw_token}
      → If email not found: do nothing, return same 200

User clicks reset link
  → GET /reset-password?token={token}  (frontend page, token passed to API on submit)
  → User submits new password
  → POST /api/v1/auth/reset-password { token, new_password }
      → Hash the incoming token with SHA-256
      → Look up user by hashed token where expires_at > now()
      → Token found and valid?
          → Hash new password
          → Update password, clear token fields, reset failed_login_attempts
          → Return 200, auto-login user (issue tokens)
      → Token not found or expired?
          → Return 400 with error code "invalid_or_expired_token"
```

### 8.5 Reset Token Security

- Tokens are generated using a cryptographically secure random source (`secrets.token_urlsafe(32)` in Python)
- Only the **SHA-256 hash** of the token is stored in the database
- The raw token exists only in the email link and is never logged
- Token expires after **1 hour**
- Token is invalidated after first use (single-use)
- Previous token is overwritten if a new request is made for the same email

---

## 9. Authentication Feature — Create Account

### 9.1 User Story

> As a new user, I want to create an Oikos account with my email address and a password so that I can start setting up my family profile.

### 9.2 UI — Register Page (`/register`)

1. **Back link** — "← Back to sign in", routes to `/login`
2. **Heading** — "Create your account"
3. **Subheading** — "Start equipping your family. Free forever."
4. **First name field** — label "First name", type `text`, autocomplete `given-name`
5. **Last name field** — label "Last name", type `text`, autocomplete `family-name`
6. **Email field** — label "Email address", type `email`, autocomplete `email`
7. **Password field** — label "Password", type `password`, autocomplete `new-password`
   - Password strength meter (visual bar + label)
   - Requirements checklist shown below the field (see §10.3)
8. **Confirm password field** — label "Confirm password", type `password`, autocomplete `new-password`
9. **Terms checkbox** — "I agree to the [Terms of Service] and [Privacy Policy]" (links open in new tab)
10. **Submit button** — "Create account", full width
11. **Sign-in link** — "Already have an account? Sign in", routes to `/login`

**Post-registration:**
- User is automatically signed in (tokens issued)
- Redirected to `/onboarding` (family profile creation — SPEC-002)
- A verification email is sent in the background (future spec will enforce verification)

### 9.3 Flow

```
User fills form
  → Client-side validation passes?
      No  → Show inline field errors
      Yes → POST /api/v1/auth/register
              → 201 Created
                  → Issue access + refresh token cookies
                  → Redirect to /onboarding
              → 409 Conflict
                  → Show field error on email: "An account with this email already exists."
              → 422 Validation Error
                  → Map server errors to field errors
              → 5xx
                  → Show banner: "Something went wrong. Please try again."
```

---

## 10. Validation Rules

All validation is enforced at **two layers**: client-side (immediate feedback) and server-side (authoritative). Server-side validation is the source of truth. Client-side validation is a UX improvement only.

### 10.1 Email

| Rule | Message |
|---|---|
| Required | "Email is required." |
| Must be a valid email format (RFC 5321) | "Please enter a valid email address." |
| Maximum 255 characters | "Email must be 255 characters or fewer." |
| Normalisation: trimmed, lowercased before storage | — |

### 10.2 Password (Login)

| Rule | Message |
|---|---|
| Required | "Password is required." |
| Maximum 128 characters (prevent bcrypt DoS) | "Password must be 128 characters or fewer." |

Note: On login, no complexity rules are shown — the user knows their own password. Rules only apply at registration.

### 10.3 Password (Registration & Reset)

| Rule | Message |
|---|---|
| Required | "Password is required." |
| Minimum 10 characters | "Password must be at least 10 characters." |
| Maximum 128 characters | "Password must be 128 characters or fewer." |
| At least one uppercase letter | "Include at least one uppercase letter." |
| At least one lowercase letter | "Include at least one lowercase letter." |
| At least one number | "Include at least one number." |
| At least one special character (`!@#$%^&*()_+-=[]{}`) | "Include at least one special character." |
| Must not be in the common password list (top 10,000) | "This password is too common. Please choose a different one." |
| Confirm password must match | "Passwords do not match." |

**Password strength labels (for the meter):**

| Criteria | Label | Colour |
|---|---|---|
| < 10 chars or fails any rule | Weak | Red |
| Meets minimum, ≤ 3 complexity rules | Fair | Amber |
| Meets all rules, ≥ 12 chars | Strong | Green |
| Meets all rules, ≥ 16 chars, mixed | Very strong | Green (bold) |

### 10.4 First Name / Last Name (Registration)

| Rule | Message |
|---|---|
| Required | "First name is required." / "Last name is required." |
| Minimum 1 character | — |
| Maximum 100 characters | "Name must be 100 characters or fewer." |
| No leading/trailing whitespace (trimmed silently) | — |

### 10.5 Terms Checkbox (Registration)

| Rule | Message |
|---|---|
| Must be checked | "You must agree to the Terms of Service to create an account." |

### 10.6 General UX Rules

- Errors appear **below** their respective field, in red, with an icon
- Errors are announced to screen readers via `aria-live="polite"` and `aria-describedby`
- Form errors (non-field) appear in a **banner above the form**
- Fields are validated **on blur** (when user leaves the field), not on every keystroke
- The entire form is re-validated on submit before the API call is made
- After a failed submit, errors update in real-time as the user corrects them (live validation kicks in after first submit attempt)

### 10.7 Rate Limiting

| Endpoint | Limit | Window | Action on breach |
|---|---|---|---|
| `POST /auth/login` | 10 attempts | 15 minutes | 429 Too Many Requests |
| `POST /auth/register` | 5 registrations | 1 hour | 429 Too Many Requests |
| `POST /auth/forgot-password` | 3 requests | 1 hour per email | 429 (silent — still shows success message) |
| `POST /auth/reset-password` | 5 attempts | 1 hour per token | 429 Too Many Requests |

**Account lockout (login):**
- After **5 consecutive failed login attempts**: account is locked for **15 minutes**
- After **10 consecutive failed attempts**: account is locked for **1 hour**
- A successful login resets the `failed_login_attempts` counter
- Rate limiting is enforced at the **IP level** (Redis) AND the **account level** (DB column)

---

## 11. API Contract

**Base path:** `/api/v1/auth`

### 11.1 `POST /auth/login`

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "MySecurePass1!"
}
```

**Response 200 OK:**
```json
{
  "user": {
    "id": "uuid",
    "email": "jane@example.com",
    "first_name": "Jane",
    "last_name": "Smith"
  }
}
```
Cookies set: `access_token`, `refresh_token` (httpOnly)

**Response 401:**
```json
{ "detail": "Invalid email or password.", "code": "invalid_credentials" }
```

**Response 423:**
```json
{ "detail": "Account locked.", "code": "account_locked", "locked_until": "2024-01-15T10:30:00Z" }
```

---

### 11.2 `POST /auth/register`

**Request:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "password": "MySecurePass1!",
  "confirm_password": "MySecurePass1!",
  "agreed_to_terms": true
}
```

**Response 201 Created:**
```json
{
  "user": {
    "id": "uuid",
    "email": "jane@example.com",
    "first_name": "Jane",
    "last_name": "Smith"
  }
}
```
Cookies set: `access_token`, `refresh_token` (httpOnly)

**Response 409:**
```json
{ "detail": "A user with this email already exists.", "code": "email_taken" }
```

---

### 11.3 `POST /auth/forgot-password`

**Request:**
```json
{ "email": "jane@example.com" }
```

**Response 200 OK (always, regardless of email existence):**
```json
{ "message": "If that email is registered, a reset link has been sent." }
```

---

### 11.4 `POST /auth/reset-password`

**Request:**
```json
{
  "token": "raw_token_from_email_link",
  "new_password": "NewSecurePass1!",
  "confirm_password": "NewSecurePass1!"
}
```

**Response 200 OK:**
```json
{
  "message": "Password reset successfully.",
  "user": { "id": "uuid", "email": "jane@example.com" }
}
```
Cookies set: `access_token`, `refresh_token` (httpOnly)

**Response 400:**
```json
{ "detail": "This reset token is invalid or has expired.", "code": "invalid_or_expired_token" }
```

---

### 11.5 `POST /auth/logout`

No request body. Clears auth cookies.

**Response 200 OK:**
```json
{ "message": "Logged out successfully." }
```

---

### 11.6 `POST /auth/refresh`

No request body. Uses `refresh_token` cookie to issue a new `access_token`.

**Response 200 OK:**
```json
{ "message": "Token refreshed." }
```
Cookie updated: `access_token`

**Response 401:**
```json
{ "detail": "Refresh token is invalid or expired.", "code": "invalid_refresh_token" }
```

---

## 12. Security Requirements

| Requirement | Implementation |
|---|---|
| Passwords hashed with bcrypt | `passlib[bcrypt]`, work factor 12 |
| JWT signed with HS256 | `python-jose` or `PyJWT` |
| No sensitive data in JWT payload | Only `sub` (user_id) and `exp` |
| Tokens in httpOnly cookies only | Never in body, never in localStorage |
| All endpoints over HTTPS in production | Enforced by nginx / Caddy reverse proxy |
| Reset tokens hashed in DB | SHA-256 via `hashlib` |
| Common password list check | HIBP top-10k list, bundled as a static file |
| SQL injection prevention | SQLAlchemy ORM, parameterised queries only |
| CSRF protection | SameSite=Lax cookies + CSRF token for state-changing requests |
| Sensitive error messages | Never reveal whether email exists (login, forgot-password) |
| Audit logging | All auth events logged: login, logout, failed attempt, password reset |

---

## 13. Testing Requirements

### 13.1 Backend (pytest)

All auth endpoints must have tests covering:

- [ ] Happy path login → 200, cookies set
- [ ] Login with wrong password → 401
- [ ] Login with unknown email → 401 (same response as wrong password)
- [ ] Login with account locked → 423
- [ ] Login increments `failed_login_attempts` on failure
- [ ] Login resets `failed_login_attempts` on success
- [ ] Account locks after 5 consecutive failures
- [ ] Registration happy path → 201, cookies set
- [ ] Registration with existing email → 409
- [ ] Registration with weak password → 422
- [ ] Registration with mismatched passwords → 422
- [ ] Registration without agreeing to terms → 422
- [ ] Forgot password with known email → email sent, 200
- [ ] Forgot password with unknown email → no email sent, same 200
- [ ] Reset password with valid token → 200, password changed, old token cleared
- [ ] Reset password with expired token → 400
- [ ] Reset password with invalid token → 400
- [ ] Reset password with previously used token → 400
- [ ] Rate limiting triggers 429 after threshold
- [ ] Logout clears cookies

### 13.2 Frontend (Vitest + Testing Library)

- [ ] All fields render correctly
- [ ] Required field validation fires on submit
- [ ] Email format validation
- [ ] Password strength meter updates correctly
- [ ] "Show password" toggle works
- [ ] Form disables during loading state
- [ ] API error messages render in correct locations
- [ ] Successful login redirects to `/dashboard`
- [ ] Successful registration redirects to `/onboarding`

---

## 14. Acceptance Criteria

This spec is considered **done** when all of the following are true:

- [ ] Monorepo initialised with Turborepo; `turbo dev` starts both `web` and `api`
- [ ] `docker compose up -d` starts PostgreSQL, Redis, API, and Web with no manual steps
- [ ] Alembic is configured; `alembic upgrade head` runs `0001` migration cleanly against a blank database
- [ ] `alembic downgrade -1` reverses the migration cleanly
- [ ] `.env.example` documents every required variable
- [ ] Login page renders at `/login` with all specified fields and states
- [ ] Forgot password flow sends an email and the link successfully resets the password
- [ ] Registration creates a user and redirects to `/onboarding`
- [ ] All validation rules in §10 are enforced on both client and server
- [ ] All API endpoints return the documented responses
- [ ] Rate limiting prevents brute-force: 10 failed logins in 15 min → 429
- [ ] Account locks after 5 consecutive wrong passwords
- [ ] All backend tests pass (`pytest -v`)
- [ ] All frontend tests pass (`vitest`)
- [ ] GitHub Actions CI pipeline passes on a clean branch (lint + type-check + tests)
- [ ] README contains: project description, prerequisites, `docker compose up` quickstart

---

## 15. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Do we require email verification before a user can access the dashboard? Verification flow is deferred to a later spec, but we need to decide if login is gated on `is_verified`. | Core team | Open |
| 2 | Should the `/register` page include a phone number field now (for future 2FA), or defer entirely? | Core team | Open |
| 3 | What domain and email provider will be used for the first deployed instance? Affects `.env.example` defaults. | Infrastructure | Open |
| 4 | Terms of Service and Privacy Policy — will these be written before launch or placeholder pages? | Legal / Content | Open |
| 5 | Should first name and last name be stored on the `users` table, or only on the `families` / `family_members` table (SPEC-002)? There's an argument for keeping `users` minimal (auth only) and putting names on the profile. | Core team | Open |

---

*This document is part of the Oikos specification series. Next: **SPEC-002 — Family Profile & Onboarding**.*
