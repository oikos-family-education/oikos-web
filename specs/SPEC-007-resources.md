# Oikos — Spec 006: Resources
**Version:** 1.0
**Status:** Ready for implementation

---

## 1. Overview

Resources are learning materials — books, videos, articles, courses, and more — that parents use to teach their children. A Resource belongs to a Family and can be linked to one or more Subjects. Each Subject↔Resource link carries its own progress note (e.g. "Chapter 4", "Page 87", "Lesson 12 of 24") that the parent updates as the child advances.

---

## 2. Resource Types

The `type` field is an enum. Seed the following values:

| Value | Display Label | Notes |
|---|---|---|
| `book` | Book | Physical or digital book |
| `article` | Article | Blog post, essay, or magazine piece |
| `video` | Video | YouTube, Vimeo, or any video content |
| `course` | Course | Structured online or offline course |
| `podcast` | Podcast | Audio series or individual episodes |
| `documentary` | Documentary | Film or documentary series |
| `printable` | Printable / Worksheet | PDF or printable activity |
| `website` | Website | Reference site, wiki, or web tool |
| `curriculum` | Curriculum Package | A full packaged curriculum product |
| `other` | Other | Catch-all for unlisted types |

---

## 3. Data Model

### 3.1 `resources` table

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | |
| `family_id` | UUID | FK → families.id, NOT NULL | Scopes resource to a family |
| `title` | VARCHAR(255) | NOT NULL | |
| `type` | resource_type_enum | NOT NULL | See §2 |
| `author` | VARCHAR(255) | nullable | Person, channel, publisher |
| `description` | TEXT | nullable | Optional notes about this resource |
| `url` | TEXT | nullable | Link to the resource |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

### 3.2 `subject_resources` junction table

Many-to-many between `subjects` and `resources`, with progress tracking on the relationship.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `subject_id` | UUID | FK → subjects.id, NOT NULL | |
| `resource_id` | UUID | FK → resources.id, NOT NULL | |
| `progress_notes` | VARCHAR(500) | nullable | Free-text progress (e.g. "Chapter 4", "Page 87") |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | Tracks when progress was last noted |

Primary key: `(subject_id, resource_id)`

### 3.3 Cascade rules

- Deleting a `resource` cascades to delete all its `subject_resources` rows.
- Deleting a `subject` cascades to delete all its `subject_resources` rows.

---

## 4. URL Service Detection

When a resource has a URL, display a recognisable icon or logo instead of the raw URL string. Match on the hostname using the following table. For unrecognised hostnames, display a generic link icon (e.g. `lucide-react` `Link2` icon).

| Hostname pattern | Display label | Suggested icon source |
|---|---|---|
| `youtube.com`, `youtu.be` | YouTube | `lucide-react` `Youtube` or SVG brand logo |
| `drive.google.com`, `docs.google.com` | Google Drive | Google Drive brand icon (SVG inline) |
| `amazon.com`, `amzn.to` | Amazon | Amazon brand icon (SVG inline) |
| `vimeo.com` | Vimeo | Vimeo brand icon (SVG inline) |
| `spotify.com` | Spotify | Spotify brand icon (SVG inline) |
| `khanacademy.org` | Khan Academy | Khan Academy brand icon (SVG inline) |
| `archive.org` | Internet Archive | `lucide-react` `Archive` icon |
| `notionso.com`, `notion.so` | Notion | Notion brand icon (SVG inline) |
| *(any other)* | Link | `lucide-react` `Link2` icon |

Implementation note: write a small `getServiceMeta(url: string): { label: string; icon: ReactNode }` utility. The icon should be rendered as a small badge (≈20px) beside the resource title or in a dedicated URL cell — never the raw URL string.

---

## 5. Feature Scope

### 5.1 Resource CRUD

**Create resource**
- Fields: title (required), type (required), author (optional), description (optional), url (optional)
- Subject linking is part of the create flow (multi-select existing Subjects for this family; zero subjects is valid)
- On save, write to `resources` and upsert `subject_resources` rows for each selected subject

**Edit resource**
- All fields editable
- Subject links editable: add or remove subjects; changing the subject set updates `subject_resources` accordingly
- Removing a subject link deletes that `subject_resources` row (and discards its `progress_notes`)

**Delete resource**
- Confirmation dialog required: "Deleting this resource will also remove it from all linked subjects."
- Hard delete (cascade handles junction rows)

### 5.2 Subject–Resource Progress

Progress is tracked on the `subject_resources` row, not on the resource itself. The same book linked to two subjects (e.g. "History" and "Literature") can have independent progress notes.

- Editable inline: clicking the progress field on a Subject↔Resource link opens a small inline text editor
- `progress_notes` is free-text (no fixed format enforced — parents write "Chapter 4", "Page 87 of 312", "Unit 3 complete", etc.)
- Saving updates `subject_resources.progress_notes` and `subject_resources.updated_at`

### 5.3 Resources List Page

Route: `/resources`

- Displays all resources belonging to the current family
- **Filters** (sidebar or top bar): Type (multi-select), Subject (multi-select)
- **Sort**: by title (A–Z, Z–A), by created date (newest, oldest)
- **Search**: client-side filter on title and author
- Each resource card shows: type badge, title, author (if set), linked subjects (as small pills), URL service icon (if url set)
- Empty state: friendly prompt to add the family's first resource

### 5.4 Resource Detail / Edit Page (or Modal)

Route: `/resources/[id]` or a slide-over panel — Claude Code's choice based on existing UI patterns in the codebase.

Displays:
- All resource fields
- Linked subjects, each showing its `progress_notes` with an inline edit control
- Edit and Delete actions

### 5.5 Subject Detail — Resources Tab

On the Subject detail page (already existing from Spec 004), add a **Resources** tab.

- Lists all resources linked to this subject
- Each row: type badge, title, author, URL service icon, `progress_notes` (inline editable)
- "Add resource" action opens a picker: search/select from existing family resources, or create a new one inline
- Removing a resource from the subject deletes the `subject_resources` row after confirmation: "Remove this resource from [Subject Name]?"

---

## 6. Navigation

- Add a **Resources** entry to the global nav shell (from Spec 003) under the Education section, icon: `lucide-react` `Library`
- The Resources list page is the top-level entry point

---

## 7. Permissions & Scoping

- All resource operations are scoped to `family_id` derived from the authenticated session
- A resource cannot be viewed, edited, or linked by any other family
- No public resource sharing in this spec (deferred to a future community/resource-library spec)

---

## 8. Out of Scope (Deferred)

The following are explicitly deferred to future specs:

- **Community resource library**: platform-wide shared/curated resources browsable by all families
- **Resource ratings and reviews**
- **File uploads**: attaching PDFs or files directly to a resource (URL-only for now)
- **Child-level progress**: progress is tracked at the Subject↔Resource level, not per-child (deferred)
- **Resource templates / pre-seeded content**: platform-provided resource suggestions

---

## 9. Copy & Tone Notes

Consistent with Oikos' warm, non-clinical voice:

- Empty state (no resources yet): *"Your resource library is empty. Add the books, videos, and materials your family is using."*
- Delete confirmation: *"Remove [Title]? This will also unlink it from [N] subject(s)."*
- Remove from subject confirmation: *"Remove [Title] from [Subject Name]? Progress notes for this link will be lost."*
- Progress placeholder text: *"e.g. Chapter 3, Page 47, Lesson 12…"*

---

*End of Spec 005*