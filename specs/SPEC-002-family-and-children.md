# Oikos — Spec 02: Family & Children Onboarding
### Project Plan v1.0 · Follows Spec 01

---

## 1. Overview

This spec covers the **family creation and child registration flows** — the first thing a user encounters after creating an account (or after logging in to an account that does not yet have a family attached). These two flows are the heart of Oikos: everything the AI assistant does, every lesson plan generated, and every community connection made depends on what is captured here.

The flow is split into two distinct steps:

| Step | Route | Trigger |
|---|---|---|
| **Step 1: Create Family** | `/onboarding/family` | New account, or login with no family |
| **Step 2: Add Children** | `/onboarding/children` | Immediately after family creation |
| **Later: Add Child** | `/family/children/add` | Adding a new child to an existing family |

---

## 2. User Experience Flow

```
Register / Login
      │
      ▼
Does this account have a family?
      │
   No ├──────────────────────────────────────────────────────────────┐
      │                                                              │
      ▼                                                              │
[Step 1] Family Creation (/onboarding/family)                       │
  • Family name, shield, faith, church                              │
  • Lifestyle, education method, culture                            │
      │                                                              │
      ▼                                                              │
[Step 2] Add First Child (/onboarding/children)                     │
  • Add one or more children                                        │
  • Can skip — "I'll add children later"                            │
      │                                                              │
      ▼                                                              │
Dashboard (/dashboard) ◄────────────────────────────────── Yes ─────┘

Later: Add Child (/family/children/add)
  • Same child form, standalone page
  • Available from family settings at any time
```

### Design Principles for These Flows

- **Warm, not clinical.** This is not a form — it is an invitation. Copy should feel like a thoughtful guide is walking alongside the family.
- **Progressive disclosure.** Not everything is required. Required fields are minimal; the rest unlocks richness.
- **Contextual tooltips.** Every non-obvious field has a "Why do we ask this?" tooltip explaining how it improves the AI assistant.
- **No dead ends.** Every field can be changed later from family settings.
- **Multi-step wizard.** Break the family form into logical sections so it never feels overwhelming.

---

## 3. Family Creation — Detailed Specification

### 3.1 Wizard Structure

The family creation form is presented as a **4-step wizard** with a progress bar. Each step fits comfortably on one screen.

```
Step 1 of 4 — Your Family        [━━━━░░░░░░░░]
Step 2 of 4 — Faith & Values     [━━━━━━░░░░░░]
Step 3 of 4 — How You Learn      [━━━━━━━━░░░░]
Step 4 of 4 — Your Family Story  [━━━━━━━━━━━━]
```

---

### 3.2 Step 1: Your Family

**Heading:** *"Let's start with your household."*

#### Family Name
- **Field:** `family_name` · Type: `text` · Required: yes
- **Label:** Family Name
- **Placeholder:** "The Harrison Family"
- **Help text:** "This is how your family will appear to others in the community. It can be a surname, a given name, or anything that feels like home."
- **Validation:** 2–80 characters, unique within platform (case-insensitive), alphanumeric + spaces + apostrophes + hyphens
- **Uniqueness:** Checked on blur via API call (`GET /api/families/check-name?name=...`). Shows green checkmark or "That name is already taken."

#### Family Shield (Crest)
- **Field:** `shield_config` · Type: `jsonb` · Required: no (auto-generated if skipped)
- **Label:** Family Shield
- **UX:** An interactive SVG shield builder displayed inline. The family sees a live preview.
- **Auto-generation:** On `family_name` entry, the system auto-generates a shield using the family's initials and a random colour palette from the approved set. The family can accept it or customise it.
- **Customisable attributes:**
  - **Initials displayed** (auto-filled from family name, editable, max 3 characters)
  - **Shield shape** (classic heater / rounded / angular / split — 4 options)
  - **Background colour** (10 curated colours, no free picker to keep quality consistent)
  - **Accent colour** (paired accent options per background)
  - **Dividing pattern** (none / horizontal split / diagonal / quarterly — optional decoration)
  - **Font style** for initials (Serif / Sans / Script — 3 options)
- **Storage:** The full config is stored as JSON. The SVG is generated server-side or client-side from the config — never stored as an image file.
- **Tooltip:** "Your family shield is your visual identity in Oikos. It appears on your profile, your children's journals, and in the community directory."

#### Location
- **Field:** `location_city`, `location_region`, `location_country` · Required: no
- **Label:** Where are you based?
- **UX:** A single text input with autocomplete (city search via OpenStreetMap Nominatim or similar). Selecting a city populates the three sub-fields.
- **Display:** Only city and country are displayed publicly. Exact coordinates are never stored.
- **Visibility:** Controlled separately (see §3.5).
- **Help text:** "Used to help you connect with nearby families. Never shared without your permission."

---

### 3.3 Step 2: Faith & Values

**Heading:** *"Tell us about your faith and values."*
**Subheading:** *"This helps your AI assistant understand who you are and respond in a way that aligns with your beliefs."*

#### Faith Tradition
- **Field:** `faith_tradition` · Type: `enum` + optional `faith_denomination` text · Required: no
- **Label:** Faith Tradition
- **UX:** Radio cards (large, icon-based), with one final "Other / Prefer not to say" option.

| Value | Label | Icon |
|---|---|---|
| `christian` | Christian | ✝ |
| `jewish` | Jewish | ✡ |
| `muslim` | Muslim | ☪ |
| `secular` | Secular / Non-religious | ◯ |
| `other` | Other | … |
| `none` | Prefer not to say | — |

