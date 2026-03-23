# Oikos — Open Source Family Education Platform
### Project Plan v1.0

---

## 1. Vision & Mission

**Vision:** A world where families are empowered, equipped, and connected to take an active role in the education of their children — whether homeschooling full-time or simply reclaiming their God-given responsibility as primary educators.

**Mission:** Oikos is a free, open source platform that gives families the tools to plan, track, and enrich their children's education, and the community to do it together.

> *Oikos* (οἶκος) — Greek for "household." The family is the fundamental unit of society and the first school.

---

## 2. Problem Statement

Families who want to homeschool or be more involved in their children's education face a fragmented landscape:

- Planning tools are either too simple (paper planners) or expensive SaaS products
- There is no single platform that combines planning, journaling, resources, and community
- Existing platforms are not designed with values-aligned families in mind (faith, diet, screen philosophy, etc.)
- Families who want to connect with other like-minded local families have no structured way to do so
- AI tools exist, but none are designed with the role of a thoughtful homeschool parent in mind

---

## 3. Core Principles

1. **Family sovereignty** — parents are the primary educators; the platform supports, never replaces them
2. **Privacy first** — self-hostable, no ads, no data selling, visibility is always opt-in
3. **Values-aware** — families define who they are (faith, method, lifestyle); the platform respects that
4. **Open and extensible** — fully open source, community-driven, API-first
5. **Accessible** — works offline, mobile-friendly, available in multiple languages

---

## 4. Target Audiences

**Primary**
- Homeschooling families (full-time)
- Faith-based families seeking structured home education

**Secondary**
- Parents who want to supplement traditional school with structured home involvement
- Co-op groups and homeschool networks
- Independent tutors working with home-educated children

---

## 5. Platform Overview

Oikos is organized around four pillars:

| Pillar | Description |
|---|---|
| **Family** | Profiles, children, values, preferences |
| **Education** | Planning, disciplines, projects, calendar, resources |
| **Assistant** | AI-powered teaching and planning support |
| **Community** | Discovery, connection, and coordination between families |

---

## 6. Feature Specification

### 6.1 Family Profiles

Each family creates a household profile with:

- Family name and location (city/region, opt-in for visibility)
- **Faith tradition** (Christian — Reformed, Catholic, Baptist, etc.; Jewish; Secular; Other)
- **Education philosophy** (Classical, Charlotte Mason, Unschooling, Eclectic, Structured, Montessori, etc.)
- **Lifestyle tags** (diet: omnivore, vegetarian, vegan, kosher, halal; screen policy: screen-free, limited, moderate; outdoor orientation; language spoken at home; etc.)
- Bio / family description
- Visibility settings (private, local, public)

### 6.2 Children Profiles

Each child has an individual profile:

- Name, age, grade level (or age-equivalent)
- Learning style (visual, auditory, kinesthetic, reading/writing)
- Special needs or learning accommodations
- Current curriculum
- Subjects / disciplines enrolled
- Progress dashboard

### 6.3 Disciplines & Subjects

Families can manage a full curriculum:

- Add any discipline (Mathematics, Language Arts, Scripture, Latin, History, Science, Music, Fine Arts, Physical Education, Logic, etc.)
- Assign disciplines to children
- Set weekly frequency, goals, and materials per discipline
- Track completion per session
- Pre-built discipline templates by education philosophy

### 6.4 Lesson Planning & Calendar

- Weekly and annual lesson planner per child
- Day-by-day schedule view
- Recurring lessons with flexible scheduling
- Assign resources, books, and materials to lessons
- Mark lessons as complete, skipped, or in-progress
- Calendar integration (iCal export)
- Co-op / group activity planning (shared calendars)

### 6.5 Projects

- Create multi-week projects with milestones
- Assign projects to one or multiple children
- Track progress through phases (research, create, present, reflect)
- Attach resources, notes, and completed work
- Portfolio integration — completed projects become portfolio entries

### 6.6 Resources & Materials

A library of curated and community-contributed resources:

- Books (with age range, subject, philosophy tag)
- Videos and documentaries
- Printables and worksheets
- External links and websites
- Curriculum reviews
- Searchable and filterable by discipline, age, philosophy, faith tradition
- Families can submit and rate resources
- "Save to library" — families build their own resource collections

### 6.7 Assessment & Progress

