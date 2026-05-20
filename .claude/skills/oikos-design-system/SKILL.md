---
name: oikos-design-system
description: Reference skill for the Oikos design system — color palette, typography, spacing, card styles, glass effects, and component patterns. Use when the user asks about styling, design tokens, "what color should I use", "how should this look", "design reference", or when reviewing UI code for design consistency. Also trigger on "design system", "style guide", "component styling".
---

# Oikos Design System Reference

Source of truth: `packages/config/tailwind.config.js` and `apps/web/app/globals.css`.

## Color Palette

| Token | Hex | Tailwind class | Usage |
|-------|-----|---------------|-------|
| primary | #6366f1 | `text-primary`, `bg-primary` | Buttons, links, active states, accents |
| primary-hover | #4f46e5 | `hover:bg-primary-hover` | Button hover states |
| primary-light | #e0e7ff | `bg-primary-light` | Light backgrounds, badges |
| primary-dark | #3730a3 | `text-primary-dark` | Dark text on light primary bg |
| secondary | #f43f5e | `text-secondary`, `bg-secondary` | Rose accent, alerts, highlights |
| background | #f8fafc | `bg-background` | Page background |
| surface | #ffffff | `bg-surface` | Card/panel backgrounds |
| border | #e2e8f0 | `border-border` | Borders, dividers |
| error | #ef4444 | `text-error`, `bg-error` | Error states, required markers |
| success | #22c55e | `text-success`, `bg-success` | Success states |

**Rule**: Always use Tailwind tokens. Never hardcode hex values in components.

## Typography

- **Font**: Inter (loaded via `next/font/google` in root layout — never re-import)
- Page titles: `text-2xl font-bold text-slate-800`
- Section headings: `text-lg font-semibold text-slate-800`
- Subtitles: `text-slate-500 mt-1` or `text-slate-500 font-medium`
- Labels: `text-sm font-semibold text-slate-700`
- Body: `text-slate-600`
- Small/helper: `text-xs text-slate-500`
- Error text: `text-xs font-medium text-red-500`
- Hero (landing page only): `text-5xl md:text-7xl font-extrabold`

## Card Patterns

**Auth/Onboarding cards** (glassmorphism):
```
bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white
```

**Dashboard content cards**:
```
bg-white rounded-xl border border-slate-200 p-6
```

**Glass effect** (from globals.css):
```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

**Icon badge**:
```
inline-flex p-4 rounded-2xl bg-primary/10
```
Icon inside: `h-10 w-10 text-primary`

## Button Component (`@oikos/ui`)

Base styling:
```
inline-flex items-center justify-center whitespace-nowrap px-4 py-2
bg-primary text-white font-medium rounded-lg
hover:bg-primary-hover focus:ring-2 focus:ring-primary
transition-all transform active:scale-95
disabled:bg-indigo-300 disabled:cursor-not-allowed
```

Enhanced (auth/onboarding pages):
```
w-full py-3.5 text-base rounded-xl
shadow-[0_4px_14px_0_rgb(99,102,241,0.39)]
hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)]
```

## Input Component (`@oikos/ui`)

```
w-full px-4 py-2.5 bg-slate-50 border rounded-lg
focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all
border-slate-200 hover:border-slate-300
```
Error state: `border-red-500 focus:ring-red-500 bg-red-50`
Required indicator: red asterisk via `required` prop

## Background Blobs

Root layout renders three animated gradient blobs (indigo, rose, orange) — pages do NOT need to add their own.

## Sidebar & Layout

- Desktop sidebar: `w-64` (expanded) / `w-16` (collapsed), `bg-white border-r border-slate-200`
- Content area: `flex-1 overflow-y-auto p-6 lg:p-8`
- Logo: gradient `from-primary to-indigo-500 rounded-xl`
- Nav group labels: `text-xs font-semibold text-slate-400 uppercase tracking-wider`

## Brand Mark (Oikos logo)

The Oikos logo is always **a `BookOpen` icon from `lucide-react` inside a gradient rounded square**, never a custom illustration. The shape and colours are fixed; only the size varies by context.

```tsx
<div className="w-9 h-9 bg-gradient-to-br from-primary to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
  <BookOpen className="w-5 h-5 text-white" />
</div>
```

Standard sizes:
- Sidebar / nav: `w-9 h-9` outer, `w-5 h-5` icon
- Printable headers: `w-10 h-10` outer, `w-5 h-5` icon
- Certificate seal: `w-[60px] h-[60px]` outer, `w-8 h-8` icon

The wordmark next to it: `text-xl font-bold tracking-tight text-slate-800` (or `text-2xl` on print).

## Printable Layout Header

Every printable / exportable A4 surface (certificate, progress report, printed lesson pack, planner export) **must use the shared component** [`<PrintableHeader>`](apps/web/components/ui/PrintableHeader.tsx). Do not hand-roll a header — even small divergences (sizes, ordering, OIKOS vs. "Oikos" wordmark, missing shield placeholder) break the visual family.

```tsx
import { PrintableHeader } from '../ui/PrintableHeader';

<PrintableHeader
  shieldConfig={family.shield_config as ShieldConfig | null}
  familyName={family.family_name}