- If `christian` is selected, a **denomination** selector appears:
  - Reformed / Presbyterian
  - Catholic
  - Baptist
  - Anglican / Episcopalian
  - Lutheran
  - Methodist
  - Pentecostal / Charismatic
  - Eastern Orthodox
  - Non-denominational
  - Other (free text, max 60 chars)

#### Church / Faith Community
- **Field:** `faith_community_name` · Type: `text` · Required: no
- **Visibility:** Only shown if `faith_tradition` is not `secular` or `none`
- **Label:** Church or Faith Community *(optional)*
- **Placeholder:** "Grace Community Church, Dublin"
- **Help text:** "Optional. Helps the AI personalise content (e.g. lectionary-aligned plans, catechism integration)."
- **Max length:** 120 characters

#### Worldview & Teaching Convictions *(optional)*
- **Field:** `worldview_notes` · Type: `text` (short) · Required: no
- **Label:** Any teaching convictions we should know about? *(optional)*
- **Placeholder:** "We teach from a young-earth creationist perspective. We use the Westminster Catechism."
- **Help text:** "The AI assistant will use this to avoid conflict with your convictions and lean into your framework."
- **Max length:** 300 characters

---

### 3.4 Step 3: How You Learn

**Heading:** *"How does your family approach education?"*

#### Primary Education Method
- **Field:** `education_method` · Type: `enum[]` (multi-select, ordered by primary) · Required: no
- **Label:** Education Philosophy
- **UX:** Multi-select cards. Families often blend methods; they can select up to 3 and drag to order by dominance.

| Value | Label | Brief description shown on card |
|---|---|---|
| `classical` | Classical | Trivium: grammar, logic, rhetoric |
| `charlotte_mason` | Charlotte Mason | Living books, nature study, narration |
| `montessori` | Montessori | Child-led, hands-on learning |
| `unschooling` | Unschooling | Child-directed, interest-led |
| `structured` | Traditional / Structured | Textbook, scheduled, grade-level |
| `eclectic` | Eclectic | Mix of methods tailored to the child |
| `waldorf` | Waldorf | Arts, rhythm, developmental stages |
| `unit_study` | Unit Studies | Thematic cross-subject study |
| `online` | Online / Hybrid | Primarily online curriculum |
| `other` | Other | — |

- **Tooltip:** "This shapes the default tone and approach of lesson plans, resource suggestions, and discussion questions from the AI assistant."

#### Curriculum Currently Used *(optional)*
- **Field:** `current_curriculum` · Type: `text[]` · Required: no
- **Label:** Curriculum or Programmes Used *(optional)*
- **UX:** Tag input — type a curriculum name, press Enter to add. Pre-populated suggestions: Ambleside Online, Classical Conversations, Memoria Press, Sonlight, Notgrass, Mystery of History, Teaching Textbooks, Khan Academy, etc.
- **Max:** 8 tags, 60 chars each

#### Lifestyle Tags

**Diet**
- **Field:** `diet` · Type: `enum` · Required: no
- **Label:** Dietary Approach
- **Options:** Omnivore (default) · Vegetarian · Vegan · Pescatarian · Kosher · Halal · Gluten-free · Other

**Screen Policy**
- **Field:** `screen_policy` · Type: `enum` · Required: no
- **Label:** Screen Philosophy
- **UX:** A 4-point slider with labels at each point.

| Value | Label | Description |
|---|---|---|
| `screen_free` | Screen-Free | No screens in education or recreation |
| `minimal` | Minimal | No to almost none — occasional special use |
| `moderate` | Moderate | Intentional, limited use |
| `open` | Open | Screens used freely as tools |

- **Tooltip:** "Used to filter resources and tools. Screen-free families won't be shown video-heavy resource suggestions."

**Outdoor Orientation**
- **Field:** `outdoor_orientation` · Type: `enum` · Required: no
- **Label:** Outdoor & Nature Orientation
- **Options:** Nature-centred / Outdoor-active / Mixed / Mainly indoors

**Language(s) at Home**
- **Field:** `home_languages` · Type: `text[]` · Required: no
- **Label:** Languages Spoken at Home
- **UX:** Tag input with ISO language autocomplete (English pre-filled, user can remove or add)
- **Help text:** "Helps suggest multilingual resources and set the AI's default response language."

**Other Lifestyle Practices** *(optional)*
- **Field:** `lifestyle_tags` · Type: `text[]` · Required: no
- **Label:** Other Practices or Values *(optional)*
- **UX:** Multi-select checkbox list (compact, 2-column)
- **Options (representative, not exhaustive):**
  - Liturgical calendar (Advent, Lent, etc.)
  - Sabbath observance
  - Homesteading / farming
  - Handicrafts & manual arts
  - Music & arts emphasis
  - Sports & athletics emphasis
  - Multilingual / immersion
  - Delayed academics (ages 4–7)
  - Co-op participant
  - Deschooling / decompression phase

---

### 3.5 Step 4: Your Family Story

**Heading:** *"Finally — tell us about your family in your own words."*

#### Family Culture & Description
- **Field:** `family_culture` · Type: `text` (long) · Required: no
- **Label:** Describe your family culture *(optional but powerful)*
- **Placeholder:**
  > "We are a family of six living on a small farm in rural Ireland. We prioritise slow mornings with Scripture reading, followed by structured academics until noon and free exploration in the afternoons. We love history, are passionate about music, and are working through learning Irish together. Our oldest is gifted but resistant to writing; our middle three are enthusiastic learners; our youngest is just beginning to read."
