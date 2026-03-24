---
globs: apps/web/components/**/*.tsx, apps/web/app/**/*.tsx
---

# Form Guidelines

## Required fields
- All required fields MUST show a red asterisk next to their label
- Use the `required` prop on `<Input>` from `@oikos/ui` — it renders the asterisk automatically
- For custom labels not using `<Input>`, append `<span className="text-red-500 ml-0.5">*</span>`

## Validation stack
- `react-hook-form` with `zodResolver` from `@hookform/resolvers/zod`
- Validation mode: `'onBlur'`
- Zod schemas that use translated messages MUST be wrapped in `useMemo` (translations come from hooks)
- Display errors inline via the Input component's `error` prop: `error={errors.fieldName?.message}`

## Buttons
- Always use `<Button>` from `@oikos/ui` — it includes `inline-flex items-center justify-center whitespace-nowrap`
- Never override the button's flex/whitespace layout classes
- Submit buttons: `type="submit"` and `disabled={isLoading}`
- Loading state: replace button text with `<Loader2 className="w-5 h-5 animate-spin mx-auto" />`

## API calls from forms
- Always use `credentials: 'include'` (auth is cookie-based)
- Check `!res.ok` before parsing response
- Handle specific status codes: 401 (redirect to login), 423 (locked), 429 (rate limited)
- Display errors via component state and Alert component

## Standard pattern
```tsx
const schema = useMemo(() => z.object({ ... }), [tVal]);
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  mode: 'onBlur',
});
```
