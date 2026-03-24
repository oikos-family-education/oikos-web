---
name: oikos-i18n
description: Add or manage internationalization translations for the Oikos web app using next-intl. Use this skill whenever adding new translation keys, creating new namespaces, or fixing missing translations. Trigger on phrases like "add translations", "i18n", "translate", "add a message", "missing translation", "new namespace", "internationalization", or when building a new page or component that needs user-facing text.
---

# Oikos i18n Management

The app uses `next-intl` with a single locale file: `apps/web/messages/en.json`.

## Architecture

- Config: `apps/web/i18n.ts` — loads locale from `messages/<locale>.json`
- Provider: `NextIntlClientProvider` in `app/[locale]/layout.tsx`
- Middleware: `apps/web/middleware.ts` — locale prefix routing
- Currently only `en` locale. All routes are under `app/[locale]/`.

## Existing namespaces

| Namespace | Purpose |
|-----------|---------|
| `Home` | Landing page |
| `Auth` | Login, register, password reset forms |
| `Validation` | Form validation error messages (shared across all forms) |
| `ApiErrors` | API error messages shown to user |
| `PasswordStrength` | Password strength indicator |
| `Onboarding` | Family and children onboarding wizard |
| `Dashboard` | Dashboard page (greetings, encouragement) |
| `Navigation` | Sidebar nav labels and group labels |
| `Cards` | Dashboard navigation card descriptions |
| `Placeholder` | Placeholder page content (coming soon) |

## Adding new translations

### Step 1: Determine the namespace

- New page → create a new namespace matching the page name (PascalCase)
- Existing feature → add to the existing namespace
- Form validation → add to `Validation`
- API error display → add to `ApiErrors`
- Sidebar nav item → add to `Navigation`

### Step 2: Add keys to `apps/web/messages/en.json`

```json
{
  "ExistingNamespace": { "...": "..." },
  "NewFeature": {
    "title": "Feature Title",
    "subtitle": "Description of the feature",
    "actionButton": "Do something",
    "emptyState": "No items yet. Create your first one."
  }
}
```

Key conventions:
- Namespace: PascalCase (`Dashboard`, `Auth`, `Onboarding`)
- Keys: camelCase (`signInButton`, `emailRequired`)
- Structure: FLAT — one level only (namespace → keys, no nested objects)
- Descriptive key names: `titleLabel` not `t1`

### Step 3: Use in components

```tsx
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('NewFeature');
  return <h1>{t('title')}</h1>;
}
```

Multiple namespaces in one component:
```tsx
const tNav = useTranslations('Navigation');
const tVal = useTranslations('Validation');
```

### Step 4: Advanced patterns

**Interpolation** (dynamic values):
```json
{ "greeting": "Hello, {name}!" }
```
```tsx
t('greeting', { name: user.first_name })
```

**Rich text** (inline components):
```json
{ "agreeToTerms": "I agree to the <terms>Terms</terms> and <privacy>Privacy Policy</privacy>" }
```
```tsx
t.rich('agreeToTerms', {
  terms: (chunks) => <a href="/terms">{chunks}</a>,
  privacy: (chunks) => <a href="/privacy">{chunks}</a>,
})
```

### Step 5: Zod schemas with translations

Zod schemas using translated messages must be created inside the component with `useMemo`:
```tsx
const tVal = useTranslations('Validation');
const schema = useMemo(() => z.object({
  email: z.string().min(1, tVal('emailRequired')).email(tVal('emailInvalid')),
  name: z.string().min(1, tVal('nameRequired')).max(100),
}), [tVal]);
```

## Checklist

- [ ] Keys added to `apps/web/messages/en.json`
- [ ] Namespace is PascalCase, keys are camelCase
- [ ] No hardcoded user-facing strings in components
- [ ] Interpolation used for dynamic values (not string concatenation)
- [ ] Validation messages use `Validation` namespace
- [ ] API errors use `ApiErrors` namespace
- [ ] Navigation labels use `Navigation` namespace