/>
```

The component is the single source of truth and renders:
- **Family coat of arms — LEFT.** `ShieldPreview` at `width={110} height={130}` with `familyNameFontSize={8}` (the default `5` is too small to read on print). If `shieldConfig` is `null`, a same-sized muted placeholder keeps the layout balanced.
- **Oikos brand mark — RIGHT.** Vertical stack: 60×60 gradient `rounded-2xl` square with a white `BookOpen` icon, then the wordmark `OIKOS` (`text-xs font-semibold text-slate-800`, `letter-spacing: 0.15em`) below.
- **Wrapper.** `flex items-center justify-between w-full`. The consuming page is responsible only for the surrounding `mb-*` spacing.

If `<PrintableHeader>` doesn't fit a new surface (e.g. an ultra-compact strip), extend the component with a `compact` / `size` prop rather than copy-pasting a variant — the goal is that every print surface stays in sync when the brand or shield rendering changes.

Reference implementations: [certificate page](apps/web/app/[locale]/(dashboard)/projects/[projectId]/certificate/[childId]/page.tsx), [PrintableReport.tsx](apps/web/components/progress/PrintableReport.tsx).

## Icons

All icons from `lucide-react`. Common navigation icons:
- Home, Users, Star, BookOpen, LayoutGrid, Calendar, Layers, Library, PenTool, BarChart3, Sparkles, Globe, Settings
- Actions: ArrowLeft, Eye, EyeOff, Loader2, ChevronsLeft, ChevronsRight

## Loading States

Spinner: `<Loader2 className="w-5 h-5 animate-spin" />` from lucide-react

Full-page loading:
```tsx
<div className="flex h-screen items-center justify-center bg-background">
  <Loader2 className="w-8 h-8 animate-spin text-primary" />
</div>
```

## Dialogs, Popups & Confirmations

**NEVER use the browser's native dialogs** — `window.alert`, `window.confirm`, `window.prompt`. They look unstyled, can't be themed, block the page, and lack i18n. Always replace with a themed component.

### Reusable Modal primitive

`apps/web/components/dashboard/Modal.tsx` — handles backdrop dismiss, Escape key, body scroll lock, and mobile-friendly bottom-sheet on small screens. Use this as the foundation for any new dialog.

```tsx
import { Modal } from '../dashboard/Modal';

<Modal
  open={open}
  onClose={onClose}
  title={t('dialogTitle')}
  footer={
    <>
      <button onClick={onClose} className="... text-slate-600 hover:bg-slate-100">
        {t('cancel')}
      </button>
      <Button onClick={onSubmit}>{t('confirm')}</Button>
    </>
  }
>
  {/* body */}
</Modal>
```

### When to use which pattern

| Pattern | When | Example in repo |
|---------|------|-----------------|
| **Modal** (general) | Any dialog with a form, settings, or rich content | `LinkDialog` in `RichTextEditor.tsx` |
| **ConfirmDialog** (destructive) | Asking the user to confirm a destructive action (delete, cancel, reset). Always use a red icon badge + red confirm button | `ConfirmDialog` in `LessonEditor.tsx` |
| **Popover** (inline) | Small contextual menus (status menu, color picker, emoji picker) — does NOT need a backdrop, closes on outside click | `StatusMenu` in `LessonEditor.tsx`, `ToolbarPopover` in `RichTextEditor.tsx` |

### Destructive confirm dialog template

Use this exact shape for any "Are you sure?" delete/cancel dialog so the visual language stays consistent:

```tsx
function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-red-50 text-red-600 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-600 mt-1">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="... text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={onConfirm} className="... bg-red-600 text-white hover:bg-red-700">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Form-style prompt dialog (replacement for `window.prompt`)

For dialogs that collect a value (URL, name, etc.):
- Use the `Modal` primitive with a labelled input in the body
- **Validate inline** — show errors via a `text-xs font-medium text-red-500` paragraph under the input and a red border on the field; never use `window.alert`
- Submit on **Enter**, cancel on **Escape** (Modal handles Escape automatically)
- Auto-focus the input on open with `setTimeout(() => inputRef.current?.focus(), 50)` (timeout needed so focus lands after the open animation)
- If a text editor's selection matters (e.g., inserting a link around selected text), **save the `Range` before opening** and restore it before running the edit command

### Backdrop & z-index

- All themed dialogs use `fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4` (Modal does this internally)
- Always use `z-50` for dialogs, `z-30` or `z-20` for popovers — never higher than `z-50`
- Backdrop colour: `bg-slate-900/40` (or `bg-black/40` for slightly stronger contrast). Optionally `backdrop-blur-sm`

### Accessibility checklist

- `role="dialog"` and `aria-modal="true"` on the dialog root
- `aria-labelledby` pointing to the title element (or `aria-label` if no visible title)
- Escape closes the dialog (Modal handles this; popovers must add their own listener)
- Outside-click closes the dialog/popover
- Focus the first interactive element on open
- Return focus to the trigger when closing (Modal/Popover does this implicitly through React's focus management)

### Translations

Every dialog string must go through `useTranslations` — no hard-coded labels, no hard-coded error messages. Standard keys per dialog:
- `<feature>DialogTitle`
- `<feature>DialogBody` (for confirms)
- `<feature>DialogConfirm` (for the destructive button)
- `cancel` or `completionCancel` (reuse where possible)

