# Spec 03 — Home Dashboard & Navigation

**Project:** Oikos — Open Source Family Education Platform  
**Spec Version:** 1.0  
**Depends On:** Spec 01 (Auth & Family Registration), Spec 02 (Onboarding)  
**Scope:** Post-authentication home page, application shell, and global navigation

---

## 1. Overview

After a family completes onboarding (Spec 02) **or** logs back into an existing account, they land on the **Family Dashboard** — the home page of the application.

At this stage in the product (Phase 0–1), the dashboard body is intentionally minimal: a warm, encouraging message addressed to the family. The primary purpose of this screen is to orient the parent and give them clear, fast access to every area of the platform through the global navigation.

The navigation shell built in this spec will persist across **all future pages** of the application. Every feature area added in later phases (Spec 04 onwards) will slot into this shell.

---

## 2. Entry Points

| Trigger | Behaviour |
|---|---|
| User completes onboarding flow | Redirect to `/dashboard` |
| User logs in with existing account | Redirect to `/dashboard` |
| User visits any authenticated route without a session | Redirect to `/login`, then back to intended route |
| User visits `/` while authenticated | Redirect to `/dashboard` |

---

## 3. Application Shell

The shell wraps every authenticated page. It is composed of:

- **Global navigation** (primary wayfinding — position and pattern at Claude Code's discretion)
- **Header / top bar** (if the chosen nav pattern warrants one)
- **Page content area** (where each route renders its content)
- **Optional utility bar** (notifications, help, quick actions — include only if it fits the nav pattern cleanly)

> **Design authority:** Claude Code should choose the navigation pattern (sidebar, top nav, nav, or another pattern) that best fits the existing codebase aesthetic and that serves parents managing a family well. Consider: parents will use this on desktop at a desk. The nav must work excellently at both breakpoints.

### 3.1 Navigation Areas

The following areas must be reachable from the global nav. Each entry maps to a route. Routes that do not yet have a page should render a **placeholder page** (see Section 6).

| Area | Route | Icon hint | Notes |
|---|---|---|---|
| Dashboard (Home) | `/dashboard` | Home / house | Active state when on home |
| Family | `/family` | Users / family | Family profile, settings |
| Children | `/children` | Child figure or star | List of children profiles |
| Disciplines | `/disciplines` | Book or pencil | Curriculum subjects |
| Lesson Planner | `/planner` | Calendar grid | Weekly plan view |
| Calendar | `/calendar` | Calendar | Full calendar view |
| Projects | `/projects` | Layers or folder | Multi-week projects |
| Resources | `/resources` | Library / bookmark | Resource library |
| Journal | `/journal` | Notebook or feather | Daily learning journal |
| Progress | `/progress` | Chart or award | Assessments and reports |
| Assistant | `/assistant` | Sparkle or chat bubble | AI teaching assistant |
| Community | `/community` | Globe or people | Family discovery, co-ops, events |
| Settings | `/settings` | Gear | Account and platform settings |

> Claude Code should group these items sensibly if the nav pattern supports grouping (e.g. an "Educate" group for Disciplines / Planner / Calendar / Projects, a "Family" group for Family / Children / Journal / Progress, etc.). Grouping is optional but preferred if it reduces cognitive load.

### 3.2 Active State

The active nav item must be visually distinct (highlight, indicator, or similar). The Dashboard item is active when the route is `/dashboard`.

### 3.3 Family Identity in Nav

Somewhere in the shell (header, nav footer, avatar area, or similar), display:

- **Family name** (from the family profile, e.g. "The Murphy Family")
- **Family Coats of Arms (not motto)** (fallback to an grey empty shield)
- A **dropdown or link** from this element containing:
  - Link to `/family` (Family Profile)
  - Link to `/settings`
  - **Sign out** action


---

## 4. Home Dashboard Page (`/dashboard`)

### 4.1 Purpose

The dashboard gives the family a calm, welcoming home base. In this phase it contains no data widgets — those come in later specs. Its job is to:

1. Welcome the family by name
2. Offer an encouraging word to the parent
3. Provide clear visual entry points to the main platform areas

### 4.2 Welcome Section

Display a **personalised greeting** at the top of the page content area:

- **Time-aware salutation:** "Good morning", "Good afternoon", or "Good evening" based on the user's local time
- **Family name:** e.g. "Good morning, Murphy family."
- **Date:** current day and date in a human-friendly format (e.g. "Monday, 23 March 2026")

### 4.3 Encouraging Message

Below the greeting, display a single **encouraging message** for the parent. This is static for now (not AI-generated in this spec).

The message should affirm the parent's role as their child's primary educator. Tone: warm, grounded, confident — not saccharine. A single sentence or two is sufficient.

The quote should be visually understated (smaller, muted text) — secondary to the greeting.

### 4.4 Quick-Access Navigation Cards

Below the welcome section, render a **grid of navigation cards** — one per major platform area. These are a visual, touch-friendly alternative to the nav menu and help orient new families.

Each card contains:
- An **icon** (matching the nav icon)
- A **label** (the area name)
- A **one-line description** of what the area does

Suggested card content:

| Card | Description |
|---|---|
| Disciplines | Set up subjects and curriculum for each child |
| Lesson Planner | Plan your school week, day by day |
| Calendar | View your full schedule at a glance |
| Projects | Create and track multi-week learning projects |
| Resources | Browse and save books, videos, and materials |
| Journal | Log what you covered and how it went |
| Progress | Track assessments and generate reports |
| Assistant | Get lesson ideas, explanations, and support |
| Community | Find and connect with like-minded families |

> **Layout:** Claude Code decides the grid layout (2-column, 3-column, responsive, etc.) that best fits the design. Cards should be clearly tappable on mobile. Cards that link to unbuilt routes should still be rendered and navigate to the placeholder page.

### 4.5 Empty State Philosophy

There are **no data widgets** on the dashboard in this spec. No "upcoming lessons", no "today's schedule", no progress bars. Those belong to later phases. The dashboard must feel **complete and intentional** in its simplicity — not broken or unfinished.

---

## 5. Placeholder Pages

Every route listed in Section 3.1 (except `/dashboard`) needs a **placeholder page** for this spec so that navigation links are functional.

Each placeholder page should display:

- The **page title** (e.g. "Disciplines")
- A brief **one-line description** of what the page will do (referencing the project plan)
- A visual indicator that this section is **coming soon** (badge, illustration, or subtle label)
- A **back to dashboard** link

Placeholder pages must render inside the application shell (with full nav visible). They must not look like error pages.

---

## 6. Routing & Guards

### 6.1 Authentication Guard

All routes under the authenticated shell (`/dashboard`, `/children`, `/family`, etc.) must be protected. An unauthenticated visitor is redirected to `/login`.

### 6.2 Onboarding Guard

If an authenticated user has **not yet completed onboarding** (i.e. no family profile exists), they must be redirected to the onboarding flow (Spec 02) before reaching the dashboard.

### 6.3 Post-Onboarding Redirect

On completion of onboarding, the user is redirected to `/dashboard`. This should feel like a smooth, intentional transition (not a jarring page reload).

---

## 7. Data Requirements

For this spec, the dashboard and shell require only:

| Data | Source | Used for |
|---|---|---|
| `family.name` | Family profile | Greeting, nav identity |
| `user.name` or `user.email` | Auth session | Avatar fallback / initials |
| `family.shield` (not motto) | SVG field | Nav avatar |
| Current datetime | Browser / server | Time-aware greeting, date display |

No lesson, child, or progress data is fetched or displayed on the dashboard in this spec.

---

## 8. Accessibility & Performance

- All nav items must have accessible labels (aria-label or visible text)
- Icon-only nav items (if any) must have tooltips or screen-reader text
- Focus management: on route change, focus should move to the main content area
- The shell and dashboard must achieve a **Lighthouse performance score ≥ 90** on desktop
- The application shell must not cause layout shift (CLS = 0) on load

---

## 9. Out of Scope for This Spec

The following are explicitly deferred to later specs:

- Mobile layouts
- Dashboard data widgets (upcoming lessons, today's plan, recent journal entries)
- Notification system
- Search / command palette
- Child switcher (quick-switch between children's views)
- Any content within the placeholder pages
- AI assistant integration
- Community features

---

## 10. Acceptance Criteria

| # | Criteria |
|---|---|
| 1 | An authenticated, onboarded user landing on `/dashboard` sees the welcome section with correct time-aware greeting and today's date |
| 2 | The encouraging message and optional Scripture quote are visible on the dashboard |
| 3 | Navigation cards for all 10 major areas are visible and tappable |
| 4 | Clicking any nav card or nav menu item navigates to the correct route |
| 5 | All routes that have no content yet render a well-designed placeholder page (not a 404 or error) |
| 6 | The family name is visible in the navigation shell |
| 7 | The user can sign out from the nav identity element |
| 8 | Unauthenticated users are redirected to `/login` |
| 9 | Active nav item is visually distinct |
| 10 | The page renders without console errors |