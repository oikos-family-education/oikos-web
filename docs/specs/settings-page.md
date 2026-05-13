# Settings Page — Feature Specification

## Overview

The Settings page is the control center for a user's **personal account** — authentication credentials, interface preferences, regional options, notification behavior, and account lifecycle (including deletion). It is scoped exclusively to the logged-in user; anything that belongs to the household (family profile, education philosophy, member access, data export) lives in the **Family page** and must not be duplicated here.

---

## Problem Being Solved

Currently `/settings` is a placeholder. Users have no way to:
- Update their name or email after registration
- Change their password from inside the app
- Choose a UI language or timezone
- Control what emails the platform sends them
- Delete their own account

These are standard account-management expectations that every authenticated user needs regardless of whether they are a primary account holder or a co-parent.

---

## Scope Boundary

| Topic | Where it lives |
|---|---|
| Family name, location, coat of arms | Family page → Identity tab |
| Faith & worldview settings | Family page → Faith tab |
| Education methods & curriculum | Family page → Education tab |
| Invite / remove family members | Family page → Members tab |
| Family visibility & data export | Family page → Privacy tab |
| Child profiles | Children page |
| **Account name, email, password** | **Settings (this spec)** |
| **UI language & timezone** | **Settings (this spec)** |
| **Notification preferences** | **Settings (this spec)** |
| **Appearance / accessibility** | **Settings (this spec)** |
| **Delete account** | **Settings (this spec)** |

---

## Page Layout

A single-column page with a `max-w-2xl` content area, divided into clearly labeled card sections with subtle dividers. No tabs — sections stack vertically with anchor navigation on larger screens.

Sections (in order):
1. Account Information
2. Security
3. Language & Region
4. Notifications
5. Appearance & Accessibility
6. Danger Zone

---

## Section 1 — Account Information

**Purpose:** Allow the user to update the personal details collected at registration.

### Fields

| Field | Type | Notes |
|---|---|---|
| First name | Text input | Required |
| Last name | Text input | Required |
| Email address | Text input (email) | Requires re-authentication or email verification on change |

### Behavior

- Fields pre-populate from the current user session (`/api/v1/auth/me`).
- Name changes save immediately on form submit with a success toast.
- **Email change** is a two-step flow:
  1. User enters new email and submits.
  2. A verification email is sent to the **new address** with a time-limited token.
  3. Until confirmed, the old email remains active and a banner warns "Email change pending — check your inbox."
  4. On confirmation, the email updates and the user is notified at the old address.
- Email change requires the user to enter their **current password** to confirm intent (inline password field appears when the email field is edited).

### API endpoints needed

- `PATCH /api/v1/users/me` — update first_name, last_name
- `POST /api/v1/users/me/request-email-change` — initiate email change (sends verification)
- `POST /api/v1/users/me/confirm-email-change?token=...` — confirm new email (public endpoint, linked from email)

---

## Section 2 — Security

**Purpose:** Let users manage their password and review account security signals.

### Sub-sections

#### Change Password

| Field | Notes |
|---|---|
| Current password | Required to authorize the change |
| New password | Min 10 chars, must contain uppercase, lowercase, number, special char (same rules as registration) |
| Confirm new password | Must match |

- Shows password strength indicator (reuse `PasswordStrength` component already used at registration).
- On success: session cookies are refreshed so the user stays logged in.
- On wrong current password: inline error "Incorrect password."

#### Last Login

- Read-only info row: "Last sign-in: **{date}** from **{location or device}**" (populated from `last_login_at`; location is optional/best-effort from IP).
- No action required — purely informational to help users spot unauthorized access.

#### Active Sessions *(Phase 2)*

- List sessions with device/browser hints and "Sign out" action per session.
- Requires server-side session tracking (not in current model — defer to Phase 2).

#### Two-Factor Authentication *(Phase 2)*

- TOTP-based 2FA toggle.
- Defer until Phase 2.

### API endpoints needed

- `POST /api/v1/users/me/change-password` — body: `{ current_password, new_password }`

---

## Section 3 — Language & Region

**Purpose:** Control how dates, times, and UI text are presented to this specific user. This is independent of the family's `home_languages` field (which describes the household's spoken languages for educational purposes).

### Fields

| Setting | Options | Default |
|---|---|---|
| Display language | English (more added as translations are contributed) | `en` |
| Timezone | Full IANA timezone list (e.g. America/New_York) | Browser-detected on first save |
| Date format | MM/DD/YYYY · DD/MM/YYYY · YYYY-MM-DD | Based on locale |
| Time format | 12-hour · 24-hour | Based on locale |

### Behavior

- Stored on the user record (new `locale_preferences` JSON column, or individual columns).
- Timezone is used by the planner and calendar when displaying scheduled times.
- Date/time format affects all date displays across the app.
- Language change triggers a full page reload to apply the new locale.

### API endpoints needed

- `PATCH /api/v1/users/me/preferences` — body: `{ timezone, date_format, time_format, locale }`

---

## Section 4 — Notifications

**Purpose:** Control which emails the platform sends and at what cadence.

### Email notification toggles