- Simple test and quiz builder
- Grade and score tracking
- Custom rubrics for project-based evaluation
- Progress reports per child per term
- Portfolio builder (collect work samples, photos, written pieces)
- PDF export for legal compliance or co-op review

### 6.8 Learning Journal

- Daily journal per child — what was covered, how it went, notes
- Attach photos and work samples
- Tag entries by discipline or project
- Private or shareable with extended family

### 6.9 AI Assistant

The heart of Oikos. A context-aware AI assistant that takes on a role defined by the parent.

**Role examples:**
- "A gentle Socratic tutor following the classical method"
- "A Charlotte Mason-style nature study guide"
- "A Reformed Bible teacher for ages 8–12"
- "A patient math tutor who uses real-world examples"

**Capabilities:**
- Generate lesson plans for a given discipline, age, and philosophy
- Suggest projects, field trip ideas, and unit study themes
- Explain concepts in age-appropriate language
- Create discussion questions from any text or passage
- Generate simple quizzes and narration prompts
- Suggest books and resources based on current topics
- Help parents prepare — "I need to teach long division to a 9-year-old, help me"
- Provide encouragement and practical guidance for struggling days

**Important constraints:**
- The assistant never replaces the parent — it advises and equips
- Parents can review and edit all AI-generated content before use
- No direct AI-to-child interaction by default (parent-mediated)

### 6.10 Community & Family Discovery

- Opt-in family directory browsable by location, faith tradition, and education philosophy
- "Connect" request between families (mutual opt-in)
- Message families directly (in-platform messaging)
- Plan shared activities: field trips, co-op classes, park meetups
- Co-op groups — create or join, manage shared schedules and members
- Community forums by topic (Classical education, Charlotte Mason, Faith & Learning, Special Needs, etc.)
- Local events board

---

## 7. Technical Architecture

### 7.1 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js + Tailwind CSS | Modern, SEO-friendly, great DX |
| Mobile | Progressive Web App (PWA) | Offline support, no app store friction |
| Backend | FastAPI (Python) | High performance, great for AI integration |
| Database | PostgreSQL + Redis | Relational data + caching |
| Auth | Supabase Auth or Clerk | Simple, secure, social login support |
| AI | Anthropic Claude API | Best-in-class reasoning for education tasks |
| File Storage | S3-compatible (MinIO for self-host) | Portfolio photos, attachments |
| Search | MeiliSearch | Fast, typo-tolerant resource search |
| Email | Resend or Postmark | Transactional email |
| Deployment | Docker Compose | Easy self-hosting |
| CI/CD | GitHub Actions | Standard open source workflow |

### 7.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Next.js PWA)               │
└───────────────────────────┬─────────────────────────────┘
                            │ REST / WebSocket
┌───────────────────────────▼─────────────────────────────┐
│                    FastAPI Backend                       │
│   ┌─────────────┐  ┌────────────┐  ┌────────────────┐   │
│   │  Family API │  │ Planning   │  │  Community API │   │
│   │  Children   │  │ Calendar   │  │  Discovery     │   │
│   │  Profiles   │  │ Journals   │  │  Messaging     │   │
│   └─────────────┘  └────────────┘  └────────────────┘   │
│   ┌──────────────────────────────────────────────────┐   │
│   │               AI Assistant Service               │   │
│   │         (Anthropic API + Role System)            │   │
│   └──────────────────────────────────────────────────┘   │
└─────────────┬──────────────┬───────────────┬────────────┘
              │              │               │
         PostgreSQL        Redis          S3/MinIO
```

### 7.3 Self-Hosting

Oikos must be trivially self-hostable for privacy-conscious families:

```bash
git clone https://github.com/oikos-edu/oikos
cd oikos
cp .env.example .env  # configure your own API keys
docker compose up -d
```

Full documentation for VPS deployment (DigitalOcean, Hetzner, Fly.io) will be provided.

---

## 8. Data Model (Core Entities)

```
Family
  ├── id, name, location, visibility
  ├── faith_tradition, education_philosophy
  ├── lifestyle_tags[]
  └── children[]

Child
  ├── id, family_id, name, birthdate
  ├── grade_level, learning_style
  ├── accommodations
  └── disciplines[], projects[]

Discipline
  ├── id, name, category, description
  ├── weekly_frequency, materials[]
  └── lessons[]

Lesson
  ├── id, child_id, discipline_id
  ├── scheduled_date, duration_minutes
  ├── status (planned | complete | skipped)
  └── journal_entry

