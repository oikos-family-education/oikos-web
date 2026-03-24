---
name: oikos-new-component
description: Create a new UI component following the Oikos design system. Use this skill whenever the user wants to add a new reusable component to the web app or the shared UI package. Trigger on phrases like "create a component", "new component", "add a card component", "build a modal", "make a reusable X", "add a select", "create a textarea", or when building UI that clearly needs a new component.
---

# Oikos New Component

Components live in two places:

| Location | When to use | Import as |
|----------|------------|-----------|
| `packages/ui/` | Generic UI primitives (Button, Input, Modal, Select, Textarea) — shared across apps | `@oikos/ui` |
| `apps/web/components/<feature>/` | Feature-specific (LoginForm, Sidebar, NavigationCards) | `@/components/<feature>/Name` |

## Step 1: Determine location

Ask the user:
- Is this a generic UI primitive (button, input, card, modal, select, textarea, badge)? → `packages/ui/`
- Is it specific to a feature (dashboard card, onboarding wizard step, settings panel)? → `apps/web/components/<feature>/`

## Step 2a: Shared UI component (`packages/ui/`)

Follow the existing pattern from Button.tsx and Input.tsx:

```tsx
import React from 'react';

export interface ComponentNameProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined';
  // Custom props
}

export const ComponentName = React.forwardRef<HTMLDivElement, ComponentNameProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`base-classes ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ComponentName.displayName = 'ComponentName';
```

After creating, export from `packages/ui/index.tsx`:
```tsx
export { ComponentName } from './ComponentName';
```

## Step 2b: Feature component (`apps/web/components/<feature>/`)

```tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { IconName } from 'lucide-react';

interface ComponentNameProps {
  // Props definition
}

export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  const t = useTranslations('Namespace');

  return (
    // JSX
  );
}
```

## Design system quick reference

**Colors** (Tailwind tokens, never hardcoded hex):
- Primary: `bg-primary`, `text-primary`, `hover:bg-primary-hover`
- Text: `text-slate-800` (heading), `text-slate-600` (body), `text-slate-500` (subtle)
- Borders: `border-slate-200`

**Cards**:
- Auth/onboarding: `bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white`
- Dashboard: `bg-white rounded-xl border border-slate-200 p-6`

**Icons**: `lucide-react` only. Standard: `w-5 h-5`. Feature: `w-10 h-10`.

**Loading**: `<Loader2 className="w-5 h-5 animate-spin" />`

## Conventions

- Named exports, not default
- Props interface directly above the component
- `'use client'` only when using hooks or browser APIs
- One component per file
- Accept `className` prop for composition
- Set `displayName` if using `forwardRef`
- All user-facing text via `useTranslations`
- Accessible: aria labels on interactive elements

## Checklist

- [ ] Component in correct location (packages/ui vs apps/web/components)
- [ ] Props interface defined
- [ ] Uses design system tokens (no hardcoded hex)
- [ ] Accepts `className` for composition
- [ ] Exported from index file (if in packages/ui)
- [ ] Responsive where applicable
- [ ] Accessible (aria labels on interactive elements)
