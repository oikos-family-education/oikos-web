# Oikos Mobile App — Build Specification (Flutter)

This document is the build spec for a Flutter mobile app that mirrors the Oikos web product. It is written for Claude Code: feed it this file (or sections of it) and Claude should be able to scaffold and complete the app.

The web app is a Next.js 14 + FastAPI monorepo. The mobile app must consume the **same FastAPI backend** under `/api/v1/...` and reach feature parity with the web. UI must feel like a native mobile experience while preserving the product's visual identity.

---

## 0. Project Setup

### 0.1 Stack
- **Framework**: Flutter 3.22+ (stable channel), Dart 3.4+
- **State management**: Riverpod 2.x (`flutter_riverpod`, `riverpod_annotation`, `riverpod_generator`)
- **Routing**: `go_router` 14+ with deep-link support and a typed route table
- **HTTP**: `dio` with an auth interceptor that attaches cookies from a persistent cookie jar
- **Cookie persistence**: `dio_cookie_manager` + `cookie_jar` (PersistCookieJar) — auth is **cookie-based**, not bearer tokens
- **Storage**: `flutter_secure_storage` for the cookie jar; `shared_preferences` for UI prefs (e.g. saved sidebar/tab state)
- **Forms**: `flutter_hooks` + `reactive_forms` (or `formz`) — pick one and use consistently
- **Validation**: hand-written validators that mirror the web's Zod rules
- **i18n**: `flutter_localizations` + `intl` with ARB files. Source of truth is `apps/web/messages/en.json` — port keys 1:1 (camelCase keys → ARB)
- **Date/time**: `intl` for formatting, `timezone` package for TZ math
- **Charts**: `fl_chart` (used for progress heatmap and streaks)
- **Calendar**: `table_calendar` for month view, custom widgets for day/week
- **Image picker / files**: `image_picker`, `file_picker` (used by portfolio entries)
- **Notifications**: `flutter_local_notifications` (for due reminders) — push notifications are out of scope for v1
- **Linting**: `flutter_lints` + `very_good_analysis`
- **Tests**: `flutter_test`, `mocktail`, golden tests for key screens

### 0.2 Project Layout
```
mobile/
  lib/
    main.dart
    app.dart                        # MaterialApp.router root
    core/
      api/                          # Dio client, interceptors, error mapping
      auth/                         # Auth state, session bootstrap
      theme/                        # ThemeData, colors, typography, spacing
      l10n/                         # generated ARB → Dart
      router/                       # go_router config + guards
      widgets/                      # shared primitives (PrimaryButton, AppTextField, etc.)
    features/
      auth/                         # login, register, forgot, reset
      onboarding/                   # family, coat-of-arms, children
      dashboard/                    # home / today
      family/                       # members, invitations
      children/                     # list + detail
      subjects/
      curriculums/
      planner/                      # week planner
      calendar/
      projects/
      resources/
      notes/
      progress/
      settings/
    main_dev.dart                   # entrypoint with dev API base URL
    main_prod.dart                  # entrypoint with prod API base URL
  test/
  pubspec.yaml
```

Each `features/<name>/` folder contains: `data/` (DTOs + repository), `application/` (Riverpod providers, controllers), `presentation/` (screens + widgets).

### 0.3 API Base URL
- Configurable via `--dart-define=API_BASE_URL=...`
- Default for dev: `http://10.0.2.2:8000` (Android emulator → host) and `http://localhost:8000` (iOS simulator)
- All requests go to `${API_BASE_URL}/api/v1/...`
- The Dio client always sends cookies; the cookie jar persists across launches

### 0.4 Auth Bootstrap
On cold start: `GET /api/v1/auth/me`.
- 200 → user is authenticated. Read `user.has_family` → if `false`, route to onboarding/family. If `has_family` is true but `has_coat_of_arms` is false, route to onboarding/coat-of-arms. Otherwise → dashboard.
- 401 → route to login.

### 0.5 Error Handling
A central `ApiErrorMapper` translates HTTP responses into typed errors that screens render via `Alert` widgets:
- `401` → log out and route to `/login`
- `423` → "Account locked" (account-locked Alert)
- `429` → "Too many attempts" (rate-limited Alert)
- `409` → resource conflict (use endpoint-specific copy)
- `422` → field-level validation errors (FastAPI returns `{detail: [{loc, msg, type}]}`); map to form fields
- 5xx / network → generic "Something went wrong"

---

## 1. Design System

The mobile app must look like the same product as the web. Use these tokens. **Never hardcode hex values in screen code** — always reference the theme.

### 1.1 Colors (port from `packages/config/tailwind.config.js`)
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#6366f1` | Primary actions, active nav, focus ring |
| `primaryHover` | `#4f46e5` | Pressed state of primary buttons |
| `primaryLight` | `#e0e7ff` | Icon badges, selected chip backgrounds |
| `primaryDark` | `#3730a3` | Strong primary text on light bg |
| `secondary` | `#f43f5e` (rose) | Accents, optional secondary actions |
| `background` | `#f8fafc` | App scaffold background |
| `surface` | `#ffffff` | Cards, sheets, dialogs |
| `border` | `#e2e8f0` | Card and divider borders |
| `error` | `#ef4444` | Error text, invalid borders, required asterisk |
| `success` | `#22c55e` | Success Alert, completed states |
| Slate ramp | `slate-500..900` | Body text. Use `slate-800` (#1e293b) for headings, `slate-600` (#475569) for body, `slate-500` (#64748b) for subtle |

Define the ramp in `core/theme/colors.dart` with `AppColors` (a class of `static const Color`).

### 1.2 Typography
- Font family: **Inter** (bundle as a font asset — `assets/fonts/Inter-*.ttf`, 400/500/600/700)
- `displayLarge` is unused — keep the scale narrow:
  - Page title: `TextStyle(fontSize: 22, fontWeight: w700, color: slate800)` (web `text-2xl font-bold`)
  - Section heading: `fontSize: 18, fontWeight: w600`
  - Subtitle: `fontSize: 14, color: slate500`
  - Label: `fontSize: 13, fontWeight: w600, color: slate700`
  - Body: `fontSize: 15, color: slate600`
  - Helper / small: `fontSize: 12, color: slate500`
  - Error: `fontSize: 12, fontWeight: w500, color: error`

### 1.3 Spacing & Radii
- Base unit: 4. Common spacings: 8, 12, 16, 20, 24, 32.
- Card radius: `BorderRadius.circular(12)` (dashboard) or `BorderRadius.circular(32)` for auth/onboarding hero cards (web uses `rounded-[2rem]`)
- Button radius: `BorderRadius.circular(8)`
- Input radius: `BorderRadius.circular(8)`

### 1.4 Card Variants
- **Auth/onboarding hero card** — white at 80% opacity (use `Color(0xCCFFFFFF)`), padding `24` (or `32` ≥ tablet), radius `32`, soft shadow (`BoxShadow(color: Colors.black12, blurRadius: 24, offset: Offset(0, 8))`), white border 1px. Wrap in a subtle gradient/blurred background to evoke the web's `backdrop-blur-xl`.
- **Dashboard content card** — white surface, radius `12`, 1px slate-200 border, padding `16`.

### 1.5 Icons
- Use `lucide_icons` package — same icon set as the web.
- Standard sizes: `20` inline / `40` feature.
- Loading: `CircularProgressIndicator(strokeWidth: 2)` or a small Lucide `Loader2` rotated by `RotationTransition`.

### 1.6 Buttons (primitive)
Build a `PrimaryButton` widget that mirrors `packages/ui/Button.tsx`:
- Height 44 (touch target)
- Background `primary`, foreground white, font weight 500
- Pressed: scale 0.95 + `primaryHover` color (use `AnimatedScale`)
- Disabled: background `Color(0xFFA5B4FC)` (indigo-300), no press effect
- A `loading` prop replaces the label with a centered spinner
- A `SecondaryButton` (outline) variant is needed for "Cancel"/"Skip" actions: white bg, `slate-200` border, slate-800 text
- A `TextLinkButton` (no bg, primary text) for "Forgot password?", "Back to sign in", etc.

### 1.7 Inputs (primitive)
Build `AppTextField` mirroring `packages/ui/Input.tsx`:
- Label above with optional **red asterisk** for required fields (web rule, must be enforced)
- Field: bg `slate-50`, 1px `slate-200` border, radius 8, padding `12 horizontal, 10 vertical`
- Focus: 2px `primary` ring, bg white
- Error: 1px `error` border, bg `red-50`
- Error message renders below in error red
- Optional trailing icon slot

Other primitives to build: `AppDropdown`, `AppDatePicker`, `AppTagInput` (chips with backspace-to-remove), `AppSwitch`, `Alert` (info/success/warning/error variants).

### 1.8 Mobile Navigation
The web uses a sidebar. The mobile app uses a **bottom navigation bar** with 5 tabs and an overflow drawer for the rest:

**Bottom nav (5 tabs)** — match the web's "quick daily access" group:
1. **Home** — Dashboard (Lucide `Home`)
2. **Planner** — Week Planner (Lucide `LayoutGrid`)
3. **Notes** — Notes (Lucide `StickyNote`)
4. **Progress** — Progress (Lucide `BarChart3`)
5. **More** — opens an end drawer with the rest

**Drawer ("More") groups** — match the web sidebar's groups exactly:
- **Educate**: Subjects, Curriculums, Calendar, Projects, Resources
- **Family**: Children, Family
- **Support**: Community (label "Soon"), Assistant (label "Soon")
- **Settings**

The active tab uses `primary` icon + label; inactive uses `slate-500`. Highlight the bar's selected segment with a subtle `primaryLight` pill behind the icon (matches the web's active sidebar item).

