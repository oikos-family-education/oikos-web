# 7. Frontend (`apps/web`)

Next.js 14 with the App Router, TypeScript, Tailwind, and `next-intl`.

## Directory layout

```
apps/web/
├── app/
│   └── [locale]/                Every route is locale-prefixed
│       ├── layout.tsx           Root layout + providers
│       ├── page.tsx             Marketing / landing
│       ├── (auth)/              Public auth flows
│       │   ├── login/
│       │   ├── register/
│       │   ├── forgot-password/
│       │   └── reset-password/
│       ├── (dashboard)/         Protected app
│       │   ├── layout.tsx       Sidebar + nav shell
│       │   ├── dashboard/
│       │   ├── family/
│       │   ├── children/        list + [child_id]/
│       │   ├── subjects/        list + [subjectId]/ + new/
│       │   ├── curriculums/     list + [curriculumId]/ + new/
│       │   ├── planner/
│       │   ├── projects/        list + [projectId]/ + new/ + certificate/[childId]/
│       │   ├── resources/       list + [resourceId]/ + new/
│       │   ├── calendar/ journal/ progress/ assistant/ community/ settings/
│       └── onboarding/          family / children / coat-of-arms
├── components/
│   ├── auth/                    Login, register, password-reset forms
│   ├── dashboard/
│   ├── onboarding/              ShieldBuilder, ShieldPreview, etc.
│   ├── children/
│   ├── subjects/
│   ├── curriculums/
│   ├── planner/                 @dnd-kit grid + PrintablePlanner
│   ├── projects/
│   └── resources/
├── providers/
│   └── AuthProvider.tsx         Auth context: user, family, refresh, logout
├── lib/                         categoryLabel, getServiceMeta, navigation
├── messages/
│   └── en.json                  next-intl translations
├── middleware.ts                Locale routing + auth protection
├── i18n.ts                      next-intl config
├── next.config.js               /api/* rewrite, transpilePackages
├── tailwind.config.js
└── tests/                       Vitest + Testing Library
```

## Routing

- **Every route is under `app/[locale]/`.** The locale segment is non-optional; `middleware.ts` injects the default if missing.
- **Route groups** (`(auth)`, `(dashboard)`) do not affect the URL; they exist to share layouts and middleware behaviour.
- **Protected paths** are listed in `apps/web/middleware.ts` `PROTECTED_PATHS`. Adding a new protected page means adding it there too.
- Navigation uses `useRouter()` from `next/navigation`.

## Pages

See [04-features.md](04-features.md) for the full list mapped to features. Dashboard pages wrap their content in `<div className="max-w-5xl">`. Interactive pages use `'use client'`.

## Providers

- [`AuthProvider`](../apps/web/providers/AuthProvider.tsx) wraps the tree. It:
  - Calls `GET /api/v1/auth/me` on mount.
  - Redirects to `/login` on 401.
  - Redirects to `/onboarding/family` when `user.has_family === false`.
  - Exposes `{ user, family, refresh, logout }` via `useAuth()`.

## Forms

Enforced by [.claude/rules/form-guidelines.md](../.claude/rules/form-guidelines.md):

- `react-hook-form` + `zodResolver`, `mode: 'onBlur'`.
- Zod schemas that use translated messages must be wrapped in `useMemo` (translation hooks aren't stable across renders).
- Required fields: use the `required` prop on `<Input>` from `@oikos/ui` (it renders the red asterisk). For custom labels, append `<span className="text-red-500 ml-0.5">*</span>`.
- Buttons: always use `<Button>` from `@oikos/ui`. Never override its `inline-flex items-center justify-center whitespace-nowrap` classes.
- Loading state: replace button label with `<Loader2 className="w-5 h-5 animate-spin mx-auto" />`.

## API calls

- Always `fetch('/api/v1/…', { credentials: 'include' })`. Auth is cookie-based.
- Check `res.ok` before parsing the body.
- Handle `401` (redirect to `/login`), `423` (account locked), `429` (rate limited).
- Display errors through local `useState` and the shared `Alert` component.

## State management

- `AuthProvider` context for global auth/user/family state.
- React hooks (`useState`, `useReducer`) for local state.
- `localStorage` only for UI preferences (e.g., sidebar collapsed).
- No Redux / Zustand / Jotai.

## Styling & design system

Rules: [.claude/rules/design-system.md](../.claude/rules/design-system.md).

- Colors via Tailwind tokens (`primary`, `secondary`, `background`, `surface`, `slate-*`). **Never** hardcode hex.
- Cards:
  - Auth/onboarding: `bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white`
  - Dashboard: `bg-white rounded-xl border border-slate-200 p-6`
- Icons: `lucide-react` only. Sizes: `w-5 h-5` inline, `w-10 h-10` for feature tiles.
- Page wrapper: `max-w-5xl`. Dashboard padding handled by layout (`p-6 lg:p-8`).

## Components

- **Primitives**: `@oikos/ui` (`Button`, `Input`). Always prefer these over raw HTML.
- **Feature components** live under `apps/web/components/<feature>/`, named exports, one component per file, `'use client'` only when needed.
- **Types**: mirror backend Pydantic via `@oikos/types`.

## Adding a new page

See the `/oikos-new-page` skill. Checklist:

1. Create `app/[locale]/(dashboard)/<route>/page.tsx` with `'use client'` (if interactive).
2. Add `useTranslations('NewNamespace')` and seed `messages/en.json`.
3. If protected, add the path to `PROTECTED_PATHS` in `middleware.ts`.
4. Wrap content in `<div className="max-w-5xl">`.
5. Use `@oikos/ui` primitives and Tailwind tokens — no ad-hoc colors.
6. Add a nav entry via `lib/navigation.ts` if the page should appear in the sidebar.

## Testing

- [apps/web/tests/](../apps/web/tests/) — Vitest + jsdom + `@testing-library/react`.
- Run:
  ```bash
  cd apps/web && npm run test
  ```
