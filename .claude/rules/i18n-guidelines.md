---
globs: apps/web/**/*.tsx, apps/web/messages/**/*.json
---

# i18n Guidelines

## Never hardcode user-facing strings
All visible text must use `useTranslations` from `next-intl`.

## Translation file
Single source of truth: `apps/web/messages/en.json`

## Namespace conventions
- PascalCase namespace names: `Auth`, `Dashboard`, `Onboarding`
- camelCase key names: `signInButton`, `emailRequired`
- Flat structure only: namespace → keys (no nested objects within a namespace)
- One namespace per feature/page

## Existing namespaces
`Home`, `Auth`, `Validation`, `ApiErrors`, `PasswordStrength`, `Onboarding`, `Dashboard`, `Navigation`, `Cards`, `Placeholder`

## Usage patterns
```tsx
const t = useTranslations('NamespaceName');
// Basic: t('keyName')
// Interpolation: t('greeting', { name: user.first_name })
// Rich text: t.rich('text', { link: (chunks) => <a>{chunks}</a> })
```

## Zod + translations
Schemas using translated messages must be memoized:
```tsx
const tVal = useTranslations('Validation');
const schema = useMemo(() => z.object({
  email: z.string().min(1, tVal('emailRequired')),
}), [tVal]);
```
