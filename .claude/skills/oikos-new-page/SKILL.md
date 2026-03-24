---
name: oikos-new-page
description: Scaffold a new frontend page in the Oikos web app following project conventions (locale routing, i18n, responsive layout, auth protection). Use this skill whenever the user wants to add a new page, replace a placeholder page, or create a new route in apps/web. Trigger on phrases like "add a page", "create a page", "new page for X", "implement the X page", "replace the placeholder for X", "build the X feature page", or when the user describes a new feature that clearly needs a frontend page.
---

# Oikos New Page Scaffolder

All pages live under `apps/web/app/[locale]/` using Next.js App Router with locale-based routing.

## Route groups

| Group | Path | Purpose | Auth required? |
|-------|------|---------|----------------|
| `(auth)` | `app/[locale]/(auth)/` | Login, register, password flows | No |
| `(dashboard)` | `app/[locale]/(dashboard)/` | All protected dashboard pages | Yes (AuthProvider in layout) |
| `onboarding` | `app/[locale]/onboarding/` | Family/children setup | Partial (logged in but no family) |

## Step 1: Clarify before writing

Ask the user if anything is unclear:
- What is the page name/route? (e.g., `disciplines`, `journal`)
- Is it a dashboard page (protected), auth page, or standalone?
- Is it replacing an existing placeholder? Check `apps/web/app/[locale]/(dashboard)/<name>/page.tsx` first.
- What data does it need? (API endpoints, local state)
- Does it need new translation keys?

## Step 2: Create page file

Dashboard pages go in `apps/web/app/[locale]/(dashboard)/<name>/page.tsx`. Standard template:

```tsx
'use client';

import { useTranslations } from 'next-intl';
// Import components from apps/web/components/<name>/
// Import icons from lucide-react
// Import { useAuth } from '@/providers/AuthProvider' if you need user/family data

export default function PageNamePage() {
  const t = useTranslations('PageName');

  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
        <p className="text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      {/* Page content */}
    </div>
  );
}
```

Key conventions:
- Always `'use client'` for dashboard pages (they use hooks)
- Always use `useTranslations` — never hardcode user-facing strings
- Wrap content in `max-w-5xl`
- Use `useAuth()` from `@/providers/AuthProvider` to access `user`, `family`, `isLoading`
- API calls use `credentials: 'include'` — auth is cookie-based
- Loading states: `<Loader2 className="w-5 h-5 animate-spin" />` from lucide-react
- Card styling: `bg-white rounded-xl border border-slate-200 p-6` for dashboard cards

## Step 3: Create component files

Extract non-trivial UI into `apps/web/components/<name>/`:
- One component per file
- Named exports (not default)
- Props interface defined above the component
- Icons from `lucide-react`

## Step 4: Add translations

Add a new namespace to `apps/web/messages/en.json`:

```json
{
  "PageName": {
    "title": "Page Title",
    "subtitle": "Description of the page",
    "emptyState": "No items yet."
  }
}
```

Conventions:
- Namespace: PascalCase matching the page concept
- Keys: camelCase
- Flat structure (namespace → keys, no deep nesting)
- Add navigation label to `Navigation` namespace if it appears in the sidebar

## Step 5: Register protected route (if new)

If this is a NEW route (not replacing a placeholder), update:
1. `apps/web/middleware.ts` — add path to `PROTECTED_PATHS` array
2. `apps/web/components/dashboard/Sidebar.tsx` — add nav item in the appropriate group
3. `apps/web/messages/en.json` — add label to `Navigation` namespace

## Step 6: Sub-pages or nested routes

For pages with sub-routes (e.g., `/children/[id]`):
- Create `apps/web/app/[locale]/(dashboard)/children/[id]/page.tsx`
- Access `params.id` from the page component props

## Checklist

- [ ] Page created in correct route group with `'use client'`
- [ ] Translations added to `messages/en.json`
- [ ] Components extracted to `components/<name>/`
- [ ] Uses `useAuth()` for protected data access
- [ ] API calls use `credentials: 'include'`
- [ ] Responsive: works on mobile (sm:) and desktop (lg:)
- [ ] Loading state with Loader2 spinner
- [ ] Error handling for API failures
- [ ] Protected route registered in middleware (if new route)
- [ ] Sidebar nav item added (if new route)