- **Help text:** "This is the most important thing you can give the AI assistant. Write as much or as little as you like. The more you share, the more your assistant will feel like it knows your family."
- **Max length:** 2,000 characters
- **Character counter shown**

#### Community Visibility
- **Field:** `visibility` · Type: `enum` · Required: yes (default: `private`)
- **Label:** Who can discover your family?
- **UX:** Three clear option cards

| Value | Label | Description |
|---|---|---|
| `private` | Private | Only you see your family. Invisible in community. |
| `local` | Local | Visible to families in your region who are also discoverable |
| `public` | Public | Visible in the full family directory |

- **Note shown:** "You can change this at any time in Settings. Your location is never shown more precisely than city level."

---

### 3.6 Final Review & Submit

Before submission, the user sees a **summary card** showing all selected options (not just filled fields). They can click any section to jump back and edit. A single **"Create Our Family"** button submits the form.

On success:
- Family record is created
- User is redirected to `/onboarding/children` with a success toast: *"Welcome to Oikos, [Family Name]! Now let's meet your children."*

---

## 4. Child Registration — Detailed Specification

### 4.1 Page Structure

The child registration page (`/onboarding/children`) shows:
- Header: *"Now let's meet your children."*
- A card for each child added so far (initially empty)
- An **"Add a Child"** button that opens a drawer/modal with the child form
- A **"Continue to Dashboard →"** button (visible even if no children added yet, with confirmation: *"You can add children later from your family settings."*)

The same child form is used at `/family/children/add` (standalone page) for adding children after onboarding.

---

### 4.2 Child Form Fields

#### Basic Identity

**First Name**
- **Field:** `first_name` · Type: `text` · Required: yes
- **Label:** First Name
- **Note:** Last name is intentionally not collected (privacy). The child is always referred to by first name.
- **Max length:** 60 characters

**Date of Birth or Age**
- **Field:** `birthdate` (date) or `birth_year` + `birth_month` (approximate) · Required: one of
- **Label:** Date of Birth *(or approximate age)*
- **UX:** Two radio options:
  - "I'll enter their date of birth" → date picker
  - "I'll just enter their approximate age" → number input (years) + optional months
- **Calculated:** `age` and `grade_level_estimate` are calculated dynamically, not stored.
- **Privacy note:** "Date of birth is stored securely and never shared."

**Nickname** *(optional)*
- **Field:** `nickname` · Type: `text` · Required: no
- **Label:** Nickname *(what you call them day-to-day)*
- **Help text:** "The AI assistant will use this name when referring to this child."
- **Max length:** 40 characters

**Gender**
- **Field:** `gender` · Type: `enum` · Required: no · Default: none selected
- **Options:** Male · Female · Prefer not to say

**Avatar** 
- **UX:** a generated avatar based on the gender provided using the child's initial and a colour from the family palette

---

#### Education

**Grade Level or Stage**
- **Field:** `grade_level` · Type: `enum` · Required: no
- **Label:** Current Grade or Stage
- **Note:** Auto-suggested from age, but overrideable. Many homeschoolers don't use grades — the "Stage" option reflects this.

| Value | Label |
|---|---|
| `pre_k` | Pre-K / Early Years (ages 3–5) |
| `k` | Kindergarten (age 5–6) |
| `grade_1` … `grade_12` | Grades 1–12 |
| `stage_early` | Early Stage (not grade-based, ages 5–8) |
| `stage_middle` | Middle Stage (ages 9–12) |
| `stage_upper` | Upper Stage (ages 13–18) |
| `graduated` | Graduated / Post-secondary |

**Current Curriculum** *(optional)*
- **Field:** `child_curriculum` · Type: `text[]` · Required: no
- **Label:** Curriculum this child is using *(if different from family)*
- **UX:** Same tag input as family-level curriculum
- **Help text:** "Leave blank if same as the family default."

**Learning Style** *(optional)*
- **Field:** `learning_style` · Type: `enum[]` (multi-select, up to 2) · Required: no
- **Label:** How does this child learn best?
- **UX:** Cards with short descriptions

| Value | Label | Description |
|---|---|---|
| `visual` | Visual | Learns through images, maps, diagrams |
| `auditory` | Auditory | Learns through listening and discussion |
| `kinesthetic` | Hands-On | Learns by doing, building, moving |
| `reading_writing` | Reading & Writing | Learns through text and note-taking |
| `social` | Social | Thrives in group discussion and co-op |

**Tooltip:** "The AI assistant uses this to vary how it explains concepts and what activities it suggests."

**Subjects / Disciplines** *(optional at this stage)*
- Not collected during child creation. Disciplines are configured in Phase 1 (Spec 03). A prompt is shown: *"You'll set up subjects and lesson plans for [Name] from your planning dashboard."*

---

#### Personality & Character

> This section is the most distinctive part of Oikos and the most valuable for the AI assistant. The framing should feel warm and inviting — a parent describing their child to a trusted tutor.

**Section intro copy:** *"This is where you introduce [Name] to your AI assistant. The more you share, the better it can tailor lessons, encouragement, and questions to who they actually are."*

**Personality Description** *(open field)*
- **Field:** `personality_description` · Type: `text` · Required: no
- **Label:** How would you describe [Name]'s personality?
- **Placeholder:**
  > "Elias is a deeply curious, introverted nine-year-old who loves building things and asking big questions. He gets frustrated quickly when he feels stuck and needs quiet to concentrate. He has a great sense of humour and responds well to stories and real-world examples. He lights up during history lessons and drags his feet through handwriting."
- **Max length:** 1,000 characters
- **Character counter shown**

