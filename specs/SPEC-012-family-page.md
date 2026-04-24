# SPEC-012 — Family Page
**Version:** 1.0
**Depends on:** SPEC-001 (auth), SPEC-002 (family & children onboarding), SPEC-003 (navigation shell), SPEC-008 (children page)

---

## 1. Overview

The Family page (`/family`) is the central hub for everything that defines the family as a whole — the information the user captured during the onboarding wizard (name, location, faith, education philosophy, lifestyle, culture, visibility), plus household management tools (coat of arms, co-parent/educator invitations, data export, delete family).

The page replaces the current placeholder at [apps/web/app/[locale]/(dashboard)/family/page.tsx](apps/web/app/[locale]/(dashboard)/family/page.tsx) and is reachable from the **Family** item in the left sidebar ([components/dashboard/Sidebar.tsx:55](apps/web/components/dashboard/Sidebar.tsx:55)).

All content that the user entered during `/onboarding/family` must be editable here, and the edition UI must **reuse the same components** used in onboarding (the `WizardStep1/2/3` sections and the `ShieldBuilder`), with minimal adaptation.

---

## 2. Goals

- Give a single place to view and edit every piece of family-level information that influences the AI assistant, community visibility, and lesson generation.
- Reuse the onboarding step components so there is one source of truth for how family fields are edited.
- Let the primary account holder invite a **second parent / educator** who will share full access to the family's data — with an explicit, prominent warning about what "full access" means.
- Provide household-management tools that are a natural fit for a "Family" area (coat of arms, data export, account removal).

---

## 3. Out of Scope / Deferred

| Item | Reason |
|---|---|
| Children roster / add child | Lives at `/children` (SPEC-008) |
| More than one co-parent / multi-educator households (> 2 adults) | Post-MVP — start with a single additional adult |
| Role-based permissions for the second adult (view-only, limited, etc.) | Post-MVP — both adults have full access in v1 |
| Tutor / grandparent / external viewer sharing | Community spec |
| Transferring the family to another account | Post-MVP |
| Billing / subscription management | Separate Billing spec |
| Per-adult notification preferences | Notifications spec |

---

## 4. Page Structure

The page lives at `/family` (protected route — must be listed in `PROTECTED_PATHS` in [apps/web/middleware.ts](apps/web/middleware.ts)). Wrapped in `<div className="max-w-5xl">` per dashboard conventions.

### 4.1 Layout — Tabbed sections

A page header (`text-2xl font-bold text-slate-800`) shows **"Family"** with a muted subtitle: *"Your household's profile, identity, and members."*

Below the header, a horizontal tab bar with the following sections:

| Tab | Content source | Purpose |
|---|---|---|
| **Identity** | Family name, location, coat of arms | Who you are |
| **Faith & worldview** | `WizardStep2` fields | Beliefs |
| **Education & lifestyle** | `WizardStep3` fields | How you live & learn |
| **Members** | Primary adult + co-parent invitation | People with access |
| **Privacy & danger zone** | Visibility, export, delete | Account-level controls |

Tabs are deep-linked via a query param (`?tab=identity|faith|education|members|privacy`), default `identity`. This makes sidebar jumps and in-app links (e.g. "Set up your coat of arms →") work correctly.

### 4.2 Save model

Each tab is an **independent editable form**:

- Fields load pre-filled from `GET /api/v1/families/me`.
- A sticky footer inside the card shows **"Save changes"** (disabled until dirty) and **"Cancel"** (discard, only shown when dirty).
- Saves are per-tab via `PATCH /api/v1/families/me` with only the changed fields.
- Success: toast "Family updated." and re-hydrate the form from the response.
- Error: inline Alert, in line with form guidelines in [.claude/rules/form-guidelines.md](.claude/rules/form-guidelines.md).

Navigating away with unsaved changes triggers a "Discard changes?" confirmation.

---

## 5. Component Reuse from Onboarding

The onboarding wizard uses three step components that own the field layout for each slice of family data:

- [components/onboarding/WizardStep1.tsx](apps/web/components/onboarding/WizardStep1.tsx) — family name, location
- [components/onboarding/WizardStep2.tsx](apps/web/components/onboarding/WizardStep2.tsx) — faith tradition, denomination, community, worldview notes
- [components/onboarding/WizardStep3.tsx](apps/web/components/onboarding/WizardStep3.tsx) — education purpose, methods, curriculum, diet, screen policy, outdoor orientation, home languages, family culture, visibility

