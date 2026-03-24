---
globs: apps/web/**/*.tsx, packages/ui/**/*.tsx
---

# Design System Rules

## Colors — use Tailwind tokens, never hardcoded hex
- Primary: `text-primary`, `bg-primary`, `hover:bg-primary-hover`, `bg-primary-light`, `text-primary-dark`
- Secondary: `text-secondary`, `bg-secondary` (rose)
- Background: `bg-background` (page), `bg-surface` (cards)
- Text: `text-slate-800` (headings), `text-slate-600` (body), `text-slate-500` (subtle)
- Borders: `border-slate-200`
- Errors: `text-red-500`, `border-red-500`
- Success: `text-success`, `bg-success`

## Cards
- Auth/onboarding: `bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white`
- Dashboard content: `bg-white rounded-xl border border-slate-200 p-6`
- Use `glass` class for glassmorphism effect (defined in globals.css)

## Typography
- Font is Inter (loaded globally — do not re-import)
- Page titles: `text-2xl font-bold text-slate-800`
- Section headings: `text-lg font-semibold text-slate-800`
- Subtitles: `text-slate-500 mt-1`
- Labels: `text-sm font-semibold text-slate-700`
- Body: `text-slate-600`
- Small/helper: `text-xs text-slate-500`
- Error text: `text-xs font-medium text-red-500`

## Icons
- Source: `lucide-react` only — never other icon libraries
- Standard size: `w-5 h-5` (inline), `w-10 h-10` (feature icons)
- Loading spinner: `<Loader2 className="w-5 h-5 animate-spin" />`

## Spacing
- Page content wrapper: `max-w-5xl`
- Dashboard content padding: `p-6 lg:p-8` (handled by layout)
- Section gaps: `space-y-4` or `space-y-5` for forms, `mb-8` between major sections
- Icon badge: `inline-flex p-4 rounded-2xl bg-primary/10` with `h-10 w-10 text-primary` icon

## Responsive
- Mobile-first (base styles = mobile)
- `sm:` (640px+) for form padding adjustments
- `lg:` (1024px+) for sidebar visibility and larger padding