Project
  ├── id, child_ids[], title, description
  ├── start_date, end_date
  ├── milestones[], resources[]
  └── portfolio_entries[]

Resource
  ├── id, title, type, url, description
  ├── discipline_tags[], age_range
  ├── philosophy_tags[], faith_tags[]
  └── submitted_by, rating

AIAssistant
  ├── id, family_id, role_name
  ├── role_prompt, philosophy_context
  └── conversation_history[]

Community
  ├── FamilyConnection (family_a, family_b, status)
  ├── CoopGroup (id, name, member_families[], schedule)
  └── Event (id, title, location, organizer_id, attendees[])
```

---

## 9. Roadmap

### Phase 0 — Foundation (Weeks 1–4)
- Project setup: monorepo, Docker Compose, CI/CD
- Authentication and family registration
- Basic family and children profiles
- Core database schema and migrations
- README, contributing guide, code of conduct

### Phase 1 — MVP: Plan & Track (Weeks 5–12)
- Discipline management
- Weekly lesson planner
- Calendar view
- Daily learning journal
- Basic progress dashboard
- PDF progress report export

**Goal:** A family can plan a school week and log what happened. Useful on day one.

### Phase 2 — Resources & Projects (Weeks 13–20)
- Resource library (manual entry + community submissions)
- Resource search and filtering
- Project management with milestones
- Portfolio builder
- Assessment / quiz builder

**Goal:** A family can manage a full curriculum with resources and projects.

### Phase 3 — AI Assistant (Weeks 21–28)
- AI assistant with configurable roles
- Lesson plan generation
- Resource suggestions
- Discussion question generator
- Concept explainer (age-appropriate mode)
- Quiz generation from any text

**Goal:** Parents have a knowledgeable, values-aligned teaching partner available 24/7.

### Phase 4 — Community (Weeks 29–40)
- Family directory with opt-in visibility
- Family discovery by location and philosophy
- Connect / messaging system
- Co-op groups
- Shared event planning
- Community forums

**Goal:** Families can find and build local community around shared values.

### Phase 5 — Polish & Growth (Ongoing)
- Native mobile apps (React Native)
- Internationalization (Portuguese, Spanish, German as first targets)
- Offline mode improvements
- Legal compliance guides per region
- Plugin/extension system
- Hosted cloud offering (optional, supports development)

---

## 10. Governance & Community

### Repository Structure

```
oikos/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # FastAPI backend
├── packages/
│   ├── ui/           # Shared component library
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared configs (ESLint, Tailwind)
├── docs/             # Documentation site
├── scripts/          # Dev and deployment scripts
└── docker-compose.yml
```

### Contributing

- Issues labeled `good first issue` for new contributors
- Feature requests go through RFC (Request for Comments) process
- All PRs require at least one review
- Code of conduct: respectful, family-friendly, inclusive of diverse faith traditions

### License

**AGPLv3** — ensures that any hosted version of Oikos must also be open source. Protects the community from proprietary forks.

---

## 11. Naming & Branding

**Project name:** Oikos
**Tagline:** *"Equipping families to educate with intention."*
**Domain suggestion:** oikos.education or oikos.family
**Logo concept:** A simple house with a book — the household as a place of learning

---

## 12. Why This Will Succeed

1. **Underserved community** — homeschooling families are growing globally and are deeply underserved by existing software
2. **Strong word-of-mouth** — homeschool and faith communities share tools enthusiastically when they trust them
3. **Privacy advantage** — self-hostable, open source, no tracking = instant trust with this audience
4. **Values-aware design** — no existing platform treats a family's faith, philosophy, and lifestyle as first-class citizens
5. **AI at the right time** — AI assistance for education is new and compelling; Oikos can lead this space for families
6. **Clear monetization path** — hosted cloud tier funds development without compromising the open source core

---

## 13. Next Steps

1. **Reserve the name** — GitHub org, domain, npm scope
2. **Write the README** — vision, getting started, contributing
3. **Set up the monorepo** — turborepo or nx, Docker Compose
4. **Design the data model** — finalize core entities and relationships
5. **Build auth + family registration** — the foundation everything sits on
6. **Launch a landing page** — collect early interest from homeschool communities

---

*"Train up a child in the way he should go; even when he is old he will not depart from it."*
*— Proverbs 22:6*