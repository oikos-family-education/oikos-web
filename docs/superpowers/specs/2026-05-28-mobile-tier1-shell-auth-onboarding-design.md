# Oikos Mobile — Tier 1 Specs: Shell, Auth & Onboarding

**Status:** Draft
**Date:** 2026-05-28
**Specs:** 04, 05, 06 of the Mobile App Spec Roadmap (`2026-05-28-mobile-app-spec-roadmap.md`)
**Depends on:** `2026-05-28-mobile-foundation-design.md` (spec 01 — product, design language, domain glossary, responsive strategy) and assumes spec 02 (App Architecture) and spec 03 (Bearer-token auth) decisions. Where this doc references the API client, secure token storage, the adaptive scaffold, or design tokens, those are defined in 01/02/03.
**Scope of this file:** the **entry experience** — how the app is structured and navigated (04), how a user signs in/out and recovers access (05), and how a brand-new account becomes a usable family (06). These are grouped because they form one continuous first-run flow and share the same gating logic.

> **How this maps to the web.** The behaviors below are ported from `apps/web`: the dashboard `Sidebar`, `AuthProvider`, `middleware.ts`, the `auth` router, and the onboarding wizard (`FamilyWizard`, `ChildrenOnboarding`, `CoatOfArmsOnboarding`/`ShieldBuilder`). The mobile app reuses the **same FastAPI endpoints**; only the auth transport changes (bearer tokens, spec 03).

---

# Spec 04 — Navigation Shell & Adaptive Layout

## 4.1 Purpose

Define the one shell every authenticated screen lives inside: how primary navigation renders on a phone (portrait) versus a tablet (landscape), the app bar, the home/"today" surface, and the deep-link/route model. Every feature spec (07–23) plugs its screens into this shell rather than inventing its own chrome.

## 4.2 The web model being ported

The web uses a persistent left **Sidebar** (collapsible, 64↔256px) with destinations in four groups plus Settings:

- **Quick (top):** Dashboard, Notes, Progress
- **Educate:** Subjects, Curriculums, Planner, Calendar, Projects, Lessons, Resources
- **Family:** Children, Family
- **Support:** Messages *(unread badge)*, Discover, Communities *(pending-request badge)*, Assistant *(soon)*
- **Settings** (ungrouped), plus a **Family Identity** block (the shield + family name) pinned at the bottom.

That is ~16 destinations — far too many for a phone's primary bar. The mobile shell reorganizes the same destinations across an adaptive structure.

## 4.3 AdaptiveScaffold

A single widget (defined in spec 02) selects layout by width class (foundation §4):

### Compact — phone portrait (`< 600`)
- **Bottom navigation bar** with **5 destinations**: **Home**, **Planner**, **Lessons**, **Messages** *(unread badge)*, **More**.
  - The first four are the highest-frequency daily jobs; everything else lives behind **More**.
  - **More** opens a full-screen menu listing the remaining destinations under the same group headings as the web (Educate, Family, Support), plus Settings and the account/family-identity block. This preserves full parity without crowding the bar.
- **App bar** (top): screen title, a **notifications** bell *(unread badge → notification center, spec 22)*, and a **family-identity avatar** (the shield) that opens an **account menu** (profile, theme toggle, settings, log out).
- Detail screens push as full pages (`Navigator` push). Back gesture/AppBar back returns to the list.
- A screen's primary create action uses a **FAB** (e.g. "+ Lesson", "+ Note").

### Expanded — tablet landscape (`≥ 840`, orientation-locked landscape)
- **NavigationRail (extended)** on the leading edge replaces the bottom bar and shows the **full grouped destination list** (the web sidebar, natively) — no "More" bucket needed. The family-identity block sits at the rail's foot; the rail is collapsible to icons-only, mirroring the web's collapse toggle (persist the choice locally, like the web's `oikos-sidebar-collapsed`).
- **Master-detail (two-pane)** for list/detail surfaces (foundation §4.4): the list is a fixed-width leading pane (~360–420px), the selected item fills the trailing pane. Selecting an item updates the trailing pane in place — no full-screen push while both panes are visible.
- App bar spans the detail pane; notifications + account menu live at the rail foot or a top-trailing app-bar slot.

### Medium (`600–839`)
Fallback to the compact pattern with a wider content column. A surface may opt into two-pane if it clearly benefits, but this band is not a primary target.

## 4.4 Home / "Today"

The landing destination after auth (web `/dashboard`). Glanceable, capture-first:

- **Today's routine** — the active Week Planner's `RoutineEntry`s for the current weekday (subject color, time, which children).
- **Today's lessons** — `Lesson`s `scheduled_for` today, with status.
- **Quick log** — a prominent action to record a `TeachingLog` (spec 13) in a couple of taps.
- **Needs attention** — subjects untouched past `ui_preferences.neglected_threshold_days` (foundation §5.3).
- **Recent notifications** — top few from the bell.

On tablet, Home may use a multi-column dashboard; on phone it's a single scroll.

## 4.5 Routing & deep links

- Route names mirror web paths (`/dashboard`, `/lessons/:id`, `/community/:slug/forum/:topicId`, …) so links are portable and analytics line up.
- **Universal links / app links** (iOS `applinks`, Android `assetlinks`) map the production web domain to in-app routes, and carry the **password-reset token** (spec 05) and **community/family invite tokens** (specs 06/19) into the app.
- A central route table lives in spec 02; each feature spec registers its routes there.

## 4.6 Badges & live counts

The web polls two counts every 60s for sidebar badges:
- **Messages unread** — `GET /api/v1/messages/unread-count` → `threads`.
- **Communities admin-pending** — `GET /api/v1/communities/admin-pending-count` → `count`.

Mobile shows the same badges (bottom-bar Messages, More→Communities). v1 polls on the same cadence while the app is foregrounded; **push** (spec 22) later replaces polling for freshness. Polling fails silently — a badge just stays hidden on error (web parity).

## 4.7 Cross-cutting

- **Theme & accessibility** (foundation §3): the shell reads `ui_preferences` (theme, font scale, reduce motion, high contrast, dyslexia font) and applies them app-wide. The account menu exposes a quick theme toggle; full controls live in Settings (spec 18).
- **Loading & empty states** use the shared components (spec 24); the global auth/splash loader matches the web's centered spinner.
- **Offline:** none in v1 (foundation). A lost-connection banner + retry is the only concession; data is always fetched live.

---

# Spec 05 — Auth & Account Flows

## 5.1 Purpose

Let a user create an account, sign in, recover a forgotten password, and sign out — and define the **launch-time auth gate** that decides where the user lands. Uses bearer tokens (spec 03), not the web's httpOnly cookies.

## 5.2 Screens

| Screen | Web parity | Notes |
|--------|-----------|-------|
| **Splash / Auth gate** | `AuthProvider` init | Not a visible "page" on web; on mobile it's the launch gate (see §5.5). Shows the centered loader while resolving. |
| **Login** | `(auth)/login` | Email + password. Links to Register and Forgot Password. |
| **Register** | `(auth)/register` | First/last name, email, password (+ confirm). Optional `invite_token` (beta) carried via deep link. |
| **Forgot Password** | `(auth)/forgot-password` | Email field; always shows the same success message (anti-enumeration). |
| **Reset Password** | `(auth)/reset-password` | Reached via email deep link carrying the reset token; new password + confirm. |

All auth screens use the **hero-card** aesthetic (foundation §3.3) on the gradient onboarding background, single-column and centered on every width class (no master-detail here).

## 5.3 Endpoints & contracts (reused from `auth` router)

| Action | Endpoint | Rate limit (web) | Returns |
|--------|----------|------------------|---------|
| Login | `POST /api/v1/auth/login` | 10 / 15 min per IP | `LoginResponse { user }` + tokens (spec 03) |
| Register | `POST /api/v1/auth/register` | 5 / hour per IP | `201` + `LoginResponse { user }` + tokens |
| Forgot password | `POST /api/v1/auth/forgot-password` | 3 / hour per email (silent) | generic `message` (always 200) |
| Reset password | `POST /api/v1/auth/reset-password` | 5 / hour per IP | `LoginResponse { user }` + tokens |
| Current user | `GET /api/v1/auth/me` | — | `LoginResponse { user }` |
| Logout | `POST /api/v1/auth/logout` | — | revokes refresh token |
| Refresh | `POST /api/v1/auth/refresh` | 30 / 15 min per IP | new token pair |

> **Spec 03 dependency.** The web sets tokens as httpOnly cookies in these responses. For mobile, spec 03 must make these same endpoints **also** return the access + refresh tokens in the JSON body (or a documented header) and accept `Authorization: Bearer <access>` + a refresh call that takes the refresh token explicitly (no cookie). This spec assumes that capability.

## 5.4 Token lifecycle (client side)

- On successful **login/register/reset**, persist the access + refresh tokens in **secure storage** (Keychain / Keystore via the mechanism chosen in spec 02/03).
- The API client attaches `Authorization: Bearer <access>` to every request.
- **Access token ~60 min, refresh ~long-lived** (matching web JWT settings). A **silent refresh** runs ~10 min before access expiry (web refreshes every 50 min) **and** a reactive refresh fires on any `401`: refresh → retry the original request once.
- If refresh fails (`401` with `invalid_refresh_token`), clear all tokens and route to **Login**.
- **Logout** calls `POST /auth/logout` (best-effort) and unconditionally clears local tokens, then routes to Login.

## 5.5 Launch-time auth gate (ports `AuthProvider` branching)

On app launch / resume from cold:

```
load tokens
  └─ none?            → Login
GET /auth/me
  ├─ 401              → try refresh → retry /me; still 401 → Login
  ├─ ok, !has_family  → Onboarding: Family (spec 06)
  ├─ ok, !has_coat_of_arms → Onboarding: Coat of Arms (spec 06)
  └─ ok, fully set up → load /families/me, then Home (spec 04)
```

Locale: the web re-routes to the user's stored `locale` when it differs from the active one. Mobile applies the user's `locale` to the i18n layer (spec 25) at this point instead of changing the URL.

## 5.6 Validation & error handling

- **Email**: required, valid format. **Password**: min 10 chars (security rules); register shows a strength hint mirroring the web's `PasswordStrength`. Confirm-password must match. Validation is **on-blur** with inline errors (foundation §3.4).
- Status-code handling (foundation §6):
  - **401** invalid credentials → inline "email or password is incorrect."
  - **423** account locked (repeated failures) → message with guidance; surfaces the locked state from `User.locked_until`.
  - **429** rate limited → "too many attempts, try again later."
  - **400** on register with an `invite_*` code (invalid/used/expired/email-mismatch invite) → map each `code` to a clear message.
- Forgot-password **always** shows the same neutral success ("If that email is registered, a reset link has been sent.") regardless of outcome.

## 5.7 Reset-password deep link

The reset email links to the web today. For mobile, the link must resolve via universal/app links (spec 04 §4.5) to the in-app **Reset Password** screen with the token prefilled; if the app isn't installed, it falls back to the web page. The screen submits the token + new password to `/auth/reset-password`, which logs the user in (returns tokens) — route straight into the auth gate (§5.5) afterward.

## 5.8 Out of scope (v1)

Biometric unlock, social/OAuth login, "remember this device," and multi-account switching are not in v1. Flag biometric unlock as a likely fast-follow given secure-storage is already in place.

---

# Spec 06 — Onboarding

## 6.1 Purpose

Turn a fresh account into a usable family: create the **Family**, optionally add **Children**, and design the **family shield (coat of arms)**. Completion is gated by two user flags — `has_family` and `has_coat_of_arms` — which the auth gate (§5.5) checks on every launch until both are true.

## 6.2 Flow & gating

```
Register/Login → (auth gate) →
  Step A: Family wizard      → POST /families  → sets has_family
  Step B: Children (optional, skippable)
  Step C: Coat of Arms       → PATCH family.shield_config → sets has_coat_of_arms
  → Home
```

- A user who quits mid-onboarding is returned to the correct step on next launch by the gate's flag checks (Family before Coat of Arms).
- **Children is genuinely optional** and skippable (with a confirm prompt, web parity); it does **not** gate entry.

## 6.3 Step A — Family wizard (ports `FamilyWizard`, 3 steps)

A 3-step wizard with a progress indicator. **Only the family name is required** (≥ 2 chars); steps 2–3 are entirely optional. Submitting `POST /api/v1/families` with the assembled payload sets `has_family` and advances to Children.

| Step | Fields (from `Family`, foundation §5.1) |
|------|------------------------------------------|
| **1 — Basics & location** | `family_name` *(required)*, location: city / region / country (+ derived `country_code`) |
| **2 — Faith & education** | faith tradition, denomination, community name, worldview notes; education purpose, education methods (multi), current curriculum |
| **3 — Lifestyle & culture** | diet, screen policy, outdoor orientation, home languages (multi), `family_culture` free text |

Mobile layout:
- **Phone:** each step is a full-screen page; a top progress bar (3 segments) and a bottom **Back / Next** row; the final step's button reads **Create family** and shows a spinner while submitting. Empty optional fields are omitted from the payload (web parity — sent as `undefined`).
- **Tablet landscape:** the wizard is centered in a constrained-width hero card; progress can move to the side. No two-pane needed (a wizard is inherently single-flow).
- **Errors:** validation array from the API is surfaced inline (joined messages, web parity); network errors show a retryable banner.

## 6.4 Step B — Children (ports `ChildrenOnboarding` + `AddChildForm`)

- A list of **child cards** (avatar, display name per the nickname-or-first_name rule in foundation §3.4, grade) with an **Add child** action that opens an inline/sheet form.
- **AddChildForm** captures `Child` fields (foundation §5.1): `first_name` *(required)*, nickname, gender, birthdate / birth year+month, grade level, and the optional **learning profile** (learning styles, interests, personality, motivators/demotivators, learning differences, accommodations, support services). Each add posts to the children API; the card appears on success.
- **Continue** with zero children shows a **skip confirmation** (amber note), then proceeds. With ≥1 child it proceeds directly. Advances to Coat of Arms.
- Mobile layout: cards in a single column (phone) / grid (tablet); the add form is a bottom sheet on phone, a side/inline panel on tablet.

## 6.5 Step C — Coat of Arms / Shield builder (ports `CoatOfArmsOnboarding` + `ShieldBuilder`)

The family **shield** is core to Oikos identity (it appears in the nav, on printable reports, etc.). The builder edits a `shield_config` object and renders a **live preview**. Saving persists `shield_config` on the family and sets `has_coat_of_arms`, which unlocks Home.

**`shield_config` shape (exact, from `ShieldBuilder`):**
`initials`, `shape`, `primary_color`, `secondary_color`, `accent_color`, `symbol_color`, `division` (background pattern), `crest_animal`, `flourish`, `center_symbol`, `font_style`.

Vocabularies (carried verbatim so web and mobile render identically):
- **shape:** heater, rounded, kite, swiss, french, polish, lozenge, oval
- **division (pattern):** none, chess, stripes_h/v/d, dots, diamonds, stars, crosses, leaves, scales, waves, fleur
- **center_symbol:** none, cross, star, fleur, eagle, shield_mini, circle, diamond, crescent, heart, sun, clover, crown, sword, chalice, tower, anchor, key, compass, book, trident
- **crest_animal:** none, crown_imperial, star_6, star_8, fleur_de_lis, helm, sunburst, double_eagle, crescent_moon, winged_crown, tudor_rose, mural_crown, cinquefoil, maltese_cross
- **flourish:** none, laurel, oak, scrolls, roses, ribbon, crossed_swords, wings, torches, spears, axes, vines, candles, banners
- **font_style:** serif, sans, script, gothic, classic
- color palettes for primary / secondary / accent / symbol come from the same heraldic swatch sets as the web.

Behaviors:
- **Live preview** updates on every change.
- **Randomize** generates a coherent random shield (and derives default `initials` from the family name) — web parity.
- **Initials** default from the family name; editable.

Mobile layout:
- **Tablet landscape:** the natural two-pane — **preview pane** (large, trailing) + **controls pane** (segmented pickers, leading). This is a marquee tablet surface.
- **Phone:** preview pinned at top, scrollable picker sections below (shape → colors → pattern → symbol → crest → flourish → font), with a sticky **Save** action.

### 6.6 Open question — rendering the shield in Flutter

The web shield is an SVG composed of shape paths, pattern `<defs>`, symbol/crest paths, and hand-authored flourish SVG groups. Two options for mobile, to be decided in implementation:

1. **Reuse the SVG** — generate the same SVG markup from `shield_config` and render with `flutter_svg`. Lowest divergence risk; one source of truth for the heraldry vocabulary. **Recommended.**
2. **Reimplement with `CustomPainter`** — native paths/patterns. More control and performance, but duplicates a large, fiddly vocabulary and risks visual drift from the web.

Because the shield appears in many places (nav identity, reports, child/family chips), settle this once here and expose a single reusable `FamilyShield(config)` widget consumed everywhere — do not re-solve per screen.

## 6.7 Success criteria

1. A new account reaches Home only after a family exists **and** a shield is saved; quitting mid-flow resumes at the right step.
2. The family wizard accepts a name-only submission and treats all other fields as optional (web parity).
3. Children can be added or skipped without blocking entry.
4. The rendered shield is visually consistent with the web for the same `shield_config`.
