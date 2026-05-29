# Oikos Mobile — Product, Design Language & Domain Foundation

**Status:** Draft
**Date:** 2026-05-28
**Spec:** 01 of the Mobile App Spec Roadmap (`2026-05-28-mobile-app-spec-roadmap.md`)
**Depends on:** Nothing. This is the root spec — every other mobile spec references it.
**Audience:** Whoever implements the Flutter app (`apps/mobile`) and writes the downstream feature specs. Read this before writing any other mobile spec.

---

## 1. What Oikos is and why it exists

Oikos is an **open-source family education platform** — built for homeschooling and other family-led education. Today it is a web app; the work this spec set covers is bringing it to **native mobile (iOS & Android)** via Flutter.

**The problem it solves.** Families who educate their own children carry the load that a school's staff and software normally carry: planning what each child studies, scheduling the week, teaching and recording what actually happened, tracking progress, keeping resources and projects organized, and producing records when an authority or co-op asks for them. They juggle this across multiple children of different ages, often with different learning needs, and usually with two parents sharing the work. Generic tools (spreadsheets, calendars, note apps) don't understand *family education* — they have no concept of a child's learning profile, a subject's place in a curriculum, or a teaching session that needs logging.

**What Oikos provides.** A single home for the whole operation: define your **family** and **children** (with rich learning profiles), build **subjects** and **curriculums**, plan the **week**, author and teach **lessons**, **log** what was taught, watch **progress**, run **projects** that culminate in **achievements**, keep a **resource** library and **notes**, manage a **calendar**, and — increasingly — connect with other families through **communities**, **meetups**, and **messages**.

**Why mobile matters.** Education doesn't happen at a desk. A parent logs a reading session on the couch, checks tomorrow's plan while making breakfast, snaps the day's nature-study notes outdoors, and replies to another family from the car. The web app assumes a keyboard and a large screen; the phone and tablet meet the family where teaching actually happens. Tablets in particular are common homeschool teaching surfaces — held in landscape, shared between parent and child.

**Guiding values** (these shape every design decision):

1. **Child privacy is sacred.** Children's names, photos, and precise data never leak outside the family. Social surfaces expose only counts and age ranges. This is a hard constraint inherited from the web (`community-area` spec §4), and the mobile app must honor it identically.
2. **Respect for the family's worldview.** Faith tradition, education philosophy, and family culture are first-class fields, not afterthoughts. The product is value-neutral in mechanism but lets families express their values.
3. **Calm, not gamified.** This is a tool for stewardship, not engagement farming. No streaks-for-streaks'-sake, no manipulative notifications.
4. **Two parents, one family.** Co-parents share a family's data; roles are `primary` and `co_parent`.

## 2. Who uses it (and how mobile changes the job)

| User | What they do | Mobile-specific job |
|------|-------------|---------------------|
| **Primary parent** (account owner) | Sets up the family, builds curriculums, plans, teaches, records | Quick capture (log a session, jot a note), at-a-glance "what's today", on-the-go review |
| **Co-parent** | Shares teaching and recording | Same as above; needs to see what the other parent already logged |
| *(Children are subjects of the data, not users.)* | — | — |

The mobile app is **not** a cut-down "viewer." It targets full parity. But its *interaction model* optimizes for the mobile jobs above: glanceable home, fast capture, thumb-reachable primary actions, and (on tablet) a comfortable two-pane teaching/planning surface.

## 3. Design language

The mobile app must feel like **the same product** as the web app — same palette, same typography family, same calm aesthetic — expressed natively in Flutter rather than literally porting Tailwind/HTML. The source of truth for the web is `apps/web/app/globals.css`, `packages/config/tailwind.config.js`, and `.claude/rules/design-system.md`. The tables below translate those into Flutter `ThemeData`/token decisions for the downstream specs to consume.

### 3.1 Color tokens

