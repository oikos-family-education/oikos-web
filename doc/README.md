# Oikos Documentation

Welcome to the engineering documentation for **Oikos** — an open source family education platform.

This directory is the single source of truth for how Oikos is built. It is written for two audiences:

1. **Human engineers** joining the project who need to orient quickly.
2. **AI assistants** (Claude Code, etc.) that need grounded context to contribute code safely.

## Where to start

| If you want to... | Read |
|---|---|
| Understand what Oikos is and who it's for | [01-overview.md](01-overview.md) |
| See the high-level system design | [02-architecture.md](02-architecture.md) |
| Know which libraries we use and why | [03-tech-stack.md](03-tech-stack.md) |
| Explore features that are already built | [04-features.md](04-features.md) |
| Understand the database schema | [05-database.md](05-database.md) |
| Work on the FastAPI backend | [06-backend.md](06-backend.md) |
| Work on the Next.js frontend | [07-frontend.md](07-frontend.md) |
| Run, build, test, or deploy locally | [08-development.md](08-development.md) |
| Learn about auth, cookies, rate limiting | [09-security.md](09-security.md) |
| Add or change translations | [10-i18n.md](10-i18n.md) |

## Conventions in these docs

- File paths are relative to the repository root (`/`).
- Code references use `path/to/file.ext:line` where a line number is useful.
- When a doc page lists models, routes, or migrations it is a snapshot — regenerate from source (`app/models/`, `app/routers/`, `alembic/versions/`) if in doubt.

## Related top-level files

- [/README.md](../README.md) — Quickstart for running the app
- [/CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guidelines
- [/CLAUDE.md](../CLAUDE.md) — Project-wide rules enforced by Claude Code
- [/.claude/rules/](../.claude/rules/) — Per-domain rule files (forms, design, i18n, API, security)
- [/PROJECT_PLAN_V1.MD](../PROJECT_PLAN_V1.MD) — Original product plan
- [/specs/](../specs/) — Feature specifications