**Personality Tags** *(optional, multi-select)*
- **Field:** `personality_tags` · Type: `text[]` · Required: no
- **Label:** Quick tags *(optional)*
- **UX:** Pill checkboxes in two columns
- **Options:**

*Temperament:* Introverted · Extroverted · Sensitive · Energetic · Calm · Strong-willed · Gentle · Analytical · Creative · Spontaneous · Methodical · Empathetic

*Learning posture:* Eager learner · Reluctant learner · Fast finisher · Slow and thorough · Needs lots of encouragement · Works well independently · Needs frequent breaks · Struggles with transitions

*Strengths (academics):* Strong reader · Strong in maths · Loves writing · Musical · Artistic · Scientific · Historical · Mathematical · Verbal · Logical

**Interests** *(optional)*
- **Field:** `interests` · Type: `text[]` · Required: no
- **Label:** What does [Name] love? *(interests, hobbies, passions)*
- **UX:** Tag input, free text
- **Placeholder tags:** dinosaurs · lego · horses · cooking · chess · astronomy · drawing · football · piano · history · insects
- **Help text:** "The AI assistant will weave these into lessons and examples whenever possible."
- **Max:** 15 tags

**Motivators & Demotivators** *(optional)*
- **Field:** `motivators` + `demotivators` · Type: `text` (short) · Required: no
- **Label (motivators):** What motivates [Name]?
- **Placeholder:** "Sticker charts, working alongside mum, clear goals, short bursts with breaks"
- **Label (demotivators):** What tends to frustrate or discourage [Name]?
- **Placeholder:** "Open-ended instructions, long reading sessions without discussion, being timed"
- **Max length:** 200 characters each

---

#### Special Needs & Accommodations

**Section intro copy:** *"This information is private and used only to help the AI assistant adapt its approach. It is never shared."*

**Learning Differences / Diagnoses** *(optional)*
- **Field:** `learning_differences` · Type: `enum[]` · Required: no
- **Label:** Does [Name] have any learning differences or diagnoses? *(optional)*
- **Options:** Dyslexia · Dysgraphia · Dyscalculia · ADHD (inattentive) · ADHD (combined) · Autism Spectrum · Gifted / 2e · Sensory Processing · Visual impairment · Hearing impairment · Speech / Language · Other

**Accommodations & Adaptations** *(optional)*
- **Field:** `accommodations_notes` · Type: `text` · Required: no
- **Label:** Any accommodations or approaches that help?
- **Placeholder:** "Extra time on written work. Prefers dictating answers. Needs movement breaks every 20 minutes. Uses audiobooks alongside text."
- **Max length:** 500 characters

**Therapy or Support Services** *(optional)*
- **Field:** `support_services` · Type: `text[]` · Required: no
- **Label:** Any therapy or support services? *(optional)*
- **UX:** Tag input
- **Examples:** Occupational therapy · Speech therapy · Reading tutor · Vision therapy · Counselling

---

#### Saving a Child Record

- **Button:** "Add [Name] to Our Family" (name is dynamically inserted if entered)
- On save, the child card appears on the `/onboarding/children` page
- The family can add another child immediately
- All fields can be edited later from the child's profile page

---

## 5. Database Schema

### 5.1 `families` Table

```sql
CREATE TABLE families (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identity
  family_name           VARCHAR(80)  NOT NULL,
  family_name_slug      VARCHAR(100) NOT NULL UNIQUE,  -- URL-safe, lowercase, auto-generated
  shield_config         JSONB        NOT NULL DEFAULT '{}',

  -- Location (stored at city level only)
  location_city         VARCHAR(100),
  location_region       VARCHAR(100),
  location_country      VARCHAR(100),
  location_country_code CHAR(2),

  -- Faith
  faith_tradition       VARCHAR(30),         -- enum: christian | jewish | muslim | secular | other | none
  faith_denomination    VARCHAR(80),         -- free text if christian selected
  faith_community_name  VARCHAR(120),
  worldview_notes       VARCHAR(300),

  -- Education
  education_methods     TEXT[]       NOT NULL DEFAULT '{}',  -- ordered array of method enums
  current_curriculum    TEXT[]       NOT NULL DEFAULT '{}',

  -- Lifestyle
  diet                  VARCHAR(30),
  screen_policy         VARCHAR(20),         -- screen_free | minimal | moderate | open
  outdoor_orientation   VARCHAR(30),
  home_languages        TEXT[]       NOT NULL DEFAULT '{"en"}',
  lifestyle_tags        TEXT[]       NOT NULL DEFAULT '{}',

  -- AI Context
  family_culture        TEXT,                -- up to 2000 chars

  -- Visibility
  visibility            VARCHAR(10)  NOT NULL DEFAULT 'private',  -- private | local | public

  -- Metadata
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_families_account_id      ON families(account_id);
CREATE INDEX idx_families_visibility      ON families(visibility);
CREATE INDEX idx_families_country_code    ON families(location_country_code);
CREATE INDEX idx_families_faith_tradition ON families(faith_tradition);
CREATE INDEX idx_families_name_slug       ON families(family_name_slug);
```

**`shield_config` JSONB shape:**
```json
{
  "initials": "HF",
  "shape": "heater",
  "background_color": "#2D4A7A",
  "accent_color": "#C5A84B",
  "dividing_pattern": "none",
  "font_style": "serif"
}
```

---

### 5.2 `children` Table

