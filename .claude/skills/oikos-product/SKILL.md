---
name: oikos-product
description: Product advisor for Oikos — suggests features, UX improvements, and implementation priorities for the family education platform. Use when the user asks "what should I build next", "how should this feature work", "what would make this better", "product ideas", "feature suggestions", or discusses UX and feature design. Also trigger on "roadmap", "prioritize", "user story", "what features are missing", "how should X work".
---

# Oikos Product Advisor

Oikos is an open-source family education platform for homeschooling families. It helps parents plan, track, and enrich their children's education with AI assistance that respects each family's faith, values, and educational philosophy.

## Core user persona

**Primary user**: A homeschooling parent (usually a mother) managing education for 1-5 children across multiple age levels. She values intentionality, faith integration, and flexibility. She may be juggling teaching, household duties, and part-time work.

**Secondary users**: Co-parents, tutors, or co-op teachers who may have limited access.

## Current platform state

### Implemented
- Auth (register, login, password reset with rate limiting)
- Family onboarding (4-step wizard: identity + coat of arms, faith & values, education philosophy, family story)
- Children onboarding (detailed profiles: learning styles, interests, personality, special needs)
- Dashboard with sidebar navigation and welcome section
- Family identity display (name, coat of arms)

### Placeholder pages needing implementation
- **Family** — view/edit family profile
- **Children** — view/edit child profiles
- **Disciplines** — subjects and curriculum setup per child
- **Planner** — weekly/daily lesson planning
- **Calendar** — schedule overview
- **Projects** — multi-week learning projects or unit studies
- **Resources** — books, videos, materials library
- **Journal** — daily logging of what was taught/learned
- **Progress** — assessment tracking and reporting
- **Assistant** — AI-powered lesson ideas and personalized support
- **Community** — connecting with other homeschool families
- **Settings** — account, family, and platform settings

## Prioritization framework

When suggesting what to build, follow this order:

### 1. Foundation (build first)
Family + Children profile pages — let users view and edit what they entered during onboarding. This is table-stakes before anything else.

### 2. Core loop (daily workflow)
**Disciplines → Planner → Journal** — this is the daily teaching cycle:
1. Set up subjects/disciplines per child
2. Plan lessons for the week
3. Log what was actually covered each day

### 3. Visibility (big picture)
**Calendar → Progress** — parents need to see the schedule and track achievement over time. Progress reporting is critical for compliance in many states.

### 4. Enrichment (value-adds)
**Resources → Projects → Assistant** — curated materials, multi-week projects, and AI-powered suggestions. The AI assistant should leverage all family/child data for personalization.

### 5. Social (network effects)
**Community → Settings** — connecting families, sharing resources, co-op coordination.

## Rich data model to leverage

The onboarding process collects detailed data that features should use:
- **Child learning styles** (visual, auditory, kinesthetic, etc.) → Planner can suggest activity types
- **Child interests** → Assistant can theme lessons around interests
- **Motivators/demotivators** → Planner can structure reward patterns
- **Family faith tradition & worldview** → Assistant respects and integrates these values
- **Education methods** (classical, Charlotte Mason, Montessori, etc.) → Disciplines and Planner adapt to methodology
- **Family culture description** → AI uses this for tone and approach
- **Learning differences & accommodations** → Planner flags accessibility needs

## UX principles for this audience

1. **Warm, encouraging tone** — not corporate. Parents often doubt themselves; the app should affirm.
2. **Never judgmental** — every family's approach is valid. No "you're behind" messaging.
3. **Mobile-friendly** — parents plan on their phones during nap time or in the car.
4. **Quick actions** — logging a lesson should take under 30 seconds.
5. **Visual progress** — parents need to see they are doing enough. Charts, streaks, completion indicators.
6. **Flexible structure** — some families are highly structured, others flow freely. Support both.
7. **AI that "knows" the family** — every data point collected feeds the assistant's ability to personalize.

## Output format for feature suggestions

When suggesting features or improvements:
1. **Problem**: What user problem does this solve?
2. **Feature**: Brief description of the solution
3. **Backend needs**: New models, endpoints, services required
4. **Frontend needs**: Pages, components, translations
5. **Effort**: S (1-2 files), M (3-6 files), L (7+ files across layers)
6. **Dependencies**: What must be built first?
7. **Data leverage**: What existing family/child data makes this feature smarter?
