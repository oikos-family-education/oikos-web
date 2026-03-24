---
globs: apps/web/**/*.tsx, apps/web/**/*.ts
---

# Frontend Conventions

## File structure
- Pages: `apps/web/app/[locale]/<route-group>/<page>/page.tsx`
- Components: `apps/web/components/<feature>/ComponentName.tsx`
- Providers: `apps/web/providers/`
- Shared UI primitives: `packages/ui/` (imported as `@oikos/ui`)
- Shared types: `packages/types/` (imported as `@oikos/types`)

## Page conventions
- All interactive pages use `'use client'` directive
- Every page uses `useTranslations` — no hardcoded user-facing strings
- Dashboard pages wrap content in `<div className="max-w-5xl">`
- Use `useAuth()` from `providers/AuthProvider` for user/family data

## Component conventions
- Named exports (not default exports)
- Props interface defined directly above the component
- `'use client'` only when the component uses hooks or browser APIs
- One component per file

## API calls
- Always `credentials: 'include'` (cookie-based auth, no Authorization headers)
- Base path: `/api/v1/...` (proxied to FastAPI by next.config.js)
- Always check `res.ok` before parsing response
- Use `useState` for loading/error states — no external state library

## State management
- AuthProvider context for auth state (user, family)
- React hooks for local state — no Redux or Zustand
- localStorage for UI preferences only (e.g., sidebar collapsed)

## Routing
- All routes under `app/[locale]/`
- Route groups: `(auth)` (public), `(dashboard)` (protected), `onboarding` (partially protected)
- Protected routes registered in `apps/web/middleware.ts` `PROTECTED_PATHS` array
- Navigation: use `useRouter()` from `next/navigation`