| Notification | Description | Default |
|---|---|---|
| Weekly planning summary | Digest of scheduled lessons for the coming week, sent Sunday evening | On |
| Lesson reminders | Email X hours before a scheduled lesson | Off |
| Progress milestone | When a child completes a curriculum or project | On |
| Family member activity | When a co-parent or educator makes changes | Off |
| Platform news & updates | Product announcements from the Oikos team | On |

### Behavior

- Each toggle persists immediately (no submit button — auto-saves on toggle).
- "Lesson reminders" toggle reveals a sub-option: reminder timing (1 hour / 2 hours / 1 day before).
- Unsubscribe links in emails land on a public confirmation page (`/unsubscribe?token=...`) that disables that specific notification type without requiring login.

### API endpoints needed

- `GET /api/v1/users/me/notification-preferences`
- `PATCH /api/v1/users/me/notification-preferences` — body: `{ weekly_summary, lesson_reminders, lesson_reminder_offset_hours, progress_milestones, member_activity, platform_news }`

### Data model

New `UserNotificationPreferences` model (or JSON column on User):

```
weekly_summary: bool = True
lesson_reminders: bool = False
lesson_reminder_offset_hours: int = 1
progress_milestones: bool = True
member_activity: bool = False
platform_news: bool = True
unsubscribe_token: str (URL-safe, for email links)
```

---

## Section 5 — Appearance & Accessibility

**Purpose:** Personal UI preferences that affect this user's experience only.

### Appearance

| Setting | Options | Default |
|---|---|---|
| Color theme | Light · Dark · System | System |

- Stored in `localStorage` (no round-trip to server needed).
- Applied immediately on change.

### Accessibility

| Setting | Options | Default |
|---|---|---|
| Font size | Default · Large · Extra Large | Default |
| Reduce motion | On · Off | Off (respects `prefers-reduced-motion` OS setting by default) |
| High contrast | On · Off | Off |
| Dyslexia-friendly font | On · Off (switches body font to OpenDyslexic) | Off |

- All accessibility preferences stored in `localStorage`.
- Applied immediately on change.
- A "Reset to defaults" link resets all appearance/accessibility settings.

> These settings are intentionally client-side only. They travel with the browser, not the account, which is the right model for display preferences (e.g., a user may want large text on a tablet but not on their desktop).

---

## Section 6 — Danger Zone

**Purpose:** Permanent, irreversible account actions. Visually separated from the rest of the page with a red border.

### Delete Account

- Deleting the account is **different from deleting the family**:
  - If the user is the **primary account holder** (family owner), they must first transfer ownership or delete the family from the Family page before deleting their account.
  - If the user is a **co-parent/educator**, deleting their account removes them from the family and revokes their access without affecting the family or other members.
- Flow:
  1. User clicks "Delete my account."
  2. Modal opens with a plain-language explanation of consequences.
  3. User must type their **email address** to confirm.
  4. User must enter their **current password**.
  5. Submit triggers deletion: user record soft-deleted (or hard-deleted after a 30-day grace period), all sessions invalidated, redirect to a "Account deleted" public page.
- If the user is the primary family owner and a family exists, the confirm button is disabled and a warning explains they must delete or transfer the family first.

### API endpoints needed

- `DELETE /api/v1/users/me` — requires password in request body for confirmation

---

## Non-Goals

- Subscription / billing management (not in current scope)
- Connected external accounts / OAuth (not in current scope)
- API keys / developer access tokens (not in current scope)
- Changing the family's home languages or spoken languages (→ Family page)
- Profile photo upload (deferred — no storage infra yet)

---

## Implementation Notes

### Backend changes

| Change | Priority |
|---|---|
| `PATCH /api/v1/users/me` (name update) | Phase 1 |
| `POST /api/v1/users/me/change-password` | Phase 1 |
| `PATCH /api/v1/users/me/preferences` (locale, timezone) | Phase 1 |
| `GET/PATCH /api/v1/users/me/notification-preferences` | Phase 1 |
| `DELETE /api/v1/users/me` | Phase 1 |
| Email change two-step verification flow | Phase 2 |
| Session listing and individual session revocation | Phase 2 |
| Two-factor authentication (TOTP) | Phase 2 |

### Frontend structure

```
apps/web/
  app/[locale]/(dashboard)/settings/
    page.tsx                         # Settings page shell
  components/settings/
    AccountInfoSection.tsx
    ChangePasswordSection.tsx
    LanguageRegionSection.tsx
    NotificationPreferencesSection.tsx
    AppearanceSection.tsx
    DangerZoneSection.tsx
```

### New translation namespace

`Settings` namespace in `messages/en.json` — no keys in other namespaces should be reused or duplicated.

### Routing

`/settings` is already in `PROTECTED_PATHS` (verify in `middleware.ts`).

---

## Open Questions

1. Should timezone be stored per-user or inferred from browser on each visit? Storing it means consistency across devices; browser inference is zero-config.
2. Grace-period deletion (30 days) vs. immediate hard delete — legal/GDPR requirements should drive this decision.
3. When a co-parent deletes their account, should their contributions (lessons, notes they authored) be preserved under a "Deleted Member" label or removed?
4. Should platform news emails be handled by a third-party ESP (e.g. Resend, SendGrid) with their own unsubscribe mechanism, or is the internal unsubscribe token sufficient?
