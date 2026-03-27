---
name: oikos-security-scan
description: Scan the Oikos codebase for security vulnerabilities and fix them. Use this skill whenever the user mentions "security scan", "find vulnerabilities", "security audit", "check for security issues", "OWASP", "pentest the code", "security review", "check security", "vulnerability scan", "is this secure", "security check", or when the user asks about hardening, securing, or protecting the application. Also trigger when the user mentions specific vulnerability types like SQL injection, XSS, CSRF, authentication bypass, or sensitive data exposure in the context of this codebase.
---

# Oikos Security Scanner

Perform a comprehensive security audit of the Oikos monorepo, covering both the FastAPI backend (`apps/api`) and the Next.js frontend (`apps/web`).

## Scan methodology

Work through each category systematically. For each vulnerability found, report it with:
- **Severity**: Critical / High / Medium / Low
- **Location**: file path and line number
- **Risk**: what an attacker could do
- **Fix**: concrete code change

## 1. Injection vulnerabilities

### SQL Injection (Backend)
Search for raw SQL or string interpolation in database queries:
```bash
# Look for raw SQL, text(), f-strings in queries, string concatenation with queries
```
- Grep for `text(`, `exec(`, `raw(`, `execute(` in `apps/api/`
- Grep for f-strings or `.format(` near `select`, `insert`, `update`, `delete` in Python files
- Check that all SQLAlchemy queries use parameterized `.where()` clauses, not string interpolation
- Safe pattern: `select(Model).where(Model.field == value)` with bound parameters

### XSS (Frontend)
- Grep for `dangerouslySetInnerHTML` in `apps/web/`
- Check for unescaped user input rendered in JSX (e.g., `{userInput}` without sanitization in contexts that could execute scripts)
- Look for `innerHTML` assignments in any JS/TS files

### Command Injection (Backend)
- Grep for `subprocess`, `os.system`, `os.popen`, `eval(`, `exec(` in `apps/api/`
- Check if any user input flows into shell commands

### Path Traversal
- Grep for file operations (`open(`, `os.path.join`, `pathlib`) that use user-supplied paths
- Check for `../` traversal protection

## 2. Authentication & Authorization

### Missing auth on endpoints
- List all route handlers in `apps/api/app/routers/`
- Check each endpoint for `Depends(get_current_user)` — endpoints that modify data or return private data MUST have this
- Public endpoints (login, register, health) are exempt

### JWT cookie configuration
- Read `apps/api/app/core/security.py` and any cookie-setting code
- Verify cookies are set with: `httponly=True`, `secure=True` (for production), `samesite="lax"` or `"strict"`
- Check token expiration is reasonable (access: 15-30 min, refresh: 7-30 days)

### Password handling
- Check bcrypt configuration in security utilities
- Verify minimum password length enforcement (should be >= 10 chars per CLAUDE.md)
- Check for password in logs or error messages

### Token security
- Verify refresh token rotation (old tokens invalidated after use)
- Check that password reset tokens are single-use and time-limited
- Verify tokens are hashed before storage (SHA-256)

## 3. Security misconfiguration

### CORS
- Read `apps/api/app/main.py` for CORS middleware configuration
- Check `allow_origins` — should NOT be `["*"]` in production
- Check `allow_credentials` alignment with origins

### Headers
- Check for security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
- Check Next.js `next.config.js` for security headers configuration

### Exposed secrets
- Grep for hardcoded passwords, API keys, secrets in source code
- Patterns: `password =`, `secret =`, `api_key =`, `token =` with string literals
- Check `.env` files are in `.gitignore`
- Look for secrets in Docker compose or config files committed to git

### Debug mode
- Check if debug mode or verbose error messages could leak in production
- Verify `DEBUG` or development-only settings are environment-controlled

## 4. Sensitive data exposure

### Logging
- Grep for `logger`, `print(`, `console.log` that might log passwords, tokens, or PII
- Check error responses don't leak stack traces or internal details

### API responses
- Check Pydantic response schemas exclude sensitive fields (password hashes, internal IDs that shouldn't be exposed)
- Verify `password` fields are never returned in API responses

### Frontend storage
- Check for sensitive data in `localStorage` or `sessionStorage`
- Verify tokens are only in httpOnly cookies, not accessible via JavaScript

## 5. Input validation

### Backend (Pydantic)
- Check that all router endpoints use Pydantic schemas for request validation
- Look for endpoints accepting raw `dict` or `Any` types
- Verify email validation, length limits on string fields

### Frontend (Zod)
- Check that all forms have Zod validation schemas
- Verify validation covers required fields, format constraints
- Check for client-side only validation without corresponding server-side validation

## 6. Rate limiting

- Verify rate limiting exists on: login, register, password reset, any email-sending endpoints
- Check Redis is properly configured for rate limiting
- Look for endpoints that could be abused without rate limits (e.g., enumeration attacks)

## 7. Dependency vulnerabilities

Run these commands to check for known vulnerabilities:
```bash
# Frontend
cd apps/web && npm audit --json 2>/dev/null | head -50

# Backend
cd apps/api && pip audit 2>/dev/null || echo "pip-audit not installed"
```

## 8. CSRF protection

- Verify state-changing operations use POST/PUT/DELETE (not GET)
- Check SameSite cookie attribute is set
- For cookie-based auth, verify CSRF tokens are used or SameSite is sufficient

## 9. File upload safety

- Grep for file upload handling (`UploadFile`, `multipart`, file write operations)
- If found, check: file type validation, size limits, safe storage path, no execution of uploaded files

## 10. Error handling & information leakage

- Check that 500 errors return generic messages, not stack traces
- Verify database errors are caught and wrapped in generic HTTP errors
- Check that error responses don't reveal whether a user account exists (timing attacks, different messages for "user not found" vs "wrong password")

## Output format

After scanning, present findings as a table sorted by severity:

| # | Severity | Category | Location | Issue | Fix |
|---|----------|----------|----------|-------|-----|
| 1 | Critical | ... | ... | ... | ... |

Then offer to fix all issues, or let the user choose which to fix.
