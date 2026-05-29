# Oikos Mobile App — Spec Roadmap

**Status:** Draft
**Date:** 2026-05-28
**Platform:** Flutter (Dart) — iOS & Android, phones and tablets. Tablets run in **landscape** (master-detail); phones run in **portrait** (single-column + bottom nav).
**Decisions locked in this round:** full feature parity with the web app; **online-only** in v1 (no offline cache/sync); mobile auth uses **bearer tokens** (a new API capability), not the web's httpOnly cookies.

## How to read this document

This is the **index** of specs needed to build the Oikos mobile app. It is not itself a design spec — each numbered item below becomes its own `docs/superpowers/specs/YYYY-MM-DD-mobile-<topic>-design.md`, brainstormed and written separately, then turned into an implementation plan.

Specs are grouped into **tiers**. Tier 0 (Foundation) must be written and largely agreed before any feature spec, because every feature depends on the shared decisions it locks (design tokens, navigation shell, responsive rules, API client, auth). Within Tiers 2–4, feature specs are mostly independent and can be written/built in parallel once Tier 0 and Tier 1 are done.

Each feature spec mirrors an existing web surface so the two clients stay conceptually aligned. The web routes each spec corresponds to are listed for traceability.

---

## Tier 0 — Foundation (write first, in order)

| # | Spec | Why it's foundational |
|---|------|------------------------|
| **01** | **Product, Design Language & Domain Foundation** ← *the first spec, written alongside this roadmap* | Establishes the product's reason for existing, the mobile UI/UX language mapped from the web design system, the responsive strategy (phone portrait vs tablet landscape), and the canonical glossary of building blocks (Family, Child, Subject, Curriculum, Lesson, etc.). Every other spec references it. |
| **02** | **App Architecture & Tech Stack** | Flutter project layout, state management, the API client / networking layer, error & loading conventions, routing, environment config, the responsive layout primitives (adaptive scaffold), and the testing strategy. |
| **03** | **Mobile Auth — Bearer Tokens (API + client)** | Backend change: issue/accept bearer tokens (access + refresh) via `Authorization` header alongside existing cookie auth; secure on-device token storage, refresh, and logout. Blocks every authenticated screen. |

## Tier 1 — Shell & entry (depends on Tier 0)

| # | Spec | Web parity |
|---|------|------------|
| **04** | **Navigation Shell & Adaptive Layout** — bottom nav (phone) / nav rail + master-detail (tablet landscape), app bar, deep-linking, the "today" home/dashboard | `(dashboard)/dashboard` + global nav |
| **05** | **Auth & Account Flows** — login, register, forgot/reset password, account lock & rate-limit handling | `(auth)/login`, `register`, `forgot-password`, `reset-password` |
| **06** | **Onboarding** — family creation, children setup, coat-of-arms (family shield) builder | `onboarding/family`, `onboarding/children`, `onboarding/coat-of-arms` |

## Tier 2 — Core teaching loop

| # | Spec | Web parity |
|---|------|------------|
| **07** | **Family & Members** — family profile, co-parent invitations, member roles | `(dashboard)/family` |
| **08** | **Children** — list, profile detail, learning profile (styles, interests, accommodations) | `(dashboard)/children`, `children/[child_id]` |
| **09** | **Subjects** — list, detail, create/edit, categories, resources link | `(dashboard)/subjects` + `[subjectId]` + `new`/`edit` |
| **10** | **Curriculums** — list, detail, builder (period, subjects, schedule, child assignment) | `(dashboard)/curriculums` + `[curriculumId]` + `new`/`edit` |
| **11** | **Lessons** — list, detail, rich-text body, status lifecycle, create | `(dashboard)/lessons` + `[id]` + `new` |
| **12** | **Week Planner / Routine** — weekly grid of routine entries; the marquee tablet-landscape surface | `(dashboard)/planner` |
| **13** | **Teaching Log & Progress** — log a teaching session, progress dashboard, printable/shareable report | `(dashboard)/progress` + `progress/report` |

## Tier 3 — Enrichment & organization

