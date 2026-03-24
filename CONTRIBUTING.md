# Contributing to Oikos

Thank you for your interest in contributing to Oikos! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/oikos-web.git
   cd oikos-web
   ```
3. **Set up** the development environment by following the [README](README.md#getting-started).
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. Make sure all services are running (see [README](README.md#getting-started)).
2. Make your changes in the appropriate package or app.
3. Write or update tests for your changes.
4. Run the full test and lint suite before submitting:
   ```bash
   npm run lint
   npm run type-check
   npm run test
   ```
5. For API changes, also run:
   ```bash
   cd apps/api && pytest
   ```

## Coding Standards

### Frontend (TypeScript / React)

- Use **named exports** (not default exports).
- One component per file.
- All interactive pages use the `'use client'` directive.
- All user-facing strings must use `next-intl` translations (never hardcode text).
- Forms use `react-hook-form` + `zod` validation.
- Use components from `@oikos/ui` for buttons, inputs, and cards.
- Icons from `lucide-react` only.
- Follow the design system tokens (see `.claude/rules/design-system.md`).

### Backend (Python / FastAPI)

- Follow the layered architecture: **routers** (thin) -> **services** (logic) -> **models** (ORM).
- Use async SQLAlchemy with `asyncpg`.
- Pydantic v2 schemas for all request/response models.
- UUID primary keys, `created_at`/`updated_at` timestamps on all models.
- Use `HTTPException` for error responses.

### General

- Keep changes focused. One feature or fix per PR.
- Write tests for new functionality.
- Do not commit `.env` files or secrets.

## Commit Messages

Use clear, descriptive commit messages. We follow a conventional style:

```
type: short description

Optional longer description explaining the "why" behind the change.
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**
```
feat: add password reset flow
fix: prevent duplicate family creation on retry
docs: update API authentication section
refactor: extract email service from auth router
test: add tests for child profile CRUD
```

## Pull Requests

1. **Keep PRs small and focused.** Large PRs are harder to review.
2. **Fill out the PR template** with a summary and test plan.
3. **Link related issues** using `Closes #123` in the PR description.
4. **All CI checks must pass** before a PR can be merged.
5. **Request a review** from a maintainer.

### PR Checklist

- [ ] Changes are focused on a single feature or fix
- [ ] Tests added or updated
- [ ] Lint and type-check pass
- [ ] User-facing strings use i18n translations
- [ ] No secrets or `.env` files committed
- [ ] PR description explains the "why"

## Reporting Issues

Use the [GitHub issue templates](https://github.com/oikos-family/oikos-web/issues/new/choose) to report bugs or request features. Please include:

- **Bug reports:** Steps to reproduce, expected vs actual behavior, environment details.
- **Feature requests:** Problem statement, proposed solution, alternatives considered.

## Questions?

If you have questions about contributing, open a [Discussion](https://github.com/oikos-family/oikos-web/discussions) or reach out in an existing issue.

Thank you for helping make Oikos better!
