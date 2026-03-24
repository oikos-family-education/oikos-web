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