| # | Spec | Web parity |
|---|------|------------|
| **14** | **Projects** — projects, milestones, portfolio entries, achievements/certificates | `(dashboard)/projects` + `[projectId]` (+ `certificate`, `edit`, `new`) |
| **15** | **Resources** — library, detail, create, type filtering, subject links | `(dashboard)/resources` + `[resourceId]` + `new` |
| **16** | **Notes** — notes & to-dos, entity attachment, statuses, pinning | `(dashboard)/notes` |
| **17** | **Calendar** — month/week/agenda views, events tied to subjects/projects/children | `(dashboard)/calendar` |
| **18** | **Settings & Preferences** — profile, locale/timezone, theme (light/dark), accessibility (font size, reduce motion, high contrast, dyslexia font), notification prefs | `(dashboard)/settings` |

## Tier 4 — Social & platform

| # | Spec | Web parity |
|---|------|------------|
| **19** | **Discover & Communities** — discover families, community profiles, join/request, forum (topics & replies), members | `(dashboard)/discover` (+ `[familySlug]`), `community` + `[slug]` (`forum`, `members`, `settings`, `new`, `join/[token]`) |
| **20** | **Meetups** — community meetups, recurrence, RSVPs | `community/[slug]/meetups` (+ `[meetupId]`, `new`) |
| **21** | **Family Messages** — family-to-family direct threads, send/receive, mute, block, report, polling for new messages | `(dashboard)/messages` + `[threadId]` |
| **22** | **Notifications & Push** — in-app notification center (bell) **plus** native push notifications (FCM/APNs), device registration, per-event copy | bell/`notifications` API + new push capability |
| **23** | **Assistant** — AI assistant surface | `(dashboard)/assistant` |

## Tier 5 — Cross-cutting (write once, apply throughout)

| # | Spec | Notes |
|---|------|-------|
| **24** | **Shared UI Component Library** — the Flutter analogue of `@oikos/ui` (Button, Input, Card, Alert, child chips/avatars, status badges). Could be folded into spec 01/02 if kept small. | Mirrors `packages/ui` |
| **25** | **Internationalization** — `next-intl`-equivalent message catalog, namespace parity with `messages/en.json`, locale switching | Mirrors web i18n guidelines |
| **26** | **Release & Distribution** — build flavors, signing, app-store/Play-store metadata, env-specific API base URLs, crash reporting | New for mobile |

---

## Dependency summary

```
01 ─┬─> 02 ─┬─> 04 ─┬─> (07..23 feature specs)
    │       │       │
    └─> 03 ─┘       └─> 05, 06 (entry flows)

24, 25 are consumed by every feature spec.
26 is needed only before first store submission.
```

## API contract

The backend exposes a full OpenAPI schema at **`http://localhost:8000/openapi.json`** (Swagger UI at `http://localhost:8000/docs`). This is the canonical source of truth for every endpoint's request body, response shape, and status codes — consult it rather than duplicating contracts in feature specs.

To export a snapshot for the mobile repo:
```bash
# With the API running
curl http://localhost:8000/openapi.json -o api/openapi.json
```

Or without starting a server:
```bash
cd apps/api
python -c "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" > api/openapi.json
```

Commit `api/openapi.json` to the mobile repo and use it to codegen Dart models (e.g. `swagger_dart_code_generator` or `openapi-generator`). Re-export whenever the backend schema changes.

**Exception:** bearer-token endpoints (spec 03) do not exist yet and are defined inline in spec 05 — once implemented they will appear in the schema like all other endpoints.

---

## Notes on parity & deferrals

- **Full parity** is the v1 goal, but the tiers define a sane build order: a usable app exists after Tier 2 (the daily teaching loop). Tiers 3–4 round out parity.
- **Online-only** means no spec includes offline cache, local DB, or sync/conflict resolution. If that changes, it becomes a new cross-cutting spec, not edits scattered across features.
- **Bearer-token auth (03)** is the only backend change required for parity; every other backend endpoint already exists for the web client and is reused as-is.
- The **admin center** and **closed-beta** web surfaces are intentionally **out of scope** for the mobile app (admin is a desktop/web concern).