```sql
CREATE TABLE children (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id               UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  -- Identity
  first_name              VARCHAR(60)  NOT NULL,
  nickname                VARCHAR(40),
  gender                 VARCHAR(20),
  avatar_initials         CHAR(2),    

  -- Age / Grade
  birthdate               DATE,                  -- precise, if provided
  birth_year              SMALLINT,              -- approximate, if precise not given
  birth_month             SMALLINT,              -- 1–12, optional
  grade_level             VARCHAR(20),           -- enum (see §4.2)

  -- Education
  child_curriculum        TEXT[]       NOT NULL DEFAULT '{}',
  learning_styles         TEXT[]       NOT NULL DEFAULT '{}',  -- up to 2 values

  -- Personality (AI Context)
  personality_description TEXT,                  -- up to 1000 chars
  personality_tags        TEXT[]       NOT NULL DEFAULT '{}',
  interests               TEXT[]       NOT NULL DEFAULT '{}',
  motivators              VARCHAR(200),
  demotivators            VARCHAR(200),

  -- Special Needs
  learning_differences    TEXT[]       NOT NULL DEFAULT '{}',
  accommodations_notes    TEXT,                  -- up to 500 chars
  support_services        TEXT[]       NOT NULL DEFAULT '{}',

  -- Metadata
  is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_children_family_id ON children(family_id);
CREATE INDEX idx_children_active    ON children(family_id, is_active);
```

---

### 5.3 `accounts` Table (reference — already exists post-auth)

```sql
-- Assumed to exist after auth (Supabase / Clerk)
CREATE TABLE accounts (
  id              UUID PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  has_family      BOOLEAN NOT NULL DEFAULT FALSE,  -- set to TRUE on family creation
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The `has_family` flag is set to `TRUE` atomically with family creation and is used as the redirect guard on login.

---

### 5.4 Database Triggers

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER children_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-generate family_name_slug
CREATE OR REPLACE FUNCTION generate_family_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  base_slug := lower(regexp_replace(NEW.family_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(trim(base_slug), '\s+', '-', 'g');
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM families WHERE family_name_slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.family_name_slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER families_slug
  BEFORE INSERT OR UPDATE OF family_name ON families
  FOR EACH ROW EXECUTE FUNCTION generate_family_slug();
```

---

## 6. API Endpoints

### 6.1 Family Endpoints

```
POST   /api/families                    Create family (also sets account.has_family = true)
GET    /api/families/me                 Get current user's family
PUT    /api/families/me                 Update family
GET    /api/families/check-name?name=   Check name availability
GET    /api/families/{slug}             Public family profile (if visibility allows)
```

**`POST /api/families` — Request Body:**
```json
{
  "family_name": "The Harrison Family",
  "shield_config": {
    "initials": "HF",
    "shape": "heater",
    "background_color": "#2D4A7A",
    "accent_color": "#C5A84B",
    "dividing_pattern": "none",
    "font_style": "serif"
  },
  "location_city": "Dublin",
  "location_region": "Leinster",
  "location_country": "Ireland",
  "location_country_code": "IE",
  "faith_tradition": "christian",
  "faith_denomination": "Reformed",
  "faith_community_name": "Grace Community Church, Dublin",
  "worldview_notes": "We teach from a Reformed perspective and use the Westminster Shorter Catechism.",
  "education_methods": ["classical", "charlotte_mason"],
  "current_curriculum": ["Ambleside Online", "Teaching Textbooks"],
  "diet": "omnivore",
  "screen_policy": "minimal",
  "outdoor_orientation": "nature-centred",
  "home_languages": ["en", "ga"],
  "lifestyle_tags": ["liturgical_calendar", "handicrafts", "homesteading"],
  "family_culture": "We are a family of five living on a small farm in Co. Wicklow...",
  "visibility": "local"
}
```