Define these as a single `OikosColors` token set (light + dark), wired into `ThemeData.colorScheme` and exposed via a `ThemeExtension` so feature code references semantic names, never raw hex.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `#6366F1` (indigo 500) | same | Primary actions, active nav, links |
| `primaryHover`/pressed | `#4F46E5` | same | Pressed/hover state |
| `primaryLight` | `#E0E7FF` | tinted surface | Icon badges (`primary/10`), selected chips |
| `primaryDark` | `#3730A3` | — | Emphasis text on light |
| `secondary` | `#F43F5E` (rose) | same | Accent, secondary emphasis |
| `background` | `#F8FAFC` (slate-50) | `#0F172A` (slate-950) | App/page background |
| `surface` | `#FFFFFF` | `#1E293B` (slate-800) | Cards, sheets, app bar |
| `border` | `#E2E8F0` (slate-200) | `#334155` (slate-700) | Dividers, card borders |
| `error` | `#EF4444` | same | Errors, required asterisk, destructive |
| `success` | `#22C55E` | same | Success states |
| text strong / body / subtle | slate-800 / slate-600 / slate-500 | slate-100 / slate-300 / slate-400 | Headings / body / captions |

**Dark mode is required** (the web has it). It is driven by the user's `ui_preferences.theme` (`light`/`dark`, plus a "follow system" option mobile may add). Subject/community colors are user-data hex values (`Subject.color`, `RoutineEntry.color`) and render as-is in both themes.

### 3.2 Typography

- **Font: Inter** (bundle it; do not depend on a CDN). Maps to the web's global Inter.
- Scale (translate web tokens → Flutter `TextTheme`):

| Role | Web equivalent | Mobile spec |
|------|----------------|-------------|
| Page title | `text-2xl font-bold text-slate-800` | `headlineSmall`, w700, text-strong |
| Section heading | `text-lg font-semibold` | `titleMedium`, w600 |
| Subtitle | `text-slate-500 mt-1` | `bodyMedium`, text-subtle |
| Label | `text-sm font-semibold text-slate-700` | `labelLarge`, w600 |
| Body | `text-slate-600` | `bodyMedium` |
| Helper / caption | `text-xs text-slate-500` | `bodySmall`, text-subtle |
| Error text | `text-xs font-medium text-red-500` | `bodySmall`, w500, error |

- **Accessibility text scaling** is a product feature, not just OS behavior: `ui_preferences.font_size` (`default`/`large`/`xl` → web 16/18/20px) maps to an app-level `textScaler` floor, layered on top of the OS setting. Also honor `reduce_motion`, `high_contrast`, and `dyslexia_font` (OpenDyslexic) from `ui_preferences`.

### 3.3 Surfaces, shape & elevation

- **Cards:** rounded, low-elevation, 1px border in `border` token. Two card flavors mirror the web:
  - *Content card* (dashboard): radius ~12 (`rounded-xl`), surface bg, hairline border, 16px padding.
  - *Hero card* (auth/onboarding): radius ~32 (`rounded-[2rem]`), soft shadow, translucent surface (the web's glassmorphism). On mobile, approximate with a frosted/blurred container on the gradient onboarding background; degrade gracefully where blur is costly.
- **Spacing scale:** 4/8/12/16/20/24 (Tailwind-aligned). Section gaps 16–20; major section separation 24–32.
- **Icons:** the web uses `lucide-react` exclusively. Mobile uses the **`lucide` Flutter icon set** (or `lucide_icons` package) so glyphs match 1:1. Standard inline size 20, feature/badge size 40 (icon 24 inside a `primary/10` rounded badge). Loading uses a spinner equivalent to `Loader2 animate-spin`.

### 3.4 Component parity

Downstream spec 24 (Shared UI Library) defines the Flutter analogues of `@oikos/ui`. The non-negotiable parity rules carried from the web:

- **Buttons** are always the shared `OikosButton` (centered, no text wrap — the web's `inline-flex items-center justify-center whitespace-nowrap`). Loading state replaces the label with a centered spinner. Disabled while submitting.
- **Required form fields** show a red asterisk next to the label (web form-guidelines). The shared `OikosTextField` renders it from a `required` flag.
- **Form validation** uses an on-blur model with inline error text under the field, mirroring the web's `react-hook-form` + `zod` `mode: 'onBlur'`.
- **Child display name rule (critical, carried verbatim from `frontend-conventions.md`):** always render a child by **nickname when set, otherwise first_name**; initials derived the same way. Never use `avatar_initials`, never `first_name[0]` directly. Provide `childDisplayName(child)` / `childInitials(child)` helpers and use them for every chip, avatar, badge, label, and tooltip. *Exception:* printable/legal documents show the real `first_name`.

### 3.5 Motion

Calm and quick. Standard transitions ~150–250ms, eased. All motion is gated by the `reduce_motion` preference (and OS reduce-motion), which collapses durations to near-zero — the same contract as the web's `html.reduce-motion`.

## 4. Responsive strategy

The single most important mobile-specific decision. The app has **two layout modes** selected by available width, not device type, with these breakpoints (logical pixels):

- **Compact (`< 600`)** — phones in portrait. Single column. Primary navigation is a **bottom navigation bar** (thumb-reachable). Detail screens push as full pages. Primary action is a FAB or a pinned bottom button.
- **Expanded (`≥ 840`)** — tablets in **landscape** (the required tablet orientation). **Navigation rail** on the leading edge replaces the bottom bar. List+detail surfaces become **master-detail (two-pane)**: the list is a fixed-width leading pane, the selected item fills the trailing pane. No full-screen push for detail when both panes are visible.
- **Medium (`600–839`)** — small tablets / large phones / phones in landscape. Default to the compact pattern but allow a wider content column; specs may opt a surface into two-pane if it clearly benefits. This band is a fallback, not a primary target.

Rules the downstream specs inherit:

1. **One adaptive scaffold.** Spec 04 defines a single `AdaptiveScaffold` that renders bottom-nav vs nav-rail and single-pane vs two-pane from the width class. Feature screens declare a `list` pane and an optional `detail` pane; they do **not** each re-implement responsiveness.
2. **Tablet is landscape-locked** for the app's main surfaces (phones are portrait-first but need not be locked). Lock orientation accordingly; confirm exact lock policy in spec 02/04.
3. **Content max-width.** On very wide panes, constrain text/content width (web uses `max-w-5xl`) so lines don't run edge-to-edge.
4. **The marquee two-pane surfaces** are the Week Planner (12), Lessons (11), Subjects (9), Curriculums (10), Messages (21), and Communities/Forum (19). These are explicitly designed for tablet master-detail; their specs must show both layout modes.

## 5. Building blocks (domain glossary)

This is the canonical vocabulary. Every feature spec uses these terms exactly. The mobile app consumes the **existing FastAPI models** (no schema changes except the auth tokens in spec 03), so these mirror `apps/api/app/models/*`.

### 5.1 Identity & household

- **User** — an account (email + password). Has locale/timezone/date/time preferences, `notification_preferences`, and `ui_preferences` (theme, font size, reduce motion, high contrast, dyslexia font). Flags: `has_family`, `has_coat_of_arms` (drive onboarding gating). A user belongs to a family via FamilyMember.
- **Family** — the household and the central tenant; nearly every record hangs off `family_id`. Has a `family_name` + slug, a **shield_config** (the coat-of-arms / family crest), location (city/region/country — city never exposed socially), faith fields (tradition, denomination, community), education fields (purpose, methods, current curriculum), lifestyle fields (diet, screen policy, outdoor orientation, home languages), `family_culture` free text, `visibility`, and a `discoverable` opt-in gate for the social surfaces.
- **FamilyMember** — links a User to a Family with a `role`: `primary` (owner) or `co_parent`.
- **FamilyInvitation** — a tokenized email invite for a co-parent to join a family.
- **Child** — a learner in the family. Identity (`first_name`, optional `nickname`, gender, avatar initials), age (`birthdate`/`birth_year`/`birth_month`, `grade_level`), and a **learning profile**: learning styles, personality (description + tags), interests, motivators/demotivators, learning differences, accommodations notes, support services. Can be archived (`is_active`/`archived_at`). **Display by nickname-or-first_name (see §3.4).**

### 5.2 What is taught

- **Subject** — a teachable area (e.g. "Latin", "Biology"). Belongs to a family (or is a platform subject). Has a `category` (core_academic, language, scripture_theology, arts, physical, practical_life, logic_rhetoric, technology, elective, co_op, other), a **color** and **icon** (visual identity), age/grade guidance, `priority` (high/med/low), default session duration & weekly frequency, learning objectives, skills targeted, prerequisites. Can be public/platform-shared.
- **Curriculum** — a plan over a **period** (monthly/quarterly/semester/annual/custom) with start/end dates, an `academic_year`/`term`, an education philosophy, a `status` (draft/active/paused/completed/archived/template), and overall goals.
  - **CurriculumSubject** — a subject's placement inside a curriculum: weekly frequency, session duration, scheduled days, preferred time slot, goals for the period, sort order.
  - **ChildCurriculum** — assigns a child to a curriculum.
- **Lesson** — a single teachable unit under a subject. Has a title, a per-(family,subject) `sequence_number` (surfaces as "Subject #007"), `scheduled_for` date, estimated/actual duration, a `status` (draft/scheduled/in_progress/completed/cancelled), objectives, tags, and a **rich-text body** (`content_html`). On completion it records `actual_duration_minutes`, `completion_notes`, `taught_on`.

### 5.3 Planning & doing

- **WeekTemplate + RoutineEntry** ("Week Planner") — a reusable weekly routine grid. A template configures the visible hours and which weekend days show. Each **RoutineEntry** places a subject (or "free time") on a `day_of_week` at a `start_minute` for a `duration`, scoped to specific children, with priority and an optional color. This is the primary **tablet-landscape** surface.
- **TeachingLog** — a record that a session happened: `taught_on` date, optional child/subject/lesson, minutes, notes, logged-by user. The atom of "what actually happened," feeding progress.
- **Progress** — derived views over teaching logs, lessons, and curriculum coverage (per child, per subject, "needs attention" when a subject is neglected past `ui_preferences.neglected_threshold_days`). Includes a **printable report**.

### 5.4 Enrichment & records

- **Project** — a cross-subject undertaking with a purpose, due date, and `status`. Composed of:
  - **ProjectChild / ProjectSubject** — which children and subjects it involves.
  - **ProjectMilestone** + **MilestoneCompletion** — ordered milestones, completed per child.
  - **PortfolioEntry** — a child's artifact for a project (title, reflection, parent notes, score 1–10, media URLs).
  - **ChildAchievement** — a certificate awarded to a child on project completion (has a certificate number).
- **Resource** — a reference item (book/article/video/course/podcast/documentary/printable/website/curriculum/other) with title, author, description, URL. **SubjectResource** links resources to subjects with progress notes. Projects can attach resources too.
- **Note** — a note or to-do with content, `status` (draft/todo/in_progress/to_remember/completed/archived/history_only), optional attachment to an entity (child/subject/resource/event/project), tags, pinning, and a due date.
- **CalendarEvent** — a dated/timed event (`event_type` family/subject/project/curriculum), optionally tied to children, a subject, a project, or a milestone; supports recurrence (none/weekly/monthly/yearly).

### 5.5 Social & platform

- **Community** — a named group of families scoped `online`/`country`/`country_region`, with principles, a join mode (request_to_join/invite_only), an optional target child-age range, and visual identity. Membership via **CommunityMember** (roles admin/co_admin/member; statuses pending/active/removed). Conversation happens in **CommunityTopic** + **CommunityReply** (a threaded forum). **CommunityInvitation** for invite-only joins. **CommunityReport** feeds moderation.
- **Discover** — country/region-scoped browsing of `discoverable` families, exposing only privacy-safe fields (counts, age ranges — never child names/photos/city).
- **CommunityMeetup + CommunityMeetupRsvp** — community events (single or recurring weekly/biweekly/monthly) with per-occurrence RSVPs (going/maybe/not_going).
- **Family Messages** — direct family-to-family threads. **MessageThread** (one per family pair) + **MessageThreadParticipant** (per-side read state, mute, soft-delete) + **MessageItem** (immutable messages). **FamilyBlock** (mutually enforced) and **MessageReport** for safety. The web polls open threads ~every 10s; mobile will combine polling with push (spec 22).
- **Notification** — one row per recipient per event (forum topic/reply, message received/started). Surfaced as a bell/notification center; mobile adds **native push** (spec 22).

### 5.6 Out of scope for mobile

Admin center and closed-beta program (web/desktop concerns) are **not** built for mobile.

## 6. Cross-cutting conventions (carried from the web)

- **API base:** the app talks to the same FastAPI backend, base path `/api/v1/...`. The web proxies via Next rewrites; mobile uses a configurable base URL per build flavor (spec 02/26).
- **Auth:** bearer tokens (spec 03) — `Authorization: Bearer <access>`, refresh-on-401, secure device storage. The web's cookie model is **not** used on mobile.
- **i18n:** no hardcoded user-facing strings; a message catalog mirrors `messages/en.json` namespaces (`Home`, `Auth`, `Validation`, `ApiErrors`, `Onboarding`, `Dashboard`, `Navigation`, etc.). Spec 25 owns this. Currently only `en`.
- **Error handling:** mirror the web's status-code contract — 401 (re-auth), 423 (account locked), 429 (rate limited), 404 (not found), 409 (conflict). Show inline errors with the shared Alert component.
- **Privacy:** the child-data exposure rules from the community spec are enforced identically on mobile. No screen ever shows another family's child names, photos, DOB, or city.

## 7. Tech stack (set the baseline; spec 02 finalizes)

- **Flutter** (stable), **Dart**. Single codebase for iOS + Android, phone + tablet.
- **State management, routing, networking, and project structure** are decided in spec 02 (App Architecture). This spec only mandates the *outcomes*: semantic theming via `ThemeData` + a `ThemeExtension`, a single adaptive scaffold, a typed API client, and a testable layered structure analogous to the web's components/providers/lib split.
- **Icons:** Lucide for Flutter. **Font:** bundled Inter (+ OpenDyslexic for the accessibility option).
- **Target:** `apps/mobile` in this monorepo (confirm in spec 02 whether it lives in the Turborepo or as a sibling, given Flutter's separate toolchain).

## 8. Success criteria for v1

1. A family can do the **entire web workflow** on mobile (parity), with phone and tablet-landscape layouts that feel native, not like a shrunk website.
2. The app is visually unmistakably **the same product** as the web (palette, type, calm tone).
3. **Child privacy** guarantees hold identically to the web.
4. Accessibility preferences (theme, text size, reduce motion, high contrast, dyslexia font) are honored.
5. Auth works via bearer tokens with silent refresh; logout clears all tokens.

## 9. Open questions (resolve as downstream specs are written)

- **`apps/mobile` placement & tooling:** inside Turborepo vs sibling repo — decided in spec 02.
- **Rich-text on mobile:** lessons store sanitized HTML (`content_html`). Spec 11 must choose how to render/edit HTML on mobile (render-only vs a mobile rich editor) — flagged here, decided there.
- **"Follow system" theme:** the web has light/dark only; mobile likely wants a third "system" option. Spec 18 decides whether to extend `ui_preferences.theme` or keep it client-local.
- **Push infrastructure:** FCM (Android) + APNs (iOS) require backend device-token storage and a send path — scoped in spec 22, may need a small backend addition like spec 03.
