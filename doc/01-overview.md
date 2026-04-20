# 1. Overview

## What is Oikos?

**Oikos** (Greek: "household") is an open-source platform that helps families organise, track, and enrich their children's education journey. It is designed for families practising home education — homeschooling, classical education, Montessori, hybrid/co-op models, and anything in between.

The product is built around a simple idea: parents are the primary educators, and they need a single private place to plan what their children learn, schedule when it happens, capture what was produced, and celebrate the milestones.

## Who is it for?

- **Homeschooling families** who need a lightweight plan-and-track tool without the weight of an LMS.
- **Classical / Charlotte Mason / Montessori educators** who want to model subjects, curriculums, and projects the way *they* teach, not the way a school district does.
- **Co-ops and family networks** who eventually want to share resources and routines.

## Product pillars

1. **Privacy-first.** Families own their data. Auth is cookie-based JWT; no third-party trackers baked into the core flows.
2. **Customizable.** Subjects, categories, curriculums, weekly routines, and projects are all configurable per family.
3. **Simple.** One family account with one adult today; multi-parent and child accounts are on the roadmap.
4. **Internationalizable.** All UI text is routed through `next-intl`. English is the only shipped locale today, but adding a new locale is a drop-in JSON file.

## Core concepts

| Concept | Meaning |
|---|---|
| **Account (User)** | The email+password identity that logs in. One account owns one family today. |
| **Family** | The household profile — name, shield/coat of arms, faith, education purpose, methods, diet, screen policy, languages. |
| **Child** | A learner that belongs to a family. Has a learning profile: personality, interests, learning styles, accommodations. |
| **Subject** | A thing a child learns (Math, Latin, Piano, Forest School). Typed by category and optionally age/grade-guided. |
| **Curriculum** | A time-bounded plan (monthly, quarterly, semester, annual, custom) that bundles subjects with weekly frequency and assigns children. |
| **Week Template / Routine Entry** | The weekly schedule: time slots per day that link subjects to children. |
| **Project** | A goal-oriented body of work with milestones, portfolio entries, and achievement certificates. |
| **Resource** | Reference material (book, video, course, podcast, printable, website) linked to subjects or projects. |
| **Shield / Coat of arms** | Customisable family identity emblem rendered across the app. |

## Feature surface at a glance

Authentication · Family onboarding · Children profiles · Subjects library · Curriculum planning · Week planner with drag-and-drop · Projects with milestones and portfolio · Resource library · Family shield customisation · Multi-locale UI.

Placeholder pages exist for **calendar**, **journal**, **progress**, **assistant** (AI), **community**, and **settings** — these are stubs today and are the next areas of work.

## Non-goals (for now)

- Grading/report-card generation as a school would produce.
- Live video classes or built-in LMS courses.
- Public social feed — community features are opt-in and scoped to families.

## Where to read next

- [02-architecture.md](02-architecture.md) for how the pieces fit together.
- [04-features.md](04-features.md) for the full feature catalogue.