**Response `201 Created`:**
```json
{
  "id": "uuid",
  "family_name": "The Harrison Family",
  "family_name_slug": "the-harrison-family",
  "shield_config": { ... },
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### 6.2 Children Endpoints

```
POST   /api/families/me/children        Add a child
GET    /api/families/me/children        List all children in family
GET    /api/children/{id}               Get a specific child
PUT    /api/children/{id}               Update child
DELETE /api/children/{id}              Soft-delete (sets is_active = false)
```

**`POST /api/families/me/children` — Request Body:**
```json
{
  "first_name": "Elias",
  "nickname": "Eli",
  "gender": "male",
  "birthdate": "2015-03-12",
  "grade_level": "grade_4",
  "child_curriculum": [],
  "learning_styles": ["kinesthetic", "auditory"],
  "personality_description": "Elias is a deeply curious, introverted nine-year-old...",
  "personality_tags": ["introverted", "analytical", "eager_learner", "strong_in_maths"],
  "interests": ["lego", "astronomy", "history", "chess"],
  "motivators": "Clear goals, working alongside dad, hands-on projects",
  "demotivators": "Long reading sessions, open-ended instructions",
  "learning_differences": [],
  "accommodations_notes": null,
  "support_services": []
}
```

---

## 7. Pydantic Models (FastAPI)

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from enum import Enum


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class FaithTradition(str, Enum):
    CHRISTIAN = "christian"
    JEWISH = "jewish"
    MUSLIM = "muslim"
    SECULAR = "secular"
    OTHER = "other"
    NONE = "none"

class ScreenPolicy(str, Enum):
    SCREEN_FREE = "screen_free"
    MINIMAL = "minimal"
    MODERATE = "moderate"
    OPEN = "open"

class FamilyVisibility(str, Enum):
    PRIVATE = "private"
    LOCAL = "local"
    PUBLIC = "public"

class EducationMethod(str, Enum):
    CLASSICAL = "classical"
    CHARLOTTE_MASON = "charlotte_mason"
    MONTESSORI = "montessori"
    UNSCHOOLING = "unschooling"
    STRUCTURED = "structured"
    ECLECTIC = "eclectic"
    WALDORF = "waldorf"
    UNIT_STUDY = "unit_study"
    ONLINE = "online"
    OTHER = "other"

class LearningStyle(str, Enum):
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING_WRITING = "reading_writing"
    SOCIAL = "social"

class GradeLevel(str, Enum):
    PRE_K = "pre_k"
    K = "k"
    GRADE_1 = "grade_1"
    GRADE_2 = "grade_2"
    GRADE_3 = "grade_3"
    GRADE_4 = "grade_4"
    GRADE_5 = "grade_5"
    GRADE_6 = "grade_6"
    GRADE_7 = "grade_7"
    GRADE_8 = "grade_8"
    GRADE_9 = "grade_9"
    GRADE_10 = "grade_10"
    GRADE_11 = "grade_11"
    GRADE_12 = "grade_12"
    STAGE_EARLY = "stage_early"
    STAGE_MIDDLE = "stage_middle"
    STAGE_UPPER = "stage_upper"
    GRADUATED = "graduated"


# ──────────────────────────────────────────────
# Shield Config
# ──────────────────────────────────────────────

class ShieldConfig(BaseModel):
    initials: str = Field(..., min_length=1, max_length=3)
    shape: str = Field("heater", pattern="^(heater|rounded|angular|split)$")
    background_color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    accent_color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    dividing_pattern: str = Field("none", pattern="^(none|horizontal|diagonal|quarterly)$")
    font_style: str = Field("serif", pattern="^(serif|sans|script)$")


# ──────────────────────────────────────────────
# Family Models
# ──────────────────────────────────────────────

class FamilyCreate(BaseModel):
    family_name: str = Field(..., min_length=2, max_length=80)
    shield_config: Optional[ShieldConfig] = None
    location_city: Optional[str] = Field(None, max_length=100)
    location_region: Optional[str] = Field(None, max_length=100)
    location_country: Optional[str] = Field(None, max_length=100)
    location_country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    faith_tradition: Optional[FaithTradition] = None
    faith_denomination: Optional[str] = Field(None, max_length=80)
    faith_community_name: Optional[str] = Field(None, max_length=120)
    worldview_notes: Optional[str] = Field(None, max_length=300)
    education_methods: list[EducationMethod] = Field(default_factory=list, max_length=3)
    current_curriculum: list[str] = Field(default_factory=list, max_length=8)
    diet: Optional[str] = None
    screen_policy: Optional[ScreenPolicy] = None
    outdoor_orientation: Optional[str] = None
    home_languages: list[str] = Field(default_factory=lambda: ["en"])
    lifestyle_tags: list[str] = Field(default_factory=list)
    family_culture: Optional[str] = Field(None, max_length=2000)
    visibility: FamilyVisibility = FamilyVisibility.PRIVATE

    @field_validator("family_name")
    @classmethod
    def validate_family_name(cls, v: str) -> str:
        import re
        if not re.match(r"^[\w\s'\-]+$", v):
            raise ValueError("Family name contains invalid characters")
        return v.strip()

    @field_validator("current_curriculum", "lifestyle_tags", mode="before")
    @classmethod
    def validate_tag_lengths(cls, v: list) -> list:
        return [tag[:60] for tag in v]


class FamilyUpdate(FamilyCreate):
    family_name: Optional[str] = Field(None, min_length=2, max_length=80)


class FamilyResponse(BaseModel):
    id: UUID
    family_name: str
    family_name_slug: str
    shield_config: Optional[ShieldConfig]
    location_city: Optional[str]
    location_country: Optional[str]
    faith_tradition: Optional[FaithTradition]
    education_methods: list[EducationMethod]
    visibility: FamilyVisibility
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Child Models
# ──────────────────────────────────────────────

class ChildCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=60)
    nickname: Optional[str] = Field(None, max_length=40)
    gender: Optional[str] = None
    birthdate: Optional[date] = None
    birth_year: Optional[int] = Field(None, ge=1990, le=2030)
    birth_month: Optional[int] = Field(None, ge=1, le=12)
    grade_level: Optional[GradeLevel] = None
    child_curriculum: list[str] = Field(default_factory=list, max_length=8)
    learning_styles: list[LearningStyle] = Field(default_factory=list, max_length=2)
    personality_description: Optional[str] = Field(None, max_length=1000)
    personality_tags: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list, max_length=15)
    motivators: Optional[str] = Field(None, max_length=200)
    demotivators: Optional[str] = Field(None, max_length=200)
    learning_differences: list[str] = Field(default_factory=list)
    accommodations_notes: Optional[str] = Field(None, max_length=500)
    support_services: list[str] = Field(default_factory=list)

    @field_validator("birthdate", "birth_year", mode="before")
    @classmethod
    def validate_age_provided(cls, v):
        return v  # cross-field validation handled in route

    model_config = {"populate_by_name": True}


class ChildUpdate(ChildCreate):
    first_name: Optional[str] = Field(None, min_length=1, max_length=60)


class ChildResponse(BaseModel):
    id: UUID
    family_id: UUID
    first_name: str
    nickname: Optional[str]
    gender: Optional[str]
    birthdate: Optional[date]
    birth_year: Optional[int]
    grade_level: Optional[GradeLevel]
    learning_styles: list[LearningStyle]
    personality_tags: list[str]
    interests: list[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

---

## 8. TypeScript Types (Frontend)

```typescript
// packages/types/src/family.ts