These MUST be reused on the Family page, not re-implemented.

### 5.1 Required refactor

The three step components currently import `FamilyFormData` from `FamilyWizard.tsx` and receive `data` / `onChange`. They are already presentational. Small changes needed:

1. **Move `FamilyFormData` and `buildDefaultFormData`** out of `FamilyWizard.tsx` into a new shared module `components/family/familyFormTypes.ts`. Both the wizard and the Family page import from there.
2. **Rename directory for clarity** — move the three step components into `components/family/` (or leave them in `components/onboarding/` and import from there; author's call). If moved, update imports in the wizard.
3. No prop-interface change is needed — they already take `{ data, onChange }`.
4. Any copy in the steps that is onboarding-flavoured ("Welcome!", "Let's set up…") must come from translation keys that are not used on the Family page. The steps today use neutral `Onboarding.*` keys (e.g., `step1Heading`) which are fine to reuse; introduce a new `Family.*` namespace only if copy must diverge (likely for the Identity tab heading).

### 5.2 Visibility field placement

In onboarding, **visibility** is the last field of `WizardStep3`. On the Family page it makes more sense on the **Privacy & danger zone** tab. Two options — pick one in implementation:

- **(Preferred)** Accept a `hideVisibility` prop on `WizardStep3` (default `false`) and render the visibility block on the Privacy tab using the same Visibility UI, extracted into a shared `<VisibilityPicker>` sub-component.
- Leave visibility inside `WizardStep3` and omit the duplicate on Privacy.

### 5.3 Coat of arms

The Identity tab embeds the existing [components/onboarding/ShieldBuilder.tsx](apps/web/components/onboarding/ShieldBuilder.tsx) for editing the shield. It already reads/writes via `PATCH /api/v1/families/me/shield` (see [routers/families.py:35](apps/api/app/routers/families.py:35)) so no backend change is required.

A collapsed "Your coat of arms" card renders a `ShieldPreview` plus an "Edit" button that expands the `ShieldBuilder` inline (or opens a drawer — author's call).

---

## 6. Members Tab (Second Parent / Educator)

This is the only truly **new** piece of UX in this spec. Everything else is "re-skin onboarding into an editable page".

### 6.1 Members list

A simple list of people who have access to this family's account. In v1 there are at most two entries:

| Row element | Content |
|---|---|
| Avatar / initials | From user's `first_name` / `last_name` |
| Name | `first_name last_name` + email in muted subtitle |
| Role badge | "Primary" (account owner) or "Co-parent / Educator" |
| Status | "Active", "Invited (pending)", or "Invitation expired" |
| Actions | On the non-primary row only: **"Resend invite"** (if pending), **"Cancel invite"** (if pending), **"Remove access"** (if active) |

If there is no co-parent yet, the list shows only the primary user followed by an **"Invite a second parent or educator"** call-to-action block.

### 6.2 Invite block — warning is the UX

The invite CTA must make the consequences unmissable. Layout:

```
┌────────────────────────────────────────────────────────────┐
│ 👥  Invite a second parent or educator                     │
│                                                             │
│ Your spouse, a co-educator, or another trusted adult can    │
│ share access to this family. This is intended for the       │
│ people who raise and teach these children with you.         │
│                                                             │
│ ⚠️  Full access warning                                     │
│   The person you invite will see and be able to edit:       │
│   • Every child's profile, lessons, and progress            │
│   • Your family's faith, worldview, and culture notes       │
│   • Your calendar, planner, projects, and journal           │
│   • All community and privacy settings                      │
│                                                             │
│   Only invite someone you fully trust with this family's    │
│   data. You can remove their access at any time.            │
│                                                             │
│ [Email input]  [Invite]                                     │
└────────────────────────────────────────────────────────────┘
```

Concretely:

- The warning block uses an **amber / warning** palette (`bg-amber-50 border-amber-200 text-amber-800`), NOT a destructive red — this is a cautionary heads-up, not an error.
- Bullet list is rendered, not collapsed into prose.
- The **"Invite"** button is disabled until the user ticks a checkbox: **"I understand that this person will have full access to my family's data."** The checkbox sits directly above the button.
- The email input uses `<Input>` from `@oikos/ui` with `required` and zod email validation.
- The button uses `<Button>` from `@oikos/ui` per [form-guidelines.md](.claude/rules/form-guidelines.md).

### 6.3 Invitation flow

1. User submits email → `POST /api/v1/families/me/members/invite` with `{ email }`.
2. Backend creates a `FamilyInvitation` row (see §8) and sends an email with a signed, single-use token link: `https://<app>/invite/accept?token=<token>`.
3. The members list updates to show the invitee with status "Invited (pending)" and the timestamp of invitation.
4. Recipient clicks the link:
   - If they have no Oikos account → redirected to `/register?invite=<token>`. On registration completion, their account is attached to the existing family (instead of being sent through `/onboarding/family`).
   - If they already have an account but no family → login → `/invite/accept?token=...` reads the token, attaches their user to the family, and lands them on `/` (dashboard).
   - If they already belong to a different family → show a blocking page: "You already belong to the <Name> family. Leave that family first to accept this invitation." No auto-transfer.
5. On acceptance, the inviter sees a notification on next load and the row flips to "Active".

Invitations expire after **7 days**. Expired rows can be resent (issues a new token, invalidates the old).

### 6.4 Removing a co-parent

"Remove access" on an active co-parent row opens a confirmation modal:
- **Title:** "Remove <Name> from this family?"
- **Body:** "They will immediately lose access to all family data. Any content they created stays with the family. This does not delete their Oikos account."
- **Actions:** "Remove access" (destructive primary) | "Cancel"

On confirm, the user is detached from the family (their `family_id` pointer removed or their membership row deleted — see §8), and they are signed out of any active sessions attached to this family.

### 6.5 Primary vs. co-parent

- The primary account holder (the `account_id` on the `families` table) cannot be removed by anyone.
- A co-parent **cannot** remove the primary. Only the primary can invite, resend, cancel, or remove others in v1.
- A co-parent **can** edit all other family fields (identity, faith, education, visibility). This is the "full access" the warning describes.

---

## 7. Privacy & Danger Zone Tab

### 7.1 Visibility
Re-uses the visibility picker described in §5.2. Copy matches the `VISIBILITY_OPTIONS` already defined in [WizardStep3.tsx:58](apps/web/components/onboarding/WizardStep3.tsx:58).

### 7.2 Export family data

A card with:
- Title: "Export your family data"
- Body: "Download a JSON archive of your family profile, children, subjects, planner, projects, journal, and progress records."
- Button: **"Request export"** → `POST /api/v1/families/me/export` → backend generates a zip asynchronously and emails a signed download link (or streams synchronously if small; implementer's call — spec only requires the user-visible behaviour).

### 7.3 Delete family

A destructive card, visually distinct (`border-red-200 bg-red-50/40`):
- Title: "Delete this family"
- Body: "This permanently deletes the family, all children profiles, and every record linked to them. This cannot be undone. Your Oikos account will remain and you can create or join a different family afterwards."
- Button: **"Delete family"** (red) → opens a type-to-confirm modal where the user must type the family name exactly, then click "Permanently delete".
- Backend: `DELETE /api/v1/families/me`. Cascades via existing ORM relationships.

Only the primary account holder sees the delete card. Co-parents see it replaced by a **"Leave this family"** card which detaches them without deleting anything.

---

## 8. Data Model

### 8.1 `families` table
No changes.

### 8.2 New `family_members` table

Today, family ownership is a single `account_id` FK on `families` ([apps/api/app/models/family.py:16](apps/api/app/models/family.py:16)). To support a second adult we introduce a join table:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `family_id` | UUID FK → `families.id` ON DELETE CASCADE | Indexed |
| `user_id` | UUID FK → `users.id` ON DELETE CASCADE | Indexed, unique together with `family_id` |
| `role` | String(20) | `primary` or `co_parent` |
| `joined_at` | DateTime(tz=True) | |
| `created_at` / `updated_at` | DateTime(tz=True) | Standard |

Migration:
- Create `family_members`.
- Backfill one `primary` row per existing family using its current `account_id`.
- `families.account_id` is retained and still points to the primary — it stays the source of truth for "who can delete the family", but membership/access checks start reading `family_members`.

The `get_current_user` → family lookup path (`family_service.get_family_by_account`) must be updated to **resolve the family via `family_members`**, not via `account_id` directly, so co-parents see the right family.

### 8.3 New `family_invitations` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `family_id` | UUID FK → `families.id` ON DELETE CASCADE | Indexed |
| `email` | String(255) | Normalised lowercase; indexed |
| `token_hash` | String(64) | SHA-256 of the invite token (raw token is emailed, never stored) |
| `invited_by_user_id` | UUID FK → `users.id` | Who sent it |
| `expires_at` | DateTime(tz=True) | 7 days from creation |
| `accepted_at` | DateTime(tz=True) nullable | Set when used |
| `revoked_at` | DateTime(tz=True) nullable | Set on cancel |
| `created_at` / `updated_at` | DateTime(tz=True) | Standard |

Constraints:
- Only one **pending** (not accepted, not revoked, not expired) invitation per `(family_id, email)` at a time.
- Only one **active** co-parent per family in v1 — API rejects a second invitation if the family already has two active members.

### 8.4 User → family linkage

`users.has_family` stays true whenever the user has any row in `family_members`.

---

## 9. API Endpoints

New endpoints on the existing families router ([apps/api/app/routers/families.py](apps/api/app/routers/families.py)):

| Method | Path | Body / Query | Response | Notes |
|---|---|---|---|---|
| `PATCH` | `/api/v1/families/me` | `FamilyUpdate` (all fields optional) | `FamilyResponse` | Updates any subset of family profile fields. Any member may call. |
| `GET` | `/api/v1/families/me/members` | — | `MemberResponse[]` | Lists members + pending invitations. |
| `POST` | `/api/v1/families/me/members/invite` | `{ email }` | `InvitationResponse` | Primary only. 409 if slot full, 409 if pending invite exists, 400 on invalid email. |
| `POST` | `/api/v1/families/me/members/invite/{invitation_id}/resend` | — | `InvitationResponse` | Primary only. Issues a new token. |
| `DELETE` | `/api/v1/families/me/members/invite/{invitation_id}` | — | 204 | Primary only. Revokes a pending invitation. |
| `DELETE` | `/api/v1/families/me/members/{user_id}` | — | 204 | Primary only. Removes a co-parent. 403 if target is primary. |
| `POST` | `/api/v1/families/me/members/leave` | — | 204 | Co-parent only. Self-detach. 403 if primary. |
| `POST` | `/api/v1/invitations/accept` | `{ token }` | `FamilyResponse` | Authenticated. 410 if expired/revoked. 409 if user already belongs to a family. |
| `POST` | `/api/v1/families/me/export` | — | `{ status: "pending" | "ready", url?: string }` | Any member. |
| `DELETE` | `/api/v1/families/me` | — | 204 | Primary only. Cascades. |

All routes follow the layered-architecture rules in [.claude/rules/api-conventions.md](.claude/rules/api-conventions.md): router is thin, logic lives in `FamilyService` / a new `FamilyMembersService`.

---

## 10. Permissions & Access Control

| Action | Primary | Co-parent |
|---|---|---|
| View family profile | ✅ | ✅ |
| Edit family profile (any tab except danger zone) | ✅ | ✅ |
| Edit / replace coat of arms | ✅ | ✅ |
| Change visibility | ✅ | ✅ |
| Invite / remove co-parent | ✅ | ❌ |
| Delete family | ✅ | ❌ |
| Leave family | ❌ (must delete or transfer — transfer is post-MVP) | ✅ |
| Export family data | ✅ | ✅ |

The frontend hides actions the current user cannot take; the backend re-enforces every check via `get_current_user` + membership role.

---

## 11. UX Notes

- The tab bar must preserve scroll position and unsaved-form state when the user switches tabs, until they navigate away from `/family` entirely.
- All translated copy goes under a new `Family` namespace in [messages/en.json](apps/web/messages/en.json), except where existing `Onboarding.*` keys are reused verbatim by the shared step components (see §5.1).
- Required fields on all forms render the red asterisk per [form-guidelines.md](.claude/rules/form-guidelines.md) — this is already the case in the onboarding steps that use `<Input required>`, so reuse gets this for free.
- The invitation warning block is tested for screen readers: the bullet list is real `<ul>` markup, the checkbox and submit button are labelled, and the warning uses `role="note"` (not `alert`) since it is informational rather than an error.
- On small viewports (< 640px) the tab bar collapses to a `<select>` dropdown to avoid horizontal scrolling.
- After a successful invitation is sent, the invite form resets and shows an inline success toast: "Invitation sent to <email>. They have 7 days to accept."

---

## 12. Analytics Events

Emit (console stub in v1, real analytics later):

- `family_profile_updated` — `{ tab, fields_changed }`
- `family_shield_updated`
- `family_invitation_sent` — `{ invitation_id }`
- `family_invitation_accepted` — `{ invitation_id, days_to_accept }`
- `family_invitation_revoked`
- `family_member_removed`
- `family_member_left`
- `family_deleted`
- `family_export_requested`