### 1.9 Top Bar
Each screen has a `SliverAppBar` (or fixed `AppBar`) with:
- Title (page name, slate-800, weight 700)
- Subtitle on a second line (slate-500, 13pt) describing the page (use the web's per-page subtitles from `Cards`/`Placeholder` namespaces — see §10 for keys)
- Trailing: a `+` action button on screens that support creation (Planner, Notes, Calendar, Projects, Resources, Subjects, Curriculums, Children)

### 1.10 Empty States
Mirror the web: centered icon (40×40 in a `primaryLight` rounded square), heading (slate-800, semibold), subtitle (slate-500), then a primary CTA. Web's empty-state copy keys are reused (e.g. `Dashboard.todayEmpty` / `todayEmptyHint`).

### 1.11 Responsive
- Phone portrait: full bleed, single column, bottom nav.
- Tablet (≥ 720dp width): switch to a **persistent left rail** (icons + labels, mirrors the web sidebar, collapsible) and a content area with `maxWidth: 800` centered. The drawer becomes the rail.
- Always assume dark-mode is **out of scope for v1**.

### 1.12 Form Rules (must follow — web parity)
- Required fields show a red asterisk after the label.
- Validation runs **on blur** — use `autovalidateMode: AutovalidateMode.onUserInteraction`.
- Errors render inline below the field in error red, 12pt, weight 500.
- Submit buttons disable while loading and replace label with a spinner. Never replace the button with a separate Text widget — use the `loading` prop.

---

## 2. Authentication

Cookie-based JWT in `httpOnly` cookies (`access_token`, `refresh_token`). No `Authorization` headers. The cookie jar handles everything once configured.

### 2.1 Endpoints
- `POST /api/v1/auth/login` → `{ email, password }` → `LoginResponse`
- `POST /api/v1/auth/register` → `{ first_name, last_name, email, password, confirm_password, agreed_to_terms }` → `LoginResponse` (201)
- `POST /api/v1/auth/forgot-password` → `{ email }` → `MessageResponse`
- `POST /api/v1/auth/reset-password` → `{ token, new_password, confirm_password }` → `LoginResponse`
- `GET /api/v1/auth/me` → `LoginResponse` (used by AuthProvider on cold start and after every navigation guard)
- `POST /api/v1/auth/logout` → `MessageResponse`
- `POST /api/v1/auth/refresh` → `MessageResponse` (called by Dio interceptor on 401 once before forcing logout)

### 2.2 Schemas (DTOs to generate)
```dart
class UserDto { String id; String email; String? firstName; String? lastName; bool hasFamily; bool hasCoatOfArms; }
class LoginResponse { UserDto user; String? message; }
```

### 2.3 Screens
**Login** (`/login`)
- Hero card layout (centered, max-width 420). Logo at top: indigo gradient square 36×36 with `BookOpen` icon, "Oikos" wordmark next to it, weight 700.
- Heading: "Welcome back" (slate-800, 22pt, weight 700)
- Subtitle: "Sign in to your Oikos account" (slate-500)
- Inputs: Email (required), Password (required, with show/hide toggle as the trailing icon)
- "Forgot your password?" text link, right-aligned under the password
- Primary "Sign in" button, full width
- Footer: "Don't have an account? Create a free account" → `/register`
- Validation: email required + valid; password required.
- On success: re-fetch `/auth/me`, route based on `has_family` → onboarding/family, else if `has_coat_of_arms === false` → onboarding/coat-of-arms, else → dashboard.

**Register** (`/register`)
- Same hero card.
- Heading: "Create your account", subtitle: "Start equipping your family. Free forever."
- Fields: First name *, Last name * (side-by-side on tablet, stacked on phone), Email *, Password * (with strength meter — see below), Confirm password *, "I agree to the Terms of Service and Privacy Policy" checkbox (required)
- **Password strength meter**: bar with 4 segments. Compute a score from these rules (mirror web): min 10 chars, has uppercase, has lowercase, has digit, has special char. Score → label: 0-1 "Weak" (red), 2 "Fair" (orange), 3 "Strong" (success), 4 "Very Strong" (primary).
- Submit → "Create account". 201 routes the user to onboarding/family.
- 409 ("account exists") → render the field-level error on the email input.

**Forgot Password** (`/forgot-password`)
- Heading: "Reset your password", subtitle: "Enter your email and we'll send you a reset link."
- Email input + "Send reset link" button.
- After submit, swap the form for an `Alert.info` reading: "If an account exists for **{email}**, you'll receive a reset link shortly. Check your spam folder if you don't see it." Plus a "Back to sign in" link.

**Reset Password** (`/reset-password?token=...` — reachable via deep link)
- Heading: "Choose a new password", subtitle: "Make sure it's at least 10 characters long."
- New password * + Confirm new password * + strength meter (same rules).
- 200 → show toast/alert "Your password has been reset. Signing you in…" and route to dashboard (the API returns a fresh session cookie).
- 4xx → "This reset link is invalid or has expired." with a "Request a new link" link to `/forgot-password`.

### 2.4 Deep links
Configure `oikos://reset-password?token=...` and `https://app.oikos.example/reset-password?token=...` to route to the reset screen. Use `uni_links` or `app_links`.

---

## 3. Onboarding

After register or first login when `has_family === false`, the user must complete onboarding. Three steps, gated:

1. `/onboarding/family` (creates the family)
2. `/onboarding/coat-of-arms` (sets the family shield)
3. `/onboarding/children` (adds at least one child — can be skipped)

Each step is its own screen. Show a progress indicator at the top: "Step N of 3" plus a horizontal progress bar (primary fill).

### 3.1 Step 1 — Your Family (`/onboarding/family`)
The web does this as a **4-substep wizard** in one page; on mobile, render the same 4 substeps as **a horizontally swipeable PageView** with a stepper at the top.

Substeps (use copy keys from web's `Onboarding` namespace):
1. **Your Family** — `family_name` (required, 2-80 chars, regex `^[\w\s'\-]+$`), `location_city`, `location_country`, `location_country_code`. Helper text from `familyNameHelp` and `locationHelp`.
2. **Faith & Values** — `faith_tradition` (dropdown: christian/jewish/muslim/secular/other/none), `faith_denomination` (text), `faith_community_name` (text, optional), `worldview_notes` (multiline text, max 300, optional).
3. **How You Learn** — `education_purpose` (radio: full_homeschool/school_supplement/family_routine), `education_methods` (multi-select chips, max 3, first selection becomes primary), `current_curriculum` (tag input), `screen_policy` (dropdown: screen_free/minimal/moderate/open), `diet` (dropdown), `outdoor_orientation` (dropdown), `home_languages` (tag input, default `["en"]`).
4. **Your Family Story** — `family_culture` (multiline, max 2000), `visibility` (radio: private/local/public, default local).

**Action bar** at the bottom of every substep: "Back" (secondary) and "Continue" (primary). On the last substep the primary button reads "Create Our Family".

On submit: `POST /api/v1/families` with the assembled body. 201 → toast "Welcome to Oikos, {familyName}! Now let's meet your children." and route to `/onboarding/coat-of-arms`.

### 3.2 Step 2 — Coat of Arms (`/onboarding/coat-of-arms`)
The web has a custom SVG shield builder. On mobile, ship a **simplified configurator** that produces the same `ShieldConfig` shape:

- A live-preview shield rendered with `flutter_svg` (build the SVG client-side from the config — see "Shield rendering" below) at the top of the screen, ~200×240.
- Below it, a stack of grouped option pickers:
  - **Initials** (2-char text input, auto-uppercase, derived default from family name initials)
  - **Shape** (horizontal segmented selector with a small thumbnail of each: heater / rounded / kite / swiss / french / polish / lozenge / oval)
  - **Shield Pattern** (`division`): none/chess/stripes_h/stripes_v/stripes_d/dots/diamonds/stars/crosses/leaves/scales/waves/fleur — show as a horizontal scrolling thumbnail strip
  - **Primary / Pattern / Detail / Symbol colours** — each a row with a swatch + tap-to-open `showColorPicker` (use `flex_color_picker`). Default palette includes the brand primary, a curated set of jewel tones, plus white.
  - **Crest** (`crest_animal`) and **Center Symbol** — dropdowns with a none option
  - **Flourish** — dropdown
  - **Motto** (text, max 60)
  - **Font Style** — segmented: serif/sans/script/gothic/classic
- Two buttons at the bottom: "Save Coat of Arms" (primary) and "Skip for now — I'll do this later" (text link)

Save → `PATCH /api/v1/families/me/shield` with `ShieldConfig` body. Skip → mark and route forward without calling the endpoint.

**Shield rendering**: implement `ShieldRenderer` as a Dart class that takes `ShieldConfig` and emits SVG markup. Port the web's renderer logic. Keep it isolated so it can be reused for displaying shields elsewhere (sidebar, family card).

After saving (or skipping) → route to `/onboarding/children`.

### 3.3 Step 3 — Children (`/onboarding/children`)
- Heading: "Now let's meet your children." Subtitle: "Add one or more children to your family. You can always add more later from your family settings."
- Initially shows a single big "Add a Child" CTA card with a `+` icon. Tapping it opens a full-screen child form (modal with `Navigator.push` / sliding sheet).
- After saving a child, it appears as a card with: nickname or first name, gender icon, age/grade, edit & delete actions.
- Keep an "Add Another Child" outline button below the list.
- Bottom action: "Continue" (primary). If no children added, show a confirmation dialog: "You can add children later from your family settings."

**Child form fields** (required marked *):
- First name *, Nickname, Gender (radio: male/female/prefer_not_to_say)
- "Date of birth or approximate age" — radio between "I'll enter their date of birth" (date picker) and "I'll just enter their approximate age" (year + month dropdowns)
- Grade level (dropdown — auto-suggested from age; allow override). Include K + 1-12 + "Pre-K" + "Other".
- Learning styles (multi-select chips): visual / auditory / kinesthetic / reading_writing / hands_on / collaborative / independent
- Personality description (multiline, max 1000)
- Personality tags (tag input)
- Interests (tag input)
- Motivators (text, max 200), Demotivators (text, max 200)
- Privacy disclaimer block: "This information is private and used only to help the AI assistant adapt its approach. It is never shared."
- Learning differences (multi-select chips: dyslexia / adhd / asd / dysgraphia / dyscalculia / processing / other)
- Accommodations notes (multiline, max 500)
- Support services (tag input)

Save → `POST /api/v1/families/me/children`. On Continue with ≥ 1 child saved → navigate to dashboard.

---

## 4. Dashboard (Home tab)

Endpoint mix:
- `GET /api/v1/auth/me`
- `GET /api/v1/families/me`
- `GET /api/v1/families/me/children`
- `GET /api/v1/week-planner/today` → `TodayRoutineEntryResponse[]`
- `GET /api/v1/curriculums?status=active` (filter client-side or via query)
- `GET /api/v1/notes/upcoming-count` → `{ count }`
- `GET /api/v1/projects/achievements` → recent family-wide achievements
- `GET /api/v1/calendar/events?start=...&end=...` for "Today" (today's events only)

### 4.1 Layout (top → bottom)
1. **Greeting card**: "Good morning, {name}." (use `Dashboard.greeting_morning|afternoon|evening` based on local time). Subtitle: "Today is {date}" formatted with the user's locale.
2. **Coat-of-arms strip**: small (40×48) shield rendered to the left of greeting. If the family has no shield, show a `Setup coat of arms` chip linking to `/settings/coat-of-arms`.
3. **Quick action row** (3 horizontal buttons, full-width row, scrollable on small screens):
   - "Log Progress" (icon `BarChart3`) → opens Progress quick-log sheet (§9)
   - "New Note" (icon `StickyNote`) → opens new-note sheet (§11)
   - "Add Event" (icon `Calendar`) → opens new-event sheet (§7)
4. **Today** card: list of today's combined items (calendar events + routine projections from `/week-planner/today`), each row showing: time range (e.g. "08:00–08:45"), subject color dot, subject/title, child names, source pill ("Calendar event" or "Week planner"). Tapping a row opens the source detail. Empty state: `Dashboard.todayEmpty` + `todayEmptyHint`.
5. **Curriculums** card: up to 3 active curricula, each row showing the name, period, and a small progress bar (computed locally as `today / (end - start)`). Tap → curriculum detail. "View all" link → `/curriculums`. Empty state: `curriculumsEmpty` + `curriculumsEmptyHint`.
6. **Children** card: horizontal scroll of child avatar tiles (initial in a colored circle, name below). Tap → child detail.
7. **Recent achievements** card: up to 3 latest from `/projects/achievements`, each row showing child name + project title + date + a small medal icon. Tap → project detail with the achievement scrolled into view.
8. **Notes due** card: shows "{count} due this week" if `count > 0`, with a button "Open Notes" → `/notes?filter=due`.

All cards use the dashboard card variant (white surface, slate-200 border, radius 12). Section gap: 16dp.

### 4.2 Pull-to-refresh
The whole dashboard supports `RefreshIndicator` that re-fetches all sections in parallel.

---

## 5. Family

Endpoints:
- `GET /api/v1/families/me`, `PATCH /api/v1/families/me`, `DELETE /api/v1/families/me`, `PATCH /api/v1/families/me/shield`
- `GET /api/v1/families/me/members` → list of `MemberResponse` (mix of members and pending invitations, distinguished by `kind`)
- `POST /api/v1/families/me/members/invite` (body `{ email }`)
- `POST /api/v1/families/me/members/invite/{invitation_id}/resend`
- `DELETE /api/v1/families/me/members/invite/{invitation_id}`
- `DELETE /api/v1/families/me/members/{user_id}` (only primary can remove)
- `POST /api/v1/families/me/members/leave` (co-parent only)
- `POST /api/v1/families/me/export` → `{ status, url? }`
- `POST /api/v1/invitations/accept` (body `{ token }`) — used after deep-link

### 5.1 Family screen
Tabs (top tab bar inside the screen): **Profile**, **Members**, **Settings**.

**Profile tab** — read-only summary of the family record with an "Edit" button at the top right. Sections: shield + name (header), location, faith, education philosophy, languages, family culture (collapsible), visibility. Edit opens a multi-section form mirroring the onboarding family wizard, but as a vertical scroll (no swiping), with "Save changes" sticky at the bottom.

**Members tab** — list grouped:
- "Members" — for `kind=member`, show first+last name, email, role pill (Primary / Co-parent), joined date. Trailing kebab: "Remove from family" (primary only, not on self) → confirm dialog.
- "Pending invitations" — for `kind=invitation`, show email, "Invited {date}", "Expires {date}". Trailing kebab: "Resend", "Cancel".
- Floating "+" → opens "Invite a co-parent" sheet (single email input, validation, primary "Send invitation").

If the current user is co-parent (not primary), the bottom of the tab also shows a "Leave family" destructive button → `POST /me/members/leave` with confirm.

**Settings tab**:
- "Coat of arms" → reopens the shield configurator
- "Export family data" → calls export, polls the response status, when ready opens the URL with `url_launcher`
- "Delete family" — destructive — primary only, requires typing the family name to confirm

### 5.2 Invitation acceptance flow
When the user opens a deep link like `oikos://invite?token=...` or visits `/invitations/accept?token=...`, route to a screen that shows:
- Loading → call `POST /api/v1/invitations/accept` with the token
- On success → toast "Welcome to {familyName}!" and route to dashboard
- On failure → "This invitation is invalid or has expired" + "Back to home" button

If the user isn't logged in when they hit the invite link, route to `/login` first and queue the invite token to be redeemed after login (persist with `flutter_secure_storage`).

---

## 6. Children

Endpoints:
- `GET /api/v1/families/me/children` (list)
- `POST /api/v1/families/me/children` (create)
- `GET /api/v1/families/me/children/{child_id}` (detail)
- `PATCH /api/v1/families/me/children/{child_id}` (update)
- `POST /api/v1/families/me/children/{child_id}/archive`
- `POST /api/v1/families/me/children/{child_id}/unarchive`

### 6.1 Children list (`/children`)
- Top bar: title "Children", subtitle "Browse and manage your children", trailing `+`.
- Filter chips at top: "Active" (default) / "Archived" / "All".
- Grid of child cards (1 col on phone, 2 col tablet). Each card: large initial circle (color derived from a stable hash of the name), nickname or first name, age + grade pill, top-3 interests as small chips, kebab menu with Edit / Archive (or Unarchive).
- Tap card → child detail.

### 6.2 Child detail (`/children/[child_id]`)
Hero header: big initial circle, full name, age, grade, gender. Action button: "Edit" (top-right).

Sections (cards):
- **About**: personality, learning styles (chips), interests (chips), motivators, demotivators
- **Learning needs**: differences (chips), accommodations, support services
- **Curriculums**: list of curricula this child is enrolled in (link to each)
- **Recent achievements** (`GET /api/v1/projects/achievements/child/{child_id}`)
- **Portfolio** (`GET /api/v1/projects/portfolio/child/{child_id}`): horizontal scroll of cards with media thumbnail, title, project name, score badge

Edit screen reuses the onboarding child form, pre-populated.

---

## 7. Calendar

Endpoints:
- `GET /api/v1/calendar/events?start=ISO&end=ISO[&child_ids=...&subject_id=...&project_id=...]` → `{ events, routine_projections }`
- `GET /api/v1/calendar/events/{event_id}`
- `POST /api/v1/calendar/events`
- `PATCH /api/v1/calendar/events/{event_id}`
- `DELETE /api/v1/calendar/events/{event_id}`

### 7.1 Calendar screen (`/calendar`)
View toggle in the app bar: **Day / Week / Month**. Default = Month.

**Month view** — `table_calendar` with custom builders:
- Markers: a colored dot per event/projection on each day, capped at 3 dots (overflow rendered as a small "+N").
- Tap a date → switches to Day view for that date.

**Week view** — horizontal scroll between weeks. Vertical timeline 06:00–22:00 (matches `RoutineEntry.start_minute` bounds). Two columns: left "Events", right "Routine". Routine projections render as lighter blocks, calendar events as filled blocks. All blocks show subject color stripe at the leading edge.

**Day view** — same vertical timeline as Week, single column. Tap a block → event detail bottom sheet. Long-press an empty time → quick-create event with start time pre-filled.

### 7.2 Event detail bottom sheet
- Title, time range, location, child names (chips), subject pill, project pill, recurrence label, description (multiline)
- Buttons: "Edit" → form sheet, "Delete" → confirm dialog
- For `is_system: true` events (milestone-* / curriculum-start-*), hide Edit/Delete and show a banner "This event is generated from a {project|curriculum}" with a link.

### 7.3 Event form
- Title *, all-day switch, start datetime, end datetime (validation: end ≥ start)
- Event type (radio chips): family / subject / project / curriculum
- If subject: Subject picker; if project: Project picker
- Children (multi-select)
- Color (color picker, optional — defaults to subject/project color)
- Location (text)
- Recurrence (none/weekly/monthly/yearly)
- Description (multiline, max 1000)

Submit POST/PATCH; close sheet on success and refetch events for the visible range.

---

## 8. Subjects

Endpoints:
- `GET /api/v1/subjects` (mix of platform + family-owned)
- `GET /api/v1/subjects/{id}`
- `POST /api/v1/subjects`
- `PATCH /api/v1/subjects/{id}`
- `DELETE /api/v1/subjects/{id}`
- `POST /api/v1/subjects/{id}/fork` (clones a platform subject into the family's space)

### 8.1 Subjects list
- Top bar: title "Subjects", subtitle "Browse and manage your family's subjects", trailing `+`.
- Filter chips: All / Platform / Family / by Category.
- Search field at the top.
- Each row: colored 36×36 rounded square with the subject's icon (Lucide name), name, category pill, short_description (2-line truncate). Trailing: chevron + small lock icon if `is_platform_subject`.
- Tap row → detail.

### 8.2 Subject detail
- Hero: color block + name + category.
- Sections: long_description, age/grade range, priority, default session length & weekly frequency, learning objectives (bulleted), skills targeted (chips), prerequisites (subject chips that link).
- If platform subject: show "Customize for your family" button → calls `/fork`. The forked copy opens for editing.
- If family-owned: Edit / Delete buttons.

### 8.3 Subject form
- Name *, Category * (dropdown), Color (color picker, default `#6366F1`), Icon (Lucide picker — show a 6-col grid of common icons)
- Short description, long description (multiline)
- Min/max age (number), min/max grade (number)
- Priority (1=high / 2=medium / 3=low)
- Default session duration (minutes), default weekly frequency (1-7)
- Learning objectives (tag input), skills targeted (tag input)
- Prerequisite subjects (multi-select picker)
- "Make public" switch (mostly cosmetic for now)

---

## 9. Curriculums

Endpoints:
- `GET /api/v1/curriculums` (list of `CurriculumListResponse`)
- `GET /api/v1/curriculums/templates` (system templates)
- `GET /api/v1/curriculums/{id}` (full `CurriculumResponse`)
- `POST /api/v1/curriculums` (create)
- `PATCH /api/v1/curriculums/{id}`
- `PATCH /api/v1/curriculums/{id}/status` (body `{ status, force? }`)
- `DELETE /api/v1/curriculums/{id}`
- `POST /api/v1/curriculums/{id}/apply-template`
- `POST /api/v1/curriculums/{id}/subjects` (add subject)
- `PATCH /api/v1/curriculums/subjects/{curriculum_subject_id}`
- `DELETE /api/v1/curriculums/subjects/{curriculum_subject_id}`
- `POST /api/v1/curriculums/{id}/children` (enroll a child)
- `DELETE /api/v1/curriculums/{id}/children/{child_id}` (unenroll)

### 9.1 Curriculums list
- Top bar: title "Curriculums", subtitle "Plan and track your children's curriculum", trailing `+`.
- Status filter chips: Active / Draft / Paused / Completed / Archived / All.
- Each row: name, period_type pill, date range, child avatars stack, status badge.
- Tap → detail.

### 9.2 Curriculum detail
- Hero: name, description, status pill, "Edit" + "Status" actions in the menu.
- "Status" menu: Draft → Active → Paused → Completed → Archived (sequential transitions, with confirm dialogs; pass `force: true` if the API rejects).
- Sections:
  - **Period**: type, dates, academic year, term name
  - **Goals** (bulleted)
  - **Subjects**: list of `CurriculumSubjectResponse`. Each row: subject color + name, weekly frequency pill, session duration pill, scheduled days as 7-dot week strip (filled = scheduled), goals_for_period (chips), edit/remove kebab. "Add subject" button at top → picker that lists available subjects.
  - **Children enrolled**: avatar chips, with a "Manage" button → multi-select sheet to add/remove enrollment.

### 9.3 Curriculum create
- Step 1: Pick "Start from template" or "Start from scratch". Templates fetched from `/curriculums/templates`. Picking a template creates a draft curriculum with seed values via `POST /curriculums` then `POST /apply-template`.
- Step 2: Basic info — name *, description, period_type *, start_date *, end_date * (must be after start_date), academic_year, term_name, education_philosophy, overall_goals (tag input).
- Step 3: Subjects — add subjects with their per-curriculum settings.
- Step 4: Enroll children — multi-select.
- Final action: "Create curriculum" (saves as `draft`) or "Create & activate" (saves then PATCHes status to `active`).

---

## 10. Week Planner

Endpoints:
- `GET /api/v1/week-planner/today` (used by dashboard)
- `GET /api/v1/week-planner/templates` (list)
- `POST /api/v1/week-planner/templates` (create new template)
- `GET /api/v1/week-planner/templates/{template_id}` (full with entries)
- `PATCH /api/v1/week-planner/templates/{template_id}`
- `POST /api/v1/week-planner/templates/{template_id}/activate`
- `DELETE /api/v1/week-planner/templates/{template_id}`
- `DELETE /api/v1/week-planner/templates/{template_id}/entries` (clear all entries)
- `POST /api/v1/week-planner/templates/{template_id}/entries`
- `PATCH /api/v1/week-planner/entries/{entry_id}`
- `DELETE /api/v1/week-planner/entries/{entry_id}`
- `POST /api/v1/week-planner/entries/{entry_id}/duplicate` (body `{ target_days: int[] }`)

### 10.1 Planner screen
- Top bar: title "Week Planner", subtitle "Build your family's weekly routine".
- Template selector pill at the top (e.g. "Term 1 routine ▾"). Tapping opens a sheet listing all templates with an "Active" badge on the active one. Sheet actions: New template, Rename, Activate, Clear all entries, Delete template.
- Below: a **horizontal scroll of 7 day columns** (Mon..Sun) with vertical timeline 06:00–22:00. Each column is ~140dp wide on phones; on tablet show all 7 in one viewport.
- Entries render as colored blocks (subject color fallback `primary`); for `is_free_time`, render as a hatched/striped block in slate-300.
- Tap a block → entry detail sheet (Edit / Duplicate to other days / Delete).
- Long-press an empty cell → opens "New entry" sheet with day_of_week + start_minute pre-filled.

### 10.2 Entry form sheet
- "Free time" switch — when on, the subject picker is hidden, child multi-select still shown.
- Subject (required if not free time)
- Children (multi-select; default = all children)
- Day of week (segmented Mon..Sun)
- Start time (time picker, snapped to 5-minute increments, must be 06:00–22:00)
- Duration (slider 15-300 minutes, default 45)
- Priority (segmented high/medium/low)
- Color override (optional)
- Notes (multiline)
- "Duplicate to other days" multi-select chips visible on edit.

### 10.3 Today widget reuse
The dashboard's "Today" card consumes `GET /week-planner/today` directly — no template fetching needed. Each `TodayRoutineEntryResponse` already includes `subject_name` and `child_names`.

---

## 11. Projects

Endpoints:
- `GET /api/v1/projects` (list)
- `GET /api/v1/projects/{project_id}` (detail)
- `POST /api/v1/projects` (create)
- `PATCH /api/v1/projects/{project_id}` (update)
- `POST /api/v1/projects/{project_id}/complete` (mark complete; awards achievement)
- `POST /api/v1/projects/{project_id}/archive`
- `DELETE /api/v1/projects/{project_id}`
- `POST /api/v1/projects/{project_id}/milestones`
- `PATCH /api/v1/projects/milestones/{milestone_id}`
- `DELETE /api/v1/projects/milestones/{milestone_id}`
- `PUT /api/v1/projects/{project_id}/milestones/reorder` (body: ordered list of milestone IDs)
- `POST /api/v1/projects/milestones/{milestone_id}/toggle/{child_id}` (record/clear completion for a child)
- Resources on a project: `GET/POST/DELETE /api/v1/projects/{project_id}/resources[/{resource_id}]`
- Portfolio: `GET /api/v1/projects/{project_id}/portfolio`, `GET /api/v1/projects/portfolio/child/{child_id}`, `PATCH /api/v1/projects/portfolio/{entry_id}`
- Achievements: `GET /api/v1/projects/achievements`, `GET /api/v1/projects/achievements/child/{child_id}`, `POST /api/v1/projects/achievements/{achievement_id}/acknowledge`, `GET /api/v1/projects/{project_id}/certificate/{child_id}` (returns a binary; open in webview / save / share)

### 11.1 Projects list
- Top bar: title "Projects", subtitle "Create and track multi-week learning projects", trailing `+`.
- Status filter chips: Active / Draft / Complete / Archived.
- Each row: title, due date pill, child avatars stack, subject pills (max 2), milestone progress bar `{completed_milestones}/{milestone_count}` (computed from `completions`).
- Tap → detail.

### 11.2 Project detail
- Hero: title, description, purpose, status pill, due date.
- Children (avatar chips) + subjects (chips).
- **Milestones** section: ordered list, drag-handle to reorder. Each milestone shows title, description, due date. Per child, a row of toggleable check-circles (one per assigned child). Tapping toggles via `/milestones/{id}/toggle/{child_id}`.
- **Resources** section: list of linked resources, "+ Add resource" picker (lists family resources).
- **Portfolio** section: per-child cards. Tapping opens an editor for `title`, `reflection`, `parent_notes`, `score (1-10)`. Media URLs are read-only in v1 (no upload yet).
- Footer actions: "Mark complete" (primary, only when active) / "Archive" / "Edit" / "Delete".
- When marked complete, animate a confetti overlay and toast "Achievement unlocked!"; recent achievements stream now includes this project.

### 11.3 Project form
- Title *, description, purpose, due date
- Status (draft / active)
- Children (multi-select, **at least 1**)
- Subjects (multi-select, max 2)
- Milestones (repeatable rows: title, optional description, due date) — sort order is the row index

### 11.4 Achievements feed
- A "Recent achievements" screen (linked from dashboard "View all"): list `RecentAchievementResponse[]`, each with child name, project title, completed_at, certificate number, and an "Acknowledge" button (calls `/acknowledge`). Tap row → opens project detail.

### 11.5 Certificate
- "View certificate" action on completed projects → fetches `/certificate/{child_id}` (PDF/PNG). Open with `open_filex` after saving with `path_provider`. Provide a "Share" action via `share_plus`.

---

## 12. Resources

Endpoints:
- `GET /api/v1/resources` (list)
- `GET /api/v1/resources/{id}`
- `POST /api/v1/resources`
- `PATCH /api/v1/resources/{id}`
- `DELETE /api/v1/resources/{id}`
- `PATCH /api/v1/resources/{id}/subjects/{subject_id}/progress` (body `{ progress_notes }`)
- `GET /api/v1/resources/subject/{subject_id}` (resources for a subject)
- `POST /api/v1/resources/{id}/subjects/{subject_id}` (link)
- `DELETE /api/v1/resources/{id}/subjects/{subject_id}` (unlink)

### 12.1 Resources list
- Top bar: title "Resources", subtitle "Browse and save books, videos, and materials", trailing `+`.
- Filter chips by `ResourceType`: Book / Article / Video / Course / Podcast / Documentary / Printable / Website / Curriculum / Other / All.
- Search field.
- Row: type icon (Lucide-mapped per type), title, author, subject color dots (one per linked subject, capped at 4 with overflow "+N").
- Tap → detail.

### 12.2 Resource detail
- Title, type pill, author, description.
- "Open link" button (uses `url_launcher` on `url`) when set.
- **Linked subjects** section: list with each subject's `progress_notes`. Each row has an inline "Edit notes" pencil → multiline editor → `PATCH .../progress`. "Add subject" picker to link more.
- Edit / Delete buttons.

### 12.3 Resource form
- Title *, Type * (dropdown), Author, URL (validated URL), Description (multiline)
- Subjects (multi-select)

---

## 13. Notes

Endpoints:
- `GET /api/v1/notes?status=...&entity_type=...&entity_id=...&tag=...&pinned=...&due_before=...&q=...` → `NoteListResponse`
- `GET /api/v1/notes/upcoming-count` → `{ count }`
- `GET /api/v1/notes/tags` → `{ tags: string[] }` (used for tag autocomplete)
- `GET /api/v1/notes/{id}`
- `POST /api/v1/notes`
- `PATCH /api/v1/notes/{id}`
- `DELETE /api/v1/notes/{id}`

### 13.1 Notes list
- Top bar: title "Notes", subtitle "Your family's notes, tasks, and reflections", trailing `+`.
- Filter row (horizontal scroll): All / Pinned / Todo / In progress / To remember / Completed / Archived / Due-this-week.
- Search field above list (debounced).
- Each note card (white surface, slate-200 border, radius 12, padding 12):
  - Top row: title (bold, truncate 1 line) and pinned indicator (Lucide `Pin`)
  - Status pill (color-coded: draft slate, todo primary-light, in_progress amber-100, to_remember purple-100, completed success-100, archived slate-100)
  - Content preview (3-line truncate)
  - Tag chips (max 3 + "+N")
  - Footer row: due date (red if overdue), entity link (e.g. "→ Math" with subject color dot), author name, updated_at relative
- Tap → detail editor; long-press → quick actions sheet (Pin / Toggle status / Delete).

### 13.2 Note editor
Full-screen sheet:
- Title (single line)
- Content (multiline, 8+ visible lines, autofocus on create)
- Status (segmented chips)
- Pinned (switch)
- Due date (date picker, optional, with "Clear" action)
- Entity link picker: Type (none/child/subject/resource/event/project) + Entity (search picker filtered by type)
- Tags (autocomplete from `/notes/tags`, free-form add)
- Save (primary) / Delete (destructive, on edit only)

---

## 14. Progress

Endpoints:
- `POST /api/v1/progress/logs` (create teaching log)
- `GET /api/v1/progress/logs?child_id=&subject_id=&from=&to=` (list)
- `PATCH /api/v1/progress/logs/{id}`
- `DELETE /api/v1/progress/logs/{id}`
- `GET /api/v1/progress/summary?from=&to=` → `ProgressSummaryResponse` (streaks, counts, heatmap)
- `GET /api/v1/progress/neglected` → subjects not taught recently
- `GET /api/v1/progress/report?from=&to=` → `ProgressReportResponse` (printable report)

### 14.1 Progress screen
Top bar: title "Progress", subtitle "Track assessments and generate reports", trailing `+` (opens quick-log sheet).

Two top tabs: **Overview** and **Logs**.

**Overview tab** (consumes `/progress/summary`):
- Date range selector at top: 7 days / 30 days / 90 days / Custom (default 30).
- **Streak card**: big number "{current_weeks} weeks" with subtitle "Longest: {longest_weeks}" and weekly progress (e.g. "{this_week_count} of {weekly_target} this week").
- **Per-child streaks**: horizontal scroll of mini cards.
- **Per-subject streaks**: list with subject color dot, name, current/longest weeks, this-week count.
- **Heatmap**: 7×N grid (rows = weekday, cols = weeks) using `fl_chart` or custom; intensity = `count`. Tap a cell → bottom sheet of that day's logs.
- **Neglected subjects** (`/progress/neglected`): list with last_taught date or "Never".
- "Generate report" button → opens a sheet with date range and "View report" button → `/progress/report` opens a long scrollable report screen (see §14.4).

**Logs tab**:
- Filter chips: child / subject / date range.
- Each row: date (left, bold), child avatar, subject color dot + name, minutes pill, notes preview.
- Tap → edit sheet (only `minutes` and `notes` are editable per schema). Swipe to delete.

### 14.2 Quick log sheet
- Date * (defaults to today)
- Child (radio with "All" option for family-wide log → null `child_id`)
- Subject (search picker; can be null for general)
- Minutes (numeric; optional)
- Notes (multiline, max 500)
- Submit POST.

### 14.3 Report screen
Print-friendly layout (same scroll on mobile). Sections rendered from `ProgressReportResponse`:
- Header: family name, shield (rendered via `ShieldRenderer`), location, generated date, range
- Children table
- Curricula (each with subject summary table)
- Projects (with milestones + completions per child)
- Teach counts (totals + by-child + by-subject)

Trailing actions: "Share" (renders the screen to PDF using `printing` or `pdf` packages and shares).

---

## 15. Settings

Endpoints used: `/auth/me`, `/auth/logout`, family endpoints.

Sections:
- **Profile** (read-only for v1 — first/last name come from auth/me; email read-only)
- **Family** (link → /family)
- **Coat of arms** (link → shield configurator)
- **Language** (locale picker — only `en` for v1, but ship the picker)
- **Notifications** (local toggles for due-date reminders)
- **About** (version from `package_info_plus`, links to web site, privacy policy, terms)
- **Sign out** (calls `/auth/logout`, clears cookie jar, routes to `/login`)

---

## 16. Community & Assistant (Soon)

Both screens render an "Coming soon" placeholder using `Placeholder.title` / `Placeholder.subtitle` from i18n. No API calls.

The drawer items for these features show a `Soon` badge (small primary-light pill).

---

## 17. Internationalization

- Source: copy `apps/web/messages/en.json` into `assets/i18n/en.arb` and add a generation step (`flutter gen-l10n`).
- All strings use `AppLocalizations.of(context).keyName`.
- Namespaces in the JSON map to **prefixed Dart keys** (e.g. `Auth.signInButton` → `authSignInButton`).
- Interpolation: convert `{name}` to ARB-style placeholders.
- Rich-text keys (`agreeToTerms`) are reimplemented with `RichText` and `TapGestureRecognizer` for the link spans.
- Validation messages, ApiErrors, PasswordStrength, Onboarding, Dashboard, Navigation, Cards, Placeholder namespaces are all required.

---

## 18. Local Notifications (v1 minimal)

- After fetching notes with a `due_date`, schedule a local notification at 9:00 local time on the due date with title "Note due today" and the note's title/content preview as body.
- Re-schedule on every successful notes fetch (cancel-and-recreate).
- Settings screen has a master toggle to disable.

Push notifications, email digests, and reminder rules are explicitly **out of scope** for v1.

---

## 19. Acceptance Criteria

Build is considered complete when:

1. A user can register, complete onboarding (family + shield + at least one child), and land on the dashboard — all happy paths covered.
2. Login + reset-password + invitation deep-links work.
3. Every endpoint listed in §2–§14 is reachable from at least one screen.
4. Bottom nav + drawer expose every feature group present on the web sidebar.
5. Visual identity matches the web within reason: same primary, same Inter typography, same card shapes, same iconography (Lucide), same red asterisk on required fields.
6. All user-facing strings come from ARB files — no hardcoded English literals in screen code.
7. The app runs on iOS 14+ and Android 8+ (minSdk 26).
8. No `Authorization` header is ever set; auth flows entirely through the persistent cookie jar.
9. Errors map cleanly: 401 logs out, 423 shows "locked", 429 shows "too many attempts", 422 maps to field errors.
10. The dashboard, notes, planner and progress screens all support pull-to-refresh.

---

## 20. API Conventions (read first)

These rules apply to **every** endpoint in §22 unless explicitly noted.

### 20.1 Base URL & Path Prefix
- All endpoints live under `${API_BASE_URL}/api/v1`. The §22 reference omits the `/api/v1` prefix for brevity — prepend it on every request.

### 20.2 Headers
- `Content-Type: application/json` on all requests with a body
- `Accept: application/json`
- Cookies are managed by the cookie jar; **never** add an `Authorization` header

### 20.3 Authentication
Every endpoint **except** these requires a valid `access_token` cookie:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/refresh`

If a protected endpoint receives a missing/invalid cookie it returns:
```json
HTTP 401 { "detail": "Not authenticated" }
HTTP 401 { "detail": "Invalid token" }
HTTP 401 { "detail": "User not found" }
```

The Dio interceptor must, on a 401 with detail `"Invalid token"`:
1. Call `POST /auth/refresh` once
2. On success, retry the original request once
3. On failure, clear cookies, broadcast a "logged out" event, route to `/login`

### 20.4 Date and DateTime Format
- **`date`** fields: ISO-8601 calendar date `YYYY-MM-DD` (no time, no zone). e.g. `"2026-04-29"`
- **`datetime`** fields: ISO-8601 with timezone, server emits UTC `Z`, e.g. `"2026-04-29T14:33:21.123Z"`. Parse with `DateTime.parse(...).toLocal()` for display.
- Query parameters that take dates use `YYYY-MM-DD`.

### 20.5 IDs
- All resource IDs are **UUID v4 strings**, except `CalendarEvent.id` which is `string` because system-generated events use prefixed forms like `"milestone-<uuid>"` and `"curriculum-start-<uuid>"`. Treat it as opaque.

### 20.6 Standard Error Envelope
FastAPI returns errors as one of two shapes:

**Simple string detail** (most common):
```json
HTTP 4xx { "detail": "Family not configured yet." }
```

**Structured detail with code** (auth flows + a few others):
```json
HTTP 409 { "detail": { "detail": "A user with this email already exists.", "code": "email_taken" } }
HTTP 401 { "detail": { "detail": "Refresh token is invalid or expired.", "code": "invalid_refresh_token" } }
HTTP 400 { "detail": { "detail": "This reset token is invalid or has expired.", "code": "invalid_or_expired_token" } }
```

**Validation error** (always 422, on every endpoint when a body fails Pydantic validation):
```json
HTTP 422 {
  "detail": [
    { "loc": ["body", "email"], "msg": "value is not a valid email address", "type": "value_error.email" },
    { "loc": ["body", "password"], "msg": "ensure this value has at least 10 characters", "type": "value_error.any_str.min_length" }
  ]
}
```

### 20.7 Universal Error Codes
The following errors can be returned by **any** endpoint and the central error mapper must handle them globally:

| Code | When | Mobile behaviour |
|---|---|---|
| `401` | No/invalid cookie | Run refresh-then-retry; on failure log out and route to `/login` |
| `403` | Forbidden (e.g. editing a platform subject) | Show inline Alert with the `detail` text |
| `404` | Resource not found | Show full-screen empty state on detail screens; toast on actions |
| `409` | Conflict (duplicate, race) | Show inline Alert |
| `422` | Validation | Map `loc[1..]` → field; render under inputs |
| `423` | Account locked (login only) | Show "Account locked" Alert |
| `429` | Rate limited | Show "Too many attempts" Alert |
| `5xx` / network | Server error / offline | Show "Something went wrong" Alert with retry |

### 20.8 Status Codes Returned on Success
- `GET` → `200`
- `POST` (create) → `201`
- `POST` (action like `/complete`, `/archive`, `/acknowledge`) → `200`
- `PATCH` / `PUT` → `200`
- `DELETE` → `204` (no body)

### 20.9 Family-Scoped Endpoints
Almost every non-auth endpoint requires the user to have a family. If the user has none, the API returns:
```json
HTTP 400 { "detail": "Must create a family first." }
```
The mobile app must guarantee `has_family === true` before navigating to any feature screen — the auth bootstrap (§0.4) handles this. If a 400 with this detail still slips through, route to `/onboarding/family`.

---

## 21. Data Models

This section defines every Dart model. Use `freezed` + `json_serializable` (or `dart_mappable`) and generate `fromJson` / `toJson`. All field names below are the **JSON wire names** (snake_case) — Dart fields use camelCase with `@JsonKey` annotations.

### 21.1 Common Types

```dart
typedef Uuid = String;
typedef IsoDate = DateTime;     // date only — strip time on serialize
typedef IsoDateTime = DateTime; // full ISO-8601 with TZ

class MessageResponse {
  final String message;
}

class ApiError {
  final int statusCode;
  final String? detail;       // when API returned a string detail
  final String? code;         // when API returned a structured detail with code
  final List<FieldError>? fieldErrors; // when 422
}

class FieldError {
  final List<String> loc;     // e.g. ["body", "email"]
  final String msg;
  final String type;
  String get fieldName => loc.length > 1 ? loc.last : '';
}
```

### 21.2 Auth & User

```dart
class User {
  final Uuid id;
  final String email;
  final String? firstName;          // first_name
  final String? lastName;           // last_name
  final bool hasFamily;             // has_family
  final bool hasCoatOfArms;         // has_coat_of_arms
}

class LoginResponse {
  final User user;
  final String? message;
}
```

### 21.3 Family

```dart
enum FaithTradition { christian, jewish, muslim, secular, other, none }
enum ScreenPolicy { screen_free, minimal, moderate, open }
enum FamilyVisibility { private, local, public }
enum EducationMethod {
  classical, charlotte_mason, montessori, unschooling, structured,
  eclectic, waldorf, unit_study, online, other,
}
enum EducationPurpose { full_homeschool, school_supplement, family_routine }

class ShieldConfig {
  final String initials;            // 1-3 chars
  final String shape;               // heater|rounded|kite|swiss|french|polish|lozenge|oval
  final String primaryColor;        // primary_color, "#RRGGBB"
  final String secondaryColor;      // secondary_color
  final String accentColor;         // accent_color
  final String symbolColor;         // symbol_color, default "#FFFFFF"
  final String division;            // none|chess|stripes_h|stripes_v|stripes_d|dots|diamonds|stars|crosses|leaves|scales|waves|fleur
  final String crestAnimal;         // crest_animal, default "none"
  final String flourish;            // default "none"
  final String centerSymbol;        // center_symbol, default "none"
  final String motto;               // <= 60 chars
  final String fontStyle;           // font_style: serif|sans|script|gothic|classic
}

class Family {
  final Uuid id;
  final String familyName;          // family_name (2..80, regex ^[\w\s'\-]+$)
  final String familyNameSlug;      // family_name_slug
  final Map<String, dynamic>? shieldConfig; // shield_config (raw map; parse with ShieldConfig.fromJson)
  final String? locationCity;
  final String? locationRegion;
  final String? locationCountry;
  final String? locationCountryCode; // ISO-2
  final String? faithTradition;
  final String? faithDenomination;
  final String? faithCommunityName;
  final String? worldviewNotes;     // <= 300
  final String? educationPurpose;   // full_homeschool|school_supplement|family_routine
  final List<String> educationMethods; // education_methods
  final List<String> currentCurriculum; // current_curriculum
  final String? diet;
  final String? screenPolicy;       // screen_policy
  final String? outdoorOrientation; // outdoor_orientation
  final List<String> homeLanguages; // home_languages, default ["en"]
  final String? familyCulture;      // <= 2000
  final String visibility;          // private|local|public
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class FamilyMember {
  final String kind;                // 'member' | 'invitation'
  final Uuid id;
  final Uuid? userId;               // user_id (only for kind='member')
  final String email;
  final String? firstName;
  final String? lastName;
  final String role;                // 'primary' | 'co_parent'
  final String status;              // 'active' | 'pending' | 'expired'
  final IsoDateTime? joinedAt;
  final IsoDateTime? invitedAt;
  final IsoDateTime? expiresAt;
}

class Invitation {
  final Uuid id;
  final Uuid familyId;
  final String email;
  final IsoDateTime expiresAt;
  final Uuid invitedByUserId;       // invited_by_user_id
  final IsoDateTime createdAt;
  final String? token;              // present only on POST/resend response, never on list
}

class FamilyExport {
  final String status;              // 'pending' | 'ready'
  final String? url;                // signed download URL when ready
}
```

### 21.4 Child

```dart
enum Gender { male, female, prefer_not_to_say }

class Child {
  final Uuid id;
  final Uuid familyId;
  final String firstName;           // 1..60
  final String? nickname;           // <= 40
  final String? gender;             // 'male' | 'female' | 'prefer_not_to_say' | null
  final IsoDate? birthdate;
  final int? birthYear;             // 1900..2030 — used when birthdate omitted
  final int? birthMonth;            // 1..12
  final String? gradeLevel;         // grade_level, free-form (e.g. "Pre-K","K","1"…"12","Other")
  final List<String> childCurriculum;     // child_curriculum
  final List<String> learningStyles;      // learning_styles
  final String? personalityDescription;   // <= 1000
  final List<String> personalityTags;
  final List<String> interests;
  final String? motivators;         // <= 200
  final String? demotivators;       // <= 200
  final List<String> learningDifferences;
  final String? accommodationsNotes; // <= 500
  final List<String> supportServices;
  final bool isActive;              // is_active
  final IsoDateTime? archivedAt;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}
```

### 21.5 Subject

```dart
enum SubjectCategory {
  core_academic, language, scripture_theology, arts, physical,
  practical_life, logic_rhetoric, technology, elective, co_op, other,
}

class Subject {
  final Uuid id;
  final Uuid? familyId;             // null on platform subjects
  final String name;                // 1..200
  final String slug;
  final String? shortDescription;   // short_description, <= 500
  final String? longDescription;    // long_description
  final String category;            // SubjectCategory value
  final String color;               // "#RRGGBB", default "#6366F1"
  final String? icon;               // <= 50, Lucide icon name
  final int? minAgeYears;           // 0..25
  final int? maxAgeYears;           // 0..25
  final int? minGradeLevel;         // 0..12
  final int? maxGradeLevel;         // 0..12
  final int priority;               // 1=high, 2=medium (default), 3=low
  final int defaultSessionDurationMinutes; // 5..480, default 45
  final int defaultWeeklyFrequency; // 1..7, default 5
  final List<String> learningObjectives;
  final List<String> skillsTargeted;
  final List<Uuid> prerequisiteSubjectIds;
  final bool isPlatformSubject;     // is_platform_subject — read-only platform seed
  final bool isPublic;              // is_public
  final Uuid? createdByUserId;      // created_by_user_id
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}
```

### 21.6 Curriculum

```dart
enum CurriculumPeriodType { monthly, quarterly, semester, annual, custom }
enum CurriculumStatus { draft, active, paused, completed, archived, template }
enum TimeSlotPreference { morning_first, morning, midday, afternoon, flexible }

class CurriculumSubject {
  final Uuid id;
  final Uuid curriculumId;
  final Uuid subjectId;
  final int weeklyFrequency;        // 1..7, default 5
  final int sessionDurationMinutes; // 5..480
  final List<int> scheduledDays;    // 0..6, length must equal weekly_frequency when set (0=Mon … 6=Sun)
  final String preferredTimeSlot;   // preferred_time_slot
  final List<String> goalsForPeriod; // goals_for_period
  final int sortOrder;              // sort_order
  final bool isActive;              // is_active
  final String? notes;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class ChildCurriculum {
  final Uuid id;
  final Uuid childId;
  final Uuid curriculumId;
  final IsoDateTime joinedAt;
}

class Curriculum {
  final Uuid id;
  final Uuid? familyId;             // null on system templates
  final String name;                // 1..200
  final String? description;
  final String periodType;          // monthly|quarterly|semester|annual|custom
  final IsoDate startDate;          // start_date
  final IsoDate endDate;            // end_date (must be > start_date)
  final String? academicYear;       // <= 20
  final String? termName;           // <= 100
  final String? educationPhilosophy; // <= 200
  final String status;              // draft|active|paused|completed|archived|template
  final List<String> overallGoals;
  final String? notes;
  final Uuid? createdByUserId;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
  final List<CurriculumSubject> curriculumSubjects;
  final List<ChildCurriculum> childCurriculums;
}

class CurriculumListItem {
  final Uuid id;
  final Uuid? familyId;
  final String name;
  final String? description;
  final String periodType;
  final IsoDate startDate;
  final IsoDate endDate;
  final String? academicYear;
  final String status;
  final String? educationPhilosophy;
  final List<ChildCurriculum> childCurriculums;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}
```

### 21.7 Week Planner

```dart
class WeekTemplateSummary {
  final Uuid id;
  final Uuid familyId;
  final String name;                // 1..200
  final bool isActive;              // is_active
  final int entryCount;             // entry_count
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class WeekTemplate {
  final Uuid id;
  final Uuid familyId;
  final String name;
  final bool isActive;
  final List<RoutineEntry> entries;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class RoutineEntry {
  final Uuid id;
  final Uuid templateId;            // template_id
  final Uuid familyId;
  final Uuid? subjectId;            // null when is_free_time
  final bool isFreeTime;            // is_free_time
  final List<Uuid> childIds;        // child_ids
  final int dayOfWeek;              // 0..6 (0=Mon … 6=Sun)
  final int startMinute;            // 360..1320 (06:00..22:00)
  final int durationMinutes;        // 15..300
  final String priority;            // 'high' | 'medium' | 'low'
  final String? color;              // '#RRGGBB' optional
  final String? notes;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class TodayRoutineEntry {
  final Uuid id;
  final Uuid? subjectId;
  final String? subjectName;        // subject_name (server-enriched)
  final bool isFreeTime;
  final List<Uuid> childIds;
  final List<String> childNames;    // child_names (server-enriched)
  final int dayOfWeek;
  final int startMinute;
  final int durationMinutes;
  final String priority;
  final String? color;
  final String? notes;
}
```

### 21.8 Calendar

```dart
enum CalendarEventType { family, subject, project, curriculum }
enum CalendarRecurrence { none, weekly, monthly, yearly }

class CalendarEvent {
  final String id;                  // string — system events use prefixed IDs
  final Uuid? familyId;
  final String title;               // 1..255
  final String? description;        // <= 1000
  final String eventType;           // family|subject|project|curriculum
  final bool allDay;                // all_day
  final IsoDateTime startAt;        // start_at
  final IsoDateTime endAt;          // end_at (>= start_at)
  final List<Uuid> childIds;        // child_ids
  final Uuid? subjectId;
  final Uuid? projectId;
  final Uuid? milestoneId;          // milestone_id
  final String? color;              // '#RRGGBB'
  final String? location;           // <= 255
  final String recurrence;          // none|weekly|monthly|yearly
  final bool isSystem;              // is_system — true for milestone-* / curriculum-start-* events
  final String? sourceUrl;          // source_url (deep-link to source on web)
}

class RoutineProjectionBlock {
  final Uuid entryId;               // entry_id
  final IsoDateTime date;
  final int dayOfWeek;
  final int startMinute;
  final int durationMinutes;
  final Uuid? subjectId;
  final String? subjectName;
  final bool isFreeTime;
  final List<Uuid> childIds;
  final String? color;
  final String? notes;
}

class CalendarQueryResponse {
  final List<CalendarEvent> events;
  final List<RoutineProjectionBlock> routineProjections; // routine_projections
}
```

### 21.9 Resource

```dart
enum ResourceType {
  book, article, video, course, podcast, documentary,
  printable, website, curriculum, other,
}

class SubjectResourceLink {
  final Uuid subjectId;
  final String subjectName;
  final String? progressNotes;      // progress_notes, <= 500
  final IsoDateTime updatedAt;
}

class Resource {
  final Uuid id;
  final Uuid familyId;
  final String title;               // 1..255
  final String type;                // ResourceType value
  final String? author;             // <= 255
  final String? description;
  final String? url;
  final List<SubjectResourceLink> subjects;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}
```

### 21.10 Project

```dart
enum ProjectStatus { draft, active, complete, archived }

class Milestone {
  final Uuid id;
  final Uuid projectId;
  final String title;               // 1..200
  final String? description;
  final int sortOrder;              // sort_order
  final IsoDate? dueDate;           // due_date
  final IsoDateTime createdAt;
}

class MilestoneCompletion {
  final Uuid id;
  final Uuid milestoneId;
  final Uuid childId;
  final IsoDateTime completedAt;    // completed_at
  final String? notes;
}

class ProjectChild {
  final Uuid projectId;
  final Uuid childId;
  final IsoDateTime assignedAt;
}

class ProjectSubject {
  final Uuid projectId;
  final Uuid subjectId;
  final bool isPrimary;             // is_primary
}

class ProjectResource {
  final Uuid projectId;
  final Uuid resourceId;
  final IsoDateTime addedAt;
  final String? notes;
}

class PortfolioEntry {
  final Uuid id;
  final Uuid projectId;
  final Uuid childId;
  final String title;               // 1..200
  final String? reflection;
  final String? parentNotes;        // parent_notes
  final int? score;                 // 1..10
  final List<String> mediaUrls;     // media_urls (read-only in v1)
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class Achievement {
  final Uuid id;
  final Uuid childId;
  final Uuid projectId;
  final IsoDateTime awardedAt;      // awarded_at
  final String certificateNumber;   // certificate_number
  final IsoDateTime? acknowledgedAt; // acknowledged_at
}

class RecentAchievement {
  final Uuid achievementId;
  final Uuid childId;
  final String childName;
  final Uuid projectId;
  final String projectTitle;
  final IsoDateTime completedAt;
  final String certificateNumber;
}

class Project {
  final Uuid id;
  final Uuid familyId;
  final String title;               // 1..200
  final String? description;
  final String? purpose;
  final IsoDate? dueDate;
  final String status;              // draft|active|complete|archived
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
  final IsoDateTime? archivedAt;
  final IsoDateTime? completedAt;
  final List<ProjectChild> children;
  final List<ProjectSubject> subjects;
  final List<Milestone> milestones;
  final List<MilestoneCompletion> completions;
}

class ProjectListItem {
  final Uuid id;
  final Uuid familyId;
  final String title;
  final String? description;
  final IsoDate? dueDate;
  final String status;
  final IsoDateTime createdAt;
  final IsoDateTime? completedAt;
  final List<ProjectChild> children;
  final List<ProjectSubject> subjects;
  final int milestoneCount;         // milestone_count
  final List<MilestoneCompletion> completions;
}
```

### 21.11 Note

```dart
enum NoteStatus { draft, todo, in_progress, to_remember, completed, archived, history_only }
enum NoteEntityType { child, subject, resource, event, project }

class Note {
  final Uuid id;
  final Uuid familyId;
  final Uuid? authorUserId;         // author_user_id
  final String? authorName;         // author_name (server-enriched)
  final String? title;              // <= 255
  final String content;             // required, >= 1 char
  final String status;              // NoteStatus value
  final String? entityType;         // entity_type
  final Uuid? entityId;             // entity_id
  final String? entityLabel;        // entity_label (server-enriched display name)
  final List<String> tags;
  final bool isPinned;              // is_pinned
  final IsoDate? dueDate;           // due_date
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class NoteListResponse {
  final List<Note> items;
  final int total;
}
```

### 21.12 Progress

```dart
class TeachingLog {
  final Uuid id;
  final Uuid familyId;
  final IsoDate taughtOn;           // taught_on
  final Uuid? childId;
  final Uuid? subjectId;
  final int? minutes;               // 1..720
  final String? notes;              // <= 500
  final Uuid loggedByUserId;
  final IsoDateTime createdAt;
  final IsoDateTime updatedAt;
}

class DateRange { final IsoDate from; final IsoDate to; }

class OverallStreak {
  final int? currentWeeks;
  final int? longestWeeks;
  final int? weeklyTarget;
  final int thisWeekCount;
  final IsoDate? lastMetWeekStart;
}

class PerChildStreak {
  final Uuid childId; final String firstName;
  final int? currentWeeks; final int? longestWeeks; final int? weeklyTarget;
  final int thisWeekCount;
}
class PerSubjectStreak {
  final Uuid subjectId; final String name; final String color;
  final int? currentWeeks; final int? longestWeeks; final int? weeklyTarget;
  final int thisWeekCount;
}

class TeachCountByChild { final Uuid childId; final String firstName; final int count; }
class TeachCountBySubject { final Uuid subjectId; final String name; final String color; final int count; }
class TeachCounts {
  final int total;
  final List<TeachCountByChild> byChild;
  final List<TeachCountBySubject> bySubject;
}

class HeatmapCell { final IsoDate date; final int count; }

class ProgressSummary {
  final DateRange range;
  final OverallStreak overallStreak;
  final List<PerChildStreak> perChildStreaks;
  final List<PerSubjectStreak> perSubjectStreaks;
  final TeachCounts teachCounts;
  final List<HeatmapCell> heatmap;
}

class NeglectedSubject {
  final Uuid subjectId;
  final String subjectName;
  final String? color;
  final int? daysSinceLastLog;
  final IsoDate? lastTaughtOn;
  final List<String> assignedChildNames;
}

// Report — large model used by /progress/report
class ReportFamily { final String familyName; final Map<String, dynamic>? shieldConfig; final String? location; }
class ReportChild { final Uuid id; final String firstName; final String? gradeLevel; final bool isActive; }
class ReportCurriculumSubject { final Uuid subjectId; final String name; final String color; final int weeklyFrequency; final List<String> goalsForPeriod; }
class ReportCurriculum {
  final Uuid id; final String name; final String periodType;
  final IsoDate startDate; final IsoDate endDate; final String status;
  final List<ReportCurriculumSubject> subjects;
  final List<Uuid> enrolledChildIds;
}
class ReportMilestoneCompletion { final Uuid childId; final IsoDateTime completedAt; }
class ReportMilestone { final Uuid id; final String title; final IsoDate? dueDate; final List<ReportMilestoneCompletion> completions; }
class ReportProject {
  final Uuid id; final String title; final String status; final IsoDate? dueDate;
  final List<Uuid> childIds; final List<Uuid> subjectIds;
  final List<ReportMilestone> milestones;
}
class ReportTeachCountBySubject { final Uuid subjectId; final String name; final int count; }
class ReportTeachCountByChild { final Uuid childId; final String firstName; final int total; final List<ReportTeachCountBySubject> bySubject; }
class ReportTeachCounts {
  final int rangeDays; final int daysWithAnyLog; final int totalEntries;
  final List<ReportTeachCountByChild> byChild;
  final List<ReportTeachCountBySubject> bySubject;
}

class ProgressReport {
  final IsoDateTime generatedAt;
  final DateRange range;
  final ReportFamily family;
  final List<ReportChild> children;
  final List<ReportCurriculum> curricula;
  final List<ReportProject> projects;
  final ReportTeachCounts teachCounts;
}
```

---

## 22. Complete API Reference

Format for every endpoint:

```
METHOD /path/with/{params}
Auth: required | none
Query: param=type[default] (notes)
Body: { "field": type, ... }
200/201: { "field": type, ... }     ← success response
204: (no body)
Errors: list of (status, code, when)
```

All paths are relative to `${API_BASE_URL}/api/v1`.

### 22.1 Auth

#### `POST /auth/login`
- Auth: none
- Body:
  ```json
  { "email": "string<EmailStr>", "password": "string" }
  ```
- 200: `LoginResponse` — `{ "user": User, "message": null }` + sets `access_token` + `refresh_token` cookies
- Errors:
  - `422` — `email` not a valid email or `password` missing
  - `429` — IP rate-limited (10 attempts / 15 min). `{"detail": "Too many attempts. Please wait before trying again."}`
  - `401` (web has these but auth bypasses passwords in dev — production will return them):
    - `{"detail": "Invalid email or password."}`
    - `{"detail": "Account temporarily locked. Try again later."}` (HTTP 423 in production)

#### `POST /auth/register`
- Auth: none
- Body:
  ```json
  {
    "first_name": "string (1..100)",
    "last_name": "string (1..100)",
    "email": "string<EmailStr>",
    "password": "string (10..128)",
    "confirm_password": "string",
    "agreed_to_terms": true
  }
  ```
- 201: `LoginResponse` + sets cookies
- Errors:
  - `409 { "detail": { "detail": "A user with this email already exists.", "code": "email_taken" } }`
  - `422` validation: `passwords do not match`, `must agree to terms`, password length, etc.
  - `429` IP rate-limited (5 / hour)

#### `POST /auth/forgot-password`
- Auth: none
- Body: `{ "email": "string<EmailStr>" }`
- 200: `{ "message": "If that email is registered, a reset link has been sent." }` (always — never reveals existence)
- Errors:
  - `422` invalid email
  - Note: 429 is silently swallowed by the server and a 200 is returned to prevent enumeration

#### `POST /auth/reset-password`
- Auth: none
- Body: `{ "token": "string", "new_password": "string (10..128)", "confirm_password": "string" }`
- 200: `LoginResponse` + sets cookies (auto-signs the user in)
- Errors:
  - `400 { "detail": { "detail": "This reset token is invalid or has expired.", "code": "invalid_or_expired_token" } }`
  - `422` passwords don't match / length
  - `429` rate-limited (5 / hour per IP)

#### `GET /auth/me`
- Auth: required
- 200: `LoginResponse` (`{ user, message: null }`)
- Errors: `401` (any of the three messages from §20.3)

#### `POST /auth/logout`
- Auth: required
- 200: `{ "message": "Logged out successfully." }` + clears both cookies

#### `POST /auth/refresh`
- Auth: requires `refresh_token` cookie only
- 200: `{ "message": "Token refreshed." }` + sets new access + refresh cookies
- Errors:
  - `401 { "detail": { "detail": "Refresh token is missing.", "code": "invalid_refresh_token" } }`
  - `401 { "detail": { "detail": "Refresh token is invalid or expired.", "code": "invalid_refresh_token" } }`
  - `429` IP rate-limited (30 / 15 min)

---

### 22.2 Families

#### `POST /families`
- Auth: required
- Body: `FamilyCreate` (see fields under §21.3, all optional except `family_name`)
  ```json
  {
    "family_name": "The Harrison Family",
    "shield_config": ShieldConfig | null,
    "location_city": "string?",
    "location_region": "string?",
    "location_country": "string?",
    "location_country_code": "string(2)?",
    "faith_tradition": "christian|jewish|muslim|secular|other|none|null",
    "faith_denomination": "string<=80|null",
    "faith_community_name": "string<=120|null",
    "worldview_notes": "string<=300|null",
    "education_purpose": "full_homeschool|school_supplement|family_routine|null",
    "education_methods": ["classical","..."],
    "current_curriculum": ["string"],
    "diet": "string|null",
    "screen_policy": "screen_free|minimal|moderate|open|null",
    "outdoor_orientation": "string|null",
    "home_languages": ["en"],
    "family_culture": "string<=2000|null",
    "visibility": "private|local|public"
  }
  ```
- 201: `Family`
- Errors:
  - `400 { "detail": "Account already has a family." }`
  - `422` validation (regex on family_name, country code length, enum values)

#### `GET /families/me`
- Auth: required
- 200: `Family`
- Errors: `404 { "detail": "Family not configured yet." }` — route to `/onboarding/family`

#### `PATCH /families/me`
- Auth: required
- Body: `FamilyUpdate` — same shape as `FamilyCreate` but every field optional
- 200: `Family`
- Errors: `404` family not configured

#### `DELETE /families/me`
- Auth: required (must be `primary`)
- 204
- Errors:
  - `404` family not configured
  - `403 { "detail": "Only the primary account holder can delete this family." }`

#### `PATCH /families/me/shield`
- Auth: required
- Body: `ShieldConfig` (full object — every field listed in §21.3 must be provided; `motto` may be empty string)
- 200: `Family` (the updated record)
- Errors: `422` (regex/enum failures on shape, colors, division, font_style)

#### `GET /families/me/members`
- Auth: required
- 200: `FamilyMember[]` — mix of `kind="member"` and `kind="invitation"`
- Errors: `404` family not configured

#### `POST /families/me/members/invite`
- Auth: required (primary only)
- Body: `{ "email": "string (3..255)" }`
- 201: `Invitation` — **includes** the one-time `token` (use to construct invite link)
- Errors:
  - `403` if caller is not primary
  - `409` if email already invited or already a member
  - `422` invalid email format

#### `POST /families/me/members/invite/{invitation_id}/resend`
- Auth: required (primary only)
- 200: `Invitation` (with refreshed `token` and `expires_at`)
- Errors: `403`, `404` invitation not found

#### `DELETE /families/me/members/invite/{invitation_id}`
- Auth: required (primary only)
- 204
- Errors: `403`, `404`

#### `DELETE /families/me/members/{user_id}`
- Auth: required (primary only). Cannot remove self.
- 204
- Errors:
  - `403 { "detail": "Only the primary account holder can remove members." }`
  - `400 { "detail": "Cannot remove yourself; transfer primary or leave first." }`
  - `404` member not found

#### `POST /families/me/members/leave`
- Auth: required (co-parent only)
- 204
- Errors:
  - `400 { "detail": "Primary cannot leave their own family." }`

#### `POST /families/me/export`
- Auth: required
- 200: `FamilyExport` — v1 always returns `{ "status": "pending", "url": null }`. Poll the same endpoint until `status="ready"` and a signed `url` is returned.
- Errors: `404` family not configured

#### `POST /families/me/children`
- Auth: required
- Body: `ChildCreate` (see §21.4 — `first_name` required, all else optional)
- 201: `Child`
- Errors:
  - `400 { "detail": "Must create a family first before adding children." }`
  - `422` validation (first_name length, gender enum, birth_year range, etc.)

#### `GET /families/me/children`
- Auth: required
- Query: `include_archived: bool [false]`
- 200: `Child[]`

#### `GET /families/me/children/{child_id}`
- Auth: required
- 200: `Child`
- Errors: `404 { "detail": "Child not found." }`

#### `PATCH /families/me/children/{child_id}`
- Auth: required
- Body: `ChildUpdate` — same as `ChildCreate` but every field optional
- 200: `Child`
- Errors: `404`, `422`

#### `POST /families/me/children/{child_id}/archive`
- Auth: required
- 200: `Child` (with `is_active=false`, `archived_at` set)
- Errors:
  - `404`
  - `400 { "detail": "Child is already archived." }`

#### `POST /families/me/children/{child_id}/unarchive`
- Auth: required
- 200: `Child` (with `is_active=true`, `archived_at=null`)
- Errors:
  - `404`
  - `400 { "detail": "Child is not archived." }`

---

### 22.3 Invitations

#### `POST /invitations/accept`
- Auth: required (the user accepting becomes a co-parent)
- Body: `{ "token": "string (16..128)" }`
- 200: `Family` — the family the user just joined
- Errors:
  - `400 { "detail": "Invitation invalid, expired, or already used." }`
  - `400 { "detail": "Account already belongs to a family." }`
  - `422` token length

---

### 22.4 Subjects

#### `GET /subjects`
- Auth: required
- Query:
  - `source: "mine"|"platform"|"community"` (optional)
  - `category: SubjectCategory` (optional)
  - `search: string<=200` (optional, matches name + descriptions)
- 200: `Subject[]`

#### `GET /subjects/{subject_id}`
- Auth: required
- 200: `Subject`
- Errors: `404 { "detail": "Subject not found." }`

#### `POST /subjects`
- Auth: required
- Body: `SubjectCreate` (see §21.5; required: `name`, `category`)
- 201: `Subject`
- Errors:
  - `400 { "detail": "Must create a family first." }`
  - `422` validation (color hex, age/grade ranges, priority, frequency)

#### `PATCH /subjects/{subject_id}`
- Auth: required
- Body: any subset of `SubjectCreate`
- 200: `Subject`
- Errors:
  - `404 { "detail": "Subject not found." }`
  - `403 { "detail": "Platform subjects are read-only. Fork it to customise." }`
  - `403 { "detail": "You can only edit your own subjects." }`

#### `DELETE /subjects/{subject_id}`
- Auth: required
- 204
- Errors:
  - `404`
  - `403 { "detail": "Cannot delete platform subjects." }`
  - `403 { "detail": "You can only delete your own subjects." }`
  - `409 { "detail": "Subject is in use by a curriculum/project/routine." }` (if referenced)

#### `POST /subjects/{subject_id}/fork`
- Auth: required — clones a platform subject into the family's space
- 201: `Subject` (the family-owned clone)
- Errors:
  - `404`
  - `400 { "detail": "Only platform subjects can be forked." }`

---

### 22.5 Curriculums

#### `GET /curriculums`
- Auth: required
- Query: `status: CurriculumStatus` (optional)
- 200: `CurriculumListItem[]`

#### `GET /curriculums/templates`
- Auth: required
- 200: `CurriculumListItem[]` (all have `status="template"` and no `family_id`)

#### `GET /curriculums/{curriculum_id}`
- Auth: required
- 200: `Curriculum` (full, with subjects + child enrollments)
- Errors: `404 { "detail": "Curriculum not found." }`

#### `POST /curriculums`
- Auth: required
- Body: `CurriculumCreate`
  ```json
  {
    "name": "string (1..200)",
    "description": "string|null",
    "period_type": "monthly|quarterly|semester|annual|custom",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "academic_year": "string<=20|null",
    "term_name": "string<=100|null",
    "education_philosophy": "string<=200|null",
    "overall_goals": ["string"],
    "notes": "string|null",
    "subjects": [
      {
        "subject_id": "uuid",
        "weekly_frequency": 5,
        "session_duration_minutes": 45,
        "scheduled_days": [0,1,2,3,4],
        "preferred_time_slot": "flexible",
        "goals_for_period": ["string"],
        "sort_order": 0,
        "notes": "string|null"
      }
    ],
    "child_ids": ["uuid"]
  }
  ```
- 201: `Curriculum`
- Errors:
  - `400 { "detail": "Must create a family first." }`
  - `422` `end_date must be after start_date`, `scheduled_days length must equal weekly_frequency`, `scheduled_days values must be 0-6`

#### `PATCH /curriculums/{curriculum_id}`
- Auth: required
- Body: `CurriculumUpdate` (all optional)
- 200: `Curriculum`
- Errors:
  - `404`
  - `403 { "detail": "You can only edit your own curriculums." }`

#### `PATCH /curriculums/{curriculum_id}/status`
- Auth: required
- Body: `{ "status": CurriculumStatus, "force": false }`
- 200: `Curriculum`
- Errors:
  - `404`, `403`
  - `400 { "detail": "Illegal status transition." }` — pass `force: true` to override (still rejected for some terminal states)

#### `DELETE /curriculums/{curriculum_id}`
- Auth: required
- 204
- Errors:
  - `404`, `403`
  - `400 { "detail": "Active curriculums cannot be deleted; archive first." }`

#### `POST /curriculums/{curriculum_id}/apply-template`
- Auth: required — `{curriculum_id}` is the **template** being applied
- 201: `Curriculum` — newly created curriculum that copied the template's subjects
- Errors:
  - `404 { "detail": "Template not found." }`
  - `400 { "detail": "Only templates can be applied." }`

#### `POST /curriculums/{curriculum_id}/subjects`
- Auth: required
- Body: `CurriculumSubjectCreate`
  ```json
  {
    "subject_id": "uuid",
    "weekly_frequency": 5,
    "session_duration_minutes": 45,
    "scheduled_days": [0,1,2,3,4],
    "preferred_time_slot": "flexible",
    "goals_for_period": ["string"],
    "sort_order": 0,
    "notes": "string|null"
  }
  ```
- 201: `CurriculumSubject`
- Errors:
  - `404`, `403`
  - `409 { "detail": "Subject already in this curriculum." }`

#### `PATCH /curriculums/subjects/{curriculum_subject_id}`
- Auth: required
- Body: `CurriculumSubjectUpdate` (any subset, plus optional `is_active`)
- 200: `CurriculumSubject`
- Errors: `404`, `403`

#### `DELETE /curriculums/subjects/{curriculum_subject_id}`
- Auth: required
- 204
- Errors: `404`, `403`

#### `POST /curriculums/{curriculum_id}/children`
- Auth: required
- Body: `{ "child_id": "uuid" }`
- 201: `ChildCurriculum`
- Errors:
  - `404`, `403`
  - `400 { "detail": "Cannot assign children to a template." }`
  - `409 { "detail": "Child already assigned to this curriculum." }`
  - `404 { "detail": "Child not found." }`

#### `DELETE /curriculums/{curriculum_id}/children/{child_id}`
- Auth: required
- 204
- Errors:
  - `404`, `403`
  - `404 { "detail": "Child not assigned to this curriculum." }`

---

### 22.6 Week Planner

#### `GET /week-planner/today`
- Auth: required
- 200: `TodayRoutineEntry[]` (today's entries from the active template, enriched with subject + child names; sorted by `start_minute`)
- Errors: `400` no family

#### `GET /week-planner/templates`
- Auth: required
- 200: `WeekTemplateSummary[]`

#### `POST /week-planner/templates`
- Auth: required
- Body: `{ "name": "string (1..200)", "is_active": false }`
- 201: `WeekTemplate` (with empty `entries`)
- Errors: `422`

#### `GET /week-planner/templates/{template_id}`
- Auth: required
- 200: `WeekTemplate` (with full entries)
- Errors: `404 { "detail": "Week template not found." }`

#### `PATCH /week-planner/templates/{template_id}`
- Auth: required
- Body: `{ "name": "string?" }`
- 200: `WeekTemplate`
- Errors: `404`

#### `POST /week-planner/templates/{template_id}/activate`
- Auth: required — sets this template active and deactivates others
- 200: `WeekTemplate`
- Errors:
  - `404`
  - `409 { "detail": "Template is already active." }`

#### `DELETE /week-planner/templates/{template_id}`
- Auth: required
- 204
- Errors: `404`

#### `DELETE /week-planner/templates/{template_id}/entries`
- Auth: required — clears all entries on the template
- 204
- Errors: `404`

#### `POST /week-planner/templates/{template_id}/entries`
- Auth: required
- Body: `RoutineEntryCreate`
  ```json
  {
    "subject_id": "uuid|null (required when is_free_time=false)",
    "is_free_time": false,
    "child_ids": ["uuid"],
    "day_of_week": 0,            // 0..6
    "start_minute": 480,          // 360..1320 (06:00..22:00)
    "duration_minutes": 45,       // 15..300
    "priority": "medium",         // high|medium|low
    "color": "#RRGGBB|null",
    "notes": "string|null"
  }
  ```
- 201: `RoutineEntry`
- Errors:
  - `404` template not found
  - `422` (range violations on `day_of_week`, `start_minute`, `duration_minutes`)
  - `400 { "detail": "subject_id required when not free time." }`

#### `PATCH /week-planner/entries/{entry_id}`
- Auth: required
- Body: `RoutineEntryUpdate` — any subset of `day_of_week`, `start_minute`, `duration_minutes`, `priority`, `color`, `notes`
- 200: `RoutineEntry`
- Errors: `404 { "detail": "Routine entry not found." }`, `422`

#### `DELETE /week-planner/entries/{entry_id}`
- Auth: required
- 204
- Errors: `404`

#### `POST /week-planner/entries/{entry_id}/duplicate`
- Auth: required
- Body: `{ "target_days": [int] }` — at least 1 day; values 0..6; duplicates current entry to each listed day
- 200: `RoutineEntry[]` (newly created entries)
- Errors:
  - `404`
  - `422` empty `target_days` or out-of-range values
  - `409 { "detail": "Entry already exists on day X at this time." }` (per day; partial success not supported)

---

### 22.7 Calendar

#### `GET /calendar/events`
- Auth: required
- Query:
  - `from: YYYY-MM-DD` **required** (alias for `from_`)
  - `to: YYYY-MM-DD` **required**
  - `child_id: uuid` (optional, filters events that include this child)
  - `event_type: string` (optional, comma-separated list of types: `family,subject,project,curriculum`)
  - `include_system: bool [true]` (include milestone-* and curriculum-start-* synthetic events)
  - `include_routine: bool [false]` (also project routine_projections in response)
- 200: `CalendarQueryResponse`
- Errors:
  - `400 { "detail": "Invalid date format. Use ISO date (YYYY-MM-DD)." }`
  - `400 { "detail": "from must be on or before to." }`
  - `400 { "detail": "Range cannot exceed 366 days." }`

#### `GET /calendar/events/{event_id}`
- Auth: required. `event_id` is opaque (UUID for user events, prefixed string for system events).
- 200: `CalendarEvent`
- Errors: `404 { "detail": "Event not found." }`

#### `POST /calendar/events`
- Auth: required
- Body: `CalendarEventCreate`
  ```json
  {
    "title": "string (1..255)",
    "description": "string<=1000|null",
    "event_type": "family",
    "all_day": false,
    "start_at": "ISO datetime",
    "end_at": "ISO datetime (>= start_at)",
    "child_ids": ["uuid"],
    "subject_id": "uuid|null",
    "project_id": "uuid|null",
    "milestone_id": "uuid|null",
    "color": "#RRGGBB|null",
    "location": "string<=255|null",
    "recurrence": "none"
  }
  ```
- 201: `CalendarEvent`
- Errors:
  - `422 { "detail": [...] }` typically `"end_at must be on or after start_at"`

#### `PATCH /calendar/events/{event_id}`
- Auth: required (system events are not editable)
- Body: any subset of `CalendarEventCreate` fields
- 200: `CalendarEvent`
- Errors:
  - `404`
  - `400 { "detail": "System events cannot be edited." }`

#### `DELETE /calendar/events/{event_id}`
- Auth: required (system events are not deletable)
- 204
- Errors: `404`, `400 { "detail": "System events cannot be deleted." }`

---

### 22.8 Resources

#### `GET /resources`
- Auth: required
- Query:
  - `type: ResourceType` (optional)
  - `subject_id: uuid` (optional)
  - `search: string<=200` (optional)
- 200: `Resource[]`

#### `GET /resources/{resource_id}`
- Auth: required
- 200: `Resource`
- Errors: `404 { "detail": "Resource not found." }`

#### `POST /resources`
- Auth: required
- Body: `ResourceCreate`
  ```json
  {
    "title": "string (1..255)",
    "type": "book|article|video|course|podcast|documentary|printable|website|curriculum|other",
    "author": "string<=255|null",
    "description": "string|null",
    "url": "string|null",
    "subject_ids": ["uuid"]
  }
  ```
- 201: `Resource`
- Errors: `400` no family, `422`

#### `PATCH /resources/{resource_id}`
- Auth: required
- Body: any subset of `ResourceCreate` fields
- 200: `Resource`
- Errors: `404`

#### `DELETE /resources/{resource_id}`
- Auth: required
- 204
- Errors: `404`

#### `PATCH /resources/{resource_id}/subjects/{subject_id}/progress`
- Auth: required
- Body: `{ "progress_notes": "string<=500|null" }`
- 200: `SubjectResourceLink` (the updated link row)
- Errors:
  - `404 { "detail": "Resource not found." }`
  - `404 { "detail": "Subject-resource link not found." }`

#### `GET /resources/subject/{subject_id}`
- Auth: required
- 200: `Resource[]` — resources linked to that subject (each `Resource` carries its full `subjects` array)

#### `POST /resources/{resource_id}/subjects/{subject_id}`
- Auth: required — links a resource to a subject
- Body: none
- 201: `SubjectResourceLink`
- Errors:
  - `404` resource or subject not found
  - `409 { "detail": "Resource already linked to this subject." }`

#### `DELETE /resources/{resource_id}/subjects/{subject_id}`
- Auth: required
- 204
- Errors: `404` link not found

---

### 22.9 Projects

#### `GET /projects`
- Auth: required
- Query: `status: "draft"|"active"|"complete"|"archived"` (optional)
- 200: `ProjectListItem[]`

#### `GET /projects/achievements`
- Auth: required
- Query: `limit: int [10]` (1..50)
- 200: `RecentAchievement[]` — sorted by `completed_at` DESC

#### `GET /projects/{project_id}`
- Auth: required
- 200: `Project`
- Errors: `404 { "detail": "Project not found." }`

#### `POST /projects`
- Auth: required
- Body: `ProjectCreate`
  ```json
  {
    "title": "string (1..200)",
    "description": "string|null",
    "purpose": "string|null",
    "due_date": "YYYY-MM-DD|null",
    "status": "draft",            // draft|active only on create
    "child_ids": ["uuid"],         // min 1
    "subject_ids": ["uuid"],       // 0..2
    "milestones": [
      { "title": "string (1..200)", "description": "string|null", "sort_order": 0, "due_date": "YYYY-MM-DD|null" }
    ]
  }
  ```
- 201: `Project`
- Errors:
  - `400 { "detail": "A project can have at most 2 subjects." }`
  - `422` (`child_ids` empty, etc.)

#### `PATCH /projects/{project_id}`
- Auth: required
- Body: `ProjectUpdate` (any subset; `status` may be `draft|active|complete|archived`)
- 200: `Project`
- Errors:
  - `404`
  - `400 { "detail": "A project can have at most 2 subjects." }`

#### `POST /projects/{project_id}/complete`
- Auth: required — sets status to `complete`, awards an `Achievement` per child
- 200: `Project` (with `completed_at` set)
- Errors:
  - `404`
  - `400 { "detail": "Project is already complete." }`

#### `POST /projects/{project_id}/archive`
- Auth: required
- 200: `Project` (with `archived_at` set, `status="archived"`)
- Errors: `404`

#### `DELETE /projects/{project_id}`
- Auth: required
- 204
- Errors: `404`

#### `POST /projects/{project_id}/milestones`
- Auth: required
- Body: `MilestoneCreate`
  ```json
  { "title": "string (1..200)", "description": "string|null", "sort_order": 0, "due_date": "YYYY-MM-DD|null" }
  ```
- 201: `Milestone`
- Errors: `404` project not found

#### `PATCH /projects/milestones/{milestone_id}`
- Auth: required
- Body: any subset of `MilestoneCreate` fields
- 200: `Milestone`
- Errors: `404 { "detail": "Milestone not found." }`

#### `DELETE /projects/milestones/{milestone_id}`
- Auth: required
- 204
- Errors: `404`

#### `PUT /projects/{project_id}/milestones/reorder`
- Auth: required
- Body: `{ "milestone_ids": ["uuid", "uuid", ...] }` — full ordered list
- 200: `Milestone[]` (in the new order)
- Errors:
  - `404` project not found
  - `400 { "detail": "milestone_ids must contain every milestone exactly once." }`

#### `POST /projects/milestones/{milestone_id}/toggle/{child_id}`
- Auth: required — toggles a `MilestoneCompletion` for that child (creates if absent, deletes if present)
- 200: `{ "milestone_id": "uuid", "child_id": "uuid", "completed": true|false, "completed_at": "ISO|null" }`
- Errors:
  - `404` milestone or child not found
  - `400 { "detail": "Child is not assigned to this project." }`

#### `GET /projects/{project_id}/resources`
- Auth: required
- 200: `ProjectResource[]`

#### `POST /projects/{project_id}/resources`
- Auth: required
- Body: `{ "resource_id": "uuid", "notes": "string|null" }`
- 201: `ProjectResource`
- Errors: `404`, `409` already linked

#### `DELETE /projects/{project_id}/resources/{resource_id}`
- Auth: required
- 204
- Errors: `404`

#### `GET /projects/{project_id}/portfolio`
- Auth: required
- 200: `PortfolioEntry[]`

#### `GET /projects/portfolio/child/{child_id}`
- Auth: required
- 200: `PortfolioEntry[]`

#### `PATCH /projects/portfolio/{entry_id}`
- Auth: required
- Body: `{ "title": "string?", "reflection": "string?", "parent_notes": "string?", "score": "1..10|null" }`
- 200: `PortfolioEntry`
- Errors: `404 { "detail": "Portfolio entry not found." }`

#### `GET /projects/achievements/child/{child_id}`
- Auth: required
- 200: `Achievement[]`

#### `POST /projects/achievements/{achievement_id}/acknowledge`
- Auth: required — sets `acknowledged_at` to now
- 200: `Achievement`
- Errors: `404 { "detail": "Achievement not found." }`

#### `GET /projects/{project_id}/certificate/{child_id}`
- Auth: required
- 200: **binary** — `Content-Type: application/pdf` (treat as `Uint8List` and save with `path_provider`/`open_filex`)
- Errors:
  - `404`
  - `400 { "detail": "Project is not complete." }`

---

### 22.10 Progress

#### `POST /progress/logs`
- Auth: required
- Body: `TeachingLogCreate`
  ```json
  {
    "taught_on": "YYYY-MM-DD",      // required
    "child_id": "uuid|null",         // null = family-wide log
    "subject_id": "uuid|null",
    "minutes": 45,                   // 1..720, optional
    "notes": "string<=500|null"
  }
  ```
- 201: `TeachingLog`
- Errors:
  - `400 { "detail": "taught_on cannot be in the future." }`
  - `400 { "detail": "taught_on cannot be more than 365 days in the past." }`
  - `404 { "detail": "Child not found." }` / `404 { "detail": "Subject not found." }`
  - `409 { "detail": "You already logged that combination for this day." }`

#### `GET /progress/logs`
- Auth: required
- Query: `from: date?`, `to: date?`, `child_id: uuid?`, `subject_id: uuid?`
- 200: `TeachingLog[]`

#### `PATCH /progress/logs/{log_id}`
- Auth: required
- Body: `{ "minutes": 1..720|null, "notes": "string<=500|null" }`
- 200: `TeachingLog`
- Errors: `404 { "detail": "Teaching log not found." }`

#### `DELETE /progress/logs/{log_id}`
- Auth: required
- 204
- Errors: `404`

#### `GET /progress/summary`
- Auth: required
- Query: `from: date?`, `to: date?`, `child_id: uuid?` (default range = last 30 days)
- 200: `ProgressSummary`

#### `GET /progress/neglected`
- Auth: required
- Query: `threshold_days: int [14]` (1..365) — subjects not taught in N days
- 200: `NeglectedSubject[]`

#### `GET /progress/report`
- Auth: required
- Query: `from: date` **required**, `to: date` **required**, `child_id: uuid?`
- 200: `ProgressReport`
- Errors:
  - `404 { "detail": "Family not found." }`
  - `422` missing `from` / `to`

---

### 22.11 Notes

#### `GET /notes`
- Auth: required
- Query (all optional unless noted):
  - `status: string[]` (repeatable; one of NoteStatus values)
  - `entity_type: "child"|"subject"|"resource"|"event"|"project"`
  - `entity_id: uuid`
  - `author_user_id: uuid`
  - `tag: string[]` (repeatable)
  - `pinned: bool`
  - `due_before: YYYY-MM-DD`
  - `overdue: bool [false]`
  - `q: string` (full-text search on title + content)
  - `sort: string [created_at_desc]` (one of: `created_at_desc`, `created_at_asc`, `updated_at_desc`, `due_date_asc`)
  - `limit: int [50]` (1..200)
  - `offset: int [0]`
- 200: `NoteListResponse` `{ items, total }`

#### `GET /notes/upcoming-count`
- Auth: required
- 200: `{ "count": int }` — count of notes with `due_date` in the next 7 days that aren't `archived`/`completed`

#### `GET /notes/tags`
- Auth: required
- 200: `{ "tags": ["string"] }` — distinct tags used in this family, sorted alphabetically

#### `GET /notes/{note_id}`
- Auth: required
- 200: `Note`
- Errors: `404 { "detail": "Note not found." }`

#### `POST /notes`
- Auth: required
- Body: `NoteCreate`
  ```json
  {
    "content": "string (>=1)",
    "title": "string<=255|null",
    "status": "draft",                                          // any NoteStatus value
    "entity_type": "child|subject|resource|event|project|null",
    "entity_id": "uuid|null",                                   // entity_type required when entity_id set
    "tags": ["string"],
    "is_pinned": false,
    "due_date": "YYYY-MM-DD|null"
  }
  ```
- 201: `Note`
- Errors:
  - `422 { "detail": "Invalid status: ..." }`
  - `422 { "detail": "Invalid entity_type: ..." }`
  - `422 { "detail": "entity_type required when entity_id is given." }`
  - `404 { "detail": "{entity_type} not found in your family." }`

#### `PATCH /notes/{note_id}`
- Auth: required
- Body: any subset of `NoteCreate` fields
- 200: `Note`
- Errors: `404`, `422` (same validation set as POST)

#### `DELETE /notes/{note_id}`
- Auth: required
- 204
- Errors: `404`

---

## 23. Implementation Order (suggested for Claude Code)

1. Project scaffold + theme + i18n + Dio/cookie auth client + auth bootstrap + go_router with guards.
2. Auth screens (login, register, forgot, reset).
3. Onboarding (family wizard → coat-of-arms → children).
4. Dashboard + bottom nav + drawer scaffold.
5. Family + Children screens (read + edit).
6. Notes (CRUD + filters).
7. Subjects + Curriculums.
8. Week Planner.
9. Calendar.
10. Projects (incl. milestones + portfolio).
11. Resources.
12. Progress (overview + logs + report).
13. Settings + Local notifications + polish pass (empty states, loading skeletons, error states, golden tests for hero screens).