export type FaithTradition =
  | "christian" | "jewish" | "muslim"
  | "secular" | "other" | "none";

export type ScreenPolicy = "screen_free" | "minimal" | "moderate" | "open";

export type FamilyVisibility = "private" | "local" | "public";

export type EducationMethod =
  | "classical" | "charlotte_mason" | "montessori" | "unschooling"
  | "structured" | "eclectic" | "waldorf" | "unit_study" | "online" | "other";

export type ShieldShape = "heater" | "rounded" | "angular" | "split";
export type ShieldPattern = "none" | "horizontal" | "diagonal" | "quarterly";
export type ShieldFontStyle = "serif" | "sans" | "script";

export interface ShieldConfig {
  initials: string;
  shape: ShieldShape;
  background_color: string;
  accent_color: string;
  dividing_pattern: ShieldPattern;
  font_style: ShieldFontStyle;
}

export interface Family {
  id: string;
  family_name: string;
  family_name_slug: string;
  shield_config: ShieldConfig;
  location_city?: string;
  location_region?: string;
  location_country?: string;
  location_country_code?: string;
  faith_tradition?: FaithTradition;
  faith_denomination?: string;
  faith_community_name?: string;
  worldview_notes?: string;
  education_methods: EducationMethod[];
  current_curriculum: string[];
  diet?: string;
  screen_policy?: ScreenPolicy;
  outdoor_orientation?: string;
  home_languages: string[];
  lifestyle_tags: string[];
  family_culture?: string;
  visibility: FamilyVisibility;
  created_at: string;
  updated_at: string;
}

export type FamilyCreate = Omit<Family, "id" | "family_name_slug" | "created_at" | "updated_at">;


// packages/types/src/child.ts

export type LearningStyle =
  | "visual" | "auditory" | "kinesthetic" | "reading_writing" | "social";

export type GradeLevel =
  | "pre_k" | "k"
  | "grade_1" | "grade_2" | "grade_3" | "grade_4" | "grade_5" | "grade_6"
  | "grade_7" | "grade_8" | "grade_9" | "grade_10" | "grade_11" | "grade_12"
  | "stage_early" | "stage_middle" | "stage_upper" | "graduated";

export interface Child {
  id: string;
  family_id: string;
  first_name: string;
  nickname?: string;
  gender?: string;
  avatar_initials?: string;
  birthdate?: string;       // ISO date string
  birth_year?: number;
  birth_month?: number;
  grade_level?: GradeLevel;
  child_curriculum: string[];
  learning_styles: LearningStyle[];
  personality_description?: string;
  personality_tags: string[];
  interests: string[];
  motivators?: string;
  demotivators?: string;
  learning_differences: string[];
  accommodations_notes?: string;
  support_services: string[];
  is_active: boolean;
  created_at: string;
}

export type ChildCreate = Omit<Child, "id" | "family_id" | "is_active" | "created_at">;
```

---

## 9. AI Assistant Context Builder

When the AI assistant is invoked for a family, a context string is assembled from the family and child records. This is injected as the system prompt preamble.

```python
def build_family_context(family: Family, children: list[Child]) -> str:
    """
    Builds the AI assistant context string from family and child data.
    Injected as a system prompt section for every AI interaction.
    """
    lines = []

    lines.append("## Family Context")
    lines.append(f"Family: {family.family_name}")

    if family.faith_tradition and family.faith_tradition not in ("secular", "none"):
        faith = family.faith_tradition.capitalize()
        if family.faith_denomination:
            faith += f" ({family.faith_denomination})"
        lines.append(f"Faith: {faith}")
        if family.faith_community_name:
            lines.append(f"Church: {family.faith_community_name}")
        if family.worldview_notes:
            lines.append(f"Teaching convictions: {family.worldview_notes}")

    if family.education_methods:
        methods = ", ".join(m.replace("_", " ").title() for m in family.education_methods)
        lines.append(f"Education philosophy: {methods}")

    if family.current_curriculum:
        lines.append(f"Curriculum: {', '.join(family.current_curriculum)}")

    if family.screen_policy:
        lines.append(f"Screen policy: {family.screen_policy.replace('_', ' ')}")

    if family.lifestyle_tags:
        lines.append(f"Lifestyle: {', '.join(family.lifestyle_tags)}")

    if family.family_culture:
        lines.append(f"\nFamily description: {family.family_culture}")

    lines.append("\n## Children")
    for child in children:
        display_name = child.nickname or child.first_name
        lines.append(f"\n### {display_name} ({child.first_name})")

        if child.birthdate:
            from datetime import date
            age = (date.today() - child.birthdate).days // 365
            lines.append(f"Age: {age}")
        elif child.birth_year:
            from datetime import date
            age = date.today().year - child.birth_year
            lines.append(f"Age: approximately {age}")

        if child.grade_level:
            lines.append(f"Grade: {child.grade_level.replace('_', ' ').title()}")

        if child.learning_styles:
            styles = ", ".join(s.replace("_", " ") for s in child.learning_styles)
            lines.append(f"Learning style: {styles}")

        if child.personality_description:
            lines.append(f"Personality: {child.personality_description}")
        elif child.personality_tags:
            lines.append(f"Personality tags: {', '.join(child.personality_tags)}")

        if child.interests:
            lines.append(f"Interests: {', '.join(child.interests)}")

        if child.motivators:
            lines.append(f"Motivated by: {child.motivators}")

        if child.demotivators:
            lines.append(f"Struggles with: {child.demotivators}")

        if child.learning_differences:
            lines.append(f"Learning differences: {', '.join(child.learning_differences)}")

        if child.accommodations_notes:
            lines.append(f"Accommodations: {child.accommodations_notes}")

    return "\n".join(lines)
```

**Example output injected into AI system prompt:**

```
## Family Context
Family: The Harrison Family
Faith: Christian (Reformed)
Church: Grace Community Church, Dublin
Teaching convictions: We teach from a Reformed perspective and use the Westminster Shorter Catechism.
Education philosophy: Classical, Charlotte Mason
Curriculum: Ambleside Online, Teaching Textbooks
Screen policy: minimal
Lifestyle: liturgical_calendar, handicrafts, homesteading

Family description: We are a family of five living on a small farm in Co. Wicklow...

## Children

### Eli (Elias)
Age: 9
Gender: Male
Grade: Grade 4
Learning style: kinesthetic, auditory
Personality: Elias is a deeply curious, introverted nine-year-old who loves building things...
Interests: lego, astronomy, history, chess
Motivated by: Clear goals, working alongside dad, hands-on projects
Struggles with: Long reading sessions, open-ended instructions
```

---

## 10. Routes & Middleware

### Next.js Route Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (onboarding)/
│   ├── layout.tsx              ← Onboarding shell (logo only, no sidebar)
│   ├── family/
│   │   └── page.tsx            ← 4-step family creation wizard
│   └── children/
│       └── page.tsx            ← Add children after family creation
├── (app)/
│   ├── layout.tsx              ← Main app shell with sidebar
│   ├── dashboard/page.tsx
│   └── family/
│       ├── page.tsx            ← Family settings
│       └── children/
│           └── add/page.tsx    ← Standalone add child page
└── middleware.ts
```

### Middleware Logic

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = await getSession(req);  // from Supabase/Clerk helper

  // Not authenticated → send to login
  if (!session) {
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Authenticated but no family → send to family creation
  if (!session.has_family) {
    if (!pathname.startsWith("/onboarding/family")) {
      return NextResponse.redirect(new URL("/onboarding/family", req.url));
    }
    return NextResponse.next();
  }

  // Has family but is on onboarding → send to dashboard
  if (pathname === "/onboarding/family") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/dashboard/:path*", "/family/:path*"],
};
```

---

## 11. Component Map

### Family Wizard Components

```
FamilyWizard                    ← Orchestrates wizard state, step navigation
  ├── WizardProgress            ← Step indicator bar
  ├── WizardStep1               ← Family name, shield, location
  │   ├── FamilyNameInput       ← Name input + uniqueness check
  │   └── ShieldBuilder         ← Interactive SVG shield editor
  │       ├── ShieldPreview     ← Live SVG render of current config
  │       ├── ShieldShapePicker
  │       ├── ShieldColorPicker
  │       └── ShieldInitialsInput
  ├── WizardStep2               ← Faith & values
  │   ├── FaithTraditionCards   ← Radio cards with icons
  │   ├── DenominationSelector  ← Conditional on Christian
  │   └── WorldviewNotesInput
  ├── WizardStep3               ← Education & lifestyle
  │   ├── EducationMethodCards  ← Multi-select + drag to reorder
  │   ├── CurriculumTagInput
  │   ├── ScreenPolicySlider
  │   └── LifestyleTagGrid
  ├── WizardStep4               ← Family story + visibility
  │   ├── FamilyCultureTextarea
  │   └── VisibilityCards
  └── WizardSummary             ← Review card before submit
```

### Child Form Components

```
ChildrenOnboardingPage
  ├── ChildCardList             ← Shows added children
  ├── AddChildButton            ← Opens drawer
  └── ChildDrawer / ChildModal
      └── ChildForm
          ├── ChildBasicFields  ← Name, DOB, pronoun, avatar
          ├── ChildEducation    ← Grade, curriculum, learning style
          ├── ChildPersonality  ← Description, tags, interests, motivators
          ├── ChildNeeds        ← Learning differences, accommodations
          └── ChildFaith        ← Faith stage, character notes (conditional)
```

---

## 12. Validation Rules Summary

| Field | Rule |
|---|---|
| `family_name` | 2–80 chars, unique (case-insensitive), alphanumeric + space + `'` + `-` |
| `shield_config.initials` | 1–3 chars, auto-filled from family name |
| `shield_config.*_color` | Must be one of 10 approved hex values |
| `worldview_notes` | Max 300 chars |
| `education_methods` | Max 3 selections |
| `current_curriculum` tags | Max 8 tags, each max 60 chars |
| `family_culture` | Max 2,000 chars |
| `child.first_name` | 1–60 chars, required |
| `child.birthdate` OR `birth_year` | At least one required if any age-dependent features used |
| `child.learning_styles` | Max 2 selections |
| `child.personality_description` | Max 1,000 chars |
| `child.interests` | Max 15 tags |
| `child.motivators` / `demotivators` | Max 200 chars each |
| `child.accommodations_notes` | Max 500 chars |

---

## 13. Open Questions for RFC

1. **Shield colour palette** — Should we provide 10 fixed curated colours or a broader free-picker? Fixed palette ensures visual quality in the community directory; free picker gives more family expression.
Answer: offer a palette of 10 curated colours, but allow free-picker for those who want more expression.
2. **Multiple accounts per family** — Currently one account owns a family. Should co-parents be able to have separate logins with shared access? This has significant auth implications and is scoped to a later phase.
Answer: One account per family for now.
3. **Age vs grade level** — Homeschoolers often resist grade labels. Should `grade_level` be renamed or reframed? "Stage" options are included for this reason, but the field name itself could cause friction.
Answer: One field named as "Grade level" but with a hint saying "Stage".

---

