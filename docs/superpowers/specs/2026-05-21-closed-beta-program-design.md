# Closed Beta Program — Product Spec

**Status:** Draft
**Date:** 2026-05-21
**Companion spec:** [Admin Center](2026-05-21-admin-center-design.md) (follow-on work)

## 1. Purpose

Before general availability, Oikos needs a controlled way to onboard the first cohort of families. This spec covers the public-facing closed-beta application funnel and the minimum admin surface required to review applications, approve them, and get new families into the product.

The "6 months free" benefit promised to beta families is honored later when the billing system is built. This spec only ensures the data needed to grant it (the link between an approved beta application and the eventual user account) is captured.

## 2. Goals

- Let prospective families apply for the closed beta from the public website.
- Let Oikos admins review applications privately and approve or deny them.
- Get approved applicants from approval → registered, onboarded user with no friction.
- Capture the audit trail of beta decisions from day one.
- Cap the program softly at 50 approved families, with admin override.

## 3. Non-goals

- Billing, subscription enforcement, or any monetary handling.
- Stats dashboards, family drill-down, moderation actions on accounts, audit-log viewer UI — all covered by the [Admin Center spec](2026-05-21-admin-center-design.md).
- Multi-language support for the beta funnel or admin app — English only.
- Public messaging when the beta is "full" — the cap is internal.
- Denial notification emails.

## 4. Applicant journey

### 4.1 Landing page CTA

The marketing landing page (`/`) gains a prominent section announcing the closed beta:

- Headline making the offer clear ("Join the Oikos closed beta — limited to 50 families").
- Brief explanation of the program: what beta members get (6 months free at launch), what's expected (early use, feedback), and the 50-family limit.
- Primary CTA button: "Apply for the closed beta" → navigates to `/beta`.

### 4.2 The `/beta` application page

A dedicated route in the marketing surface (public, no auth). Contents:

- Recap of the program rules and benefit.
- Application form with these fields:
  - **First name** (required, 1–100 chars)
  - **Last name** (required, 1–100 chars)
  - **Email** (required, RFC-valid, lowercased and trimmed before storage)
  - **Reason for wanting to use Oikos** (required, free-text, 50–1000 chars; counter visible)
- A "By applying you agree to receive an email from us about your application" line — no separate consent checkbox, the act of submitting is consent.
- Submit button using the standard `@oikos/ui` Button.

#### Form behavior

- All fields use the existing form conventions (required asterisks, inline error display).
- Validation messages are localized via `next-intl` even though only English is shipped, to keep the codebase consistent.
- Submission shows a loading state, then transitions the page to a confirmation state ("Thanks — we'll be in touch by email if you're selected.") with no further action available. The form is replaced, not just hidden, to prevent double submits.
- If the email has already applied, the confirmation state reads: "You've already applied — we'll be in touch by email if you're selected." This avoids creating duplicate applications and avoids leaking whether the email exists.
- Basic abuse protections:
  - Honeypot field (hidden from real users) — submissions that fill it are silently accepted and discarded.
  - Per-IP rate limit (e.g. 5 submissions per hour) — surface a generic "Please try again later" on the rate-limit response.
- The form is always accepting new applications regardless of how many have already been approved.

### 4.3 Decision

Once submitted, the application sits in a queue for admins to review.

- If **approved**, the system sends an invite email (Section 4.4).
- If **denied**, no email is sent. The applicant simply never hears back.

The applicant has no way to check status on the public site.

### 4.4 Approval invite email

Sent automatically the moment an admin approves an application.

- **From:** Oikos team address.
- **Subject:** Welcoming, e.g. "You're in — welcome to the Oikos closed beta".
- **Body:** Thanks them by first name, confirms acceptance, explains the next step (click the link to create their account), and includes a single primary CTA button: **Create your account**.
- **CTA link format:** `https://<app-domain>/register?invite=<token>` (locale prefix added per app conventions).
- **Token properties:**
  - Single-use (consumed when registration completes).
  - Bound to the applicant's email (registration must use that email; field is pre-filled and locked).
  - 30-day validity. After expiry, clicking the link shows "This invite has expired — please contact the Oikos team."
  - If an admin resends the invite, the old token is invalidated and a fresh one is issued.

### 4.5 Registration via invite

The existing `/register` page is extended to accept the `?invite=<token>` query param.

- On load, the page validates the token via the API.
- Valid token: email field is pre-filled with the applicant's email and rendered read-only; the page shows a small "Closed beta invite" badge above the form. First/last name are also pre-filled (but editable) from the application.
- Invalid/expired/used token: the page shows an error state ("This invite link is no longer valid") and disables the form. No fallback to ordinary registration.
- No-token visit: the existing public-registration behavior is unchanged. (Whether ordinary registration is open or closed during the beta period is a marketing decision out of scope for this spec — the page continues to work either way.)
- On successful registration the token is consumed; the user is logged in and dropped into the existing onboarding flow (`/onboarding/family` → children → coat of arms). No new onboarding steps.
- The link between the beta application and the resulting user account is persisted so the future billing system can grant the 6-month benefit.

## 5. Cap behavior

- The 50-family limit is a **soft cap**.
- The application form on `/beta` is always open; the public never sees a "beta full" message.
- The admin approval UI shows the current count of approved applications out of 50.
- When the count is already at or above 50, attempting to approve another application surfaces a warning banner ("You're approving beyond the 50-family target — continue?") and a confirm step. The override is logged in the audit trail.

## 6. Admin surface (minimum viable shell)

This spec creates the `apps/admin` Next.js app in the monorepo and gives it just enough to review beta applications. The rest of the admin center is built in the follow-on spec.

### 6.1 App and deployment shape

- New app at `apps/admin` alongside `apps/web` and `apps/api`.
- Reuses `@oikos/ui`, `@oikos/types`, `@oikos/config`.
- Talks to the same FastAPI backend at `apps/api`.
- Served from a dedicated subdomain (e.g. `admin.<domain>`). Configured separately from the main web app.
- English-only. No `[locale]` segment in routes.

### 6.2 Admin access control

- A list of admin emails (the "admin allowlist") determines who can sign into the admin app.
- The allowlist is composed of two parts:
  1. **Bootstrap list from environment variable** (e.g. `OIKOS_ADMIN_EMAILS`, comma-separated). Always honored. Ensures the system is never locked out — change the env var and redeploy to add a new admin if needed.
  2. **Database-backed allowlist** for emails added at runtime. In this spec the DB allowlist is read-only from the admin UI (no UI to add/remove yet — that comes in the follow-on spec). Initial population is empty; the env var is sufficient for launch.
- An admin must have a regular Oikos user account with the same email. The admin login form reuses email + password, but only emails present in the combined allowlist are permitted to authenticate against the admin app.
- A non-allowlisted user attempting to log into the admin app sees "Access denied" — no distinction between "wrong password" and "not an admin", to avoid leaking the allowlist.
- Admin sessions use a **separate cookie** (e.g. `admin_access_token`) distinct from the main app's `access_token`, so an admin can hold both sessions independently.
- Admin sessions are short-lived (default 4 hours) and require re-auth on expiry.

### 6.3 Admin app navigation (this spec)

The admin app has a left sidebar. In this spec, only one entry is functional:

- **Beta applications** — the screen described below.

A placeholder for future tabs (Overview, Families, Moderation, Audit log, Admins) may render in the nav as "Coming soon" or be hidden entirely; either is fine, the choice is the implementer's. The follow-on spec turns these on.

### 6.4 Beta applications screen

Default landing page after admin login.

#### List view

- A table of applications with filters:
  - **Status filter:** Pending / Approved / Denied / All. Default: Pending.
  - **Search box:** free-text matching name or email (case-insensitive, substring).
  - **Sort:** by applied-at descending by default. Sortable by status.
- Columns: Applied at (relative time + tooltip with absolute), Name, Email, Reason (truncated to ~80 chars with ellipsis), Status badge.
- A persistent header banner shows: "Approved families: X / 50" with a small progress bar.
- Row click opens a side drawer or detail panel with the full application.

#### Detail panel

- Full applicant info: name, email, applied-at, full reason text.
- Current status badge.
- For approved applications, an "invite status" block: "Invite sent at <time>", followed by one of:
  - **Pending registration** (token still valid, not yet used)
  - **Registered at <time>** (token consumed)
  - **Expired at <time>** (token past its 30-day window)
- Internal notes field (free text, visible only inside the admin app, editable by any admin). Saved on blur.
- Action buttons depending on status:
  - **Pending:** [Approve] [Deny]
  - **Denied:** [Re-open] (moves it back to Pending so it can be approved later)
  - **Approved:** [Resend invite] (only enabled when invite is in Pending registration or Expired states; not when already Registered)

#### Actions

- **Approve**
  - Confirm dialog: "Approve <name> for the closed beta? An invite email will be sent immediately. This action cannot be undone."
  - If approving would push count above 50: yellow warning banner in the dialog, "This will exceed the 50-family beta cap" — still allows confirm.
  - On confirm: status → Approved, invite token generated, invite email queued, audit-log entry written (action: `beta.approve`; if over cap, action: `beta.approve_over_cap`).
- **Deny**
  - Confirm dialog: "Deny <name>'s application? No email will be sent."
  - Optional internal note field in the dialog.
  - On confirm: status → Denied, audit-log entry written (action: `beta.deny`).
- **Re-open**
  - Confirm dialog: "Move <name>'s application back to Pending?"
  - On confirm: status → Pending, audit-log entry written (action: `beta.reopen`).
- **Resend invite**
  - Confirm dialog: "Send a fresh invite link to <email>? The previous link will stop working."
  - On confirm: old token invalidated, new token generated, fresh email queued, audit-log entry written (action: `beta.resend_invite`).

#### Reversibility summary

- Approvals are **final from the UI**. Once approved, only DB intervention can undo (intentional).
- Denials are **reversible** via Re-open.
- Resends are unlimited and always allowed for non-registered approved applications.

## 7. Audit log (storage only, viewer in follow-on)

This spec creates the audit-log data store and writes entries for every beta-related admin action. The UI for browsing the log lives in the follow-on spec.

Each entry captures:

- Timestamp
- Admin email (the actor)
- Action type (`beta.approve`, `beta.approve_over_cap`, `beta.deny`, `beta.reopen`, `beta.resend_invite`, `admin.login`, `admin.login_denied`)
- Target identifier (application ID and/or applicant email)
- Reason or note text, if any
- A JSON snapshot of relevant state at the time

Entries are append-only — there is no UI or API to edit or delete them.

## 8. Data the system needs to track

Conceptual model only — schema choices belong to the implementer.

- **Beta application**: identity (first name, last name, email), reason text, status (`pending` / `approved` / `denied`), timestamps for each status transition, internal note text, the admin who made each decision, the invite token + its expiry and consumed state, link to the resulting user account once registration completes.
- **Admin allowlist (DB-backed)**: list of admin emails with metadata (added-by, added-at). Read-only from the admin UI in this spec.
- **Audit log**: entries as described in Section 7.
- **Email blacklist** is _not_ created in this spec — it belongs to the moderation work in the follow-on spec.

The 6-month-free benefit is implicit in: the beta application's approved-at timestamp + the link to the user account. Nothing further is recorded now.

## 9. Edge cases and error handling

- **Duplicate application:** if the same email re-submits the public form, no new row is created; the user sees the "you've already applied" confirmation. The original application's status is unchanged.
- **Email change after applying:** not supported in this spec. The applicant must use the email they applied with when registering.
- **Invite link clicked while logged in to a regular Oikos account:** the registration page logs out the current session, then proceeds with the invite registration flow. (The main app's session cookie is independent of the admin app's, so this only affects user sessions.)
- **Invite token used after expiry:** show the expired message; admin can resend from the admin app.
- **Two admins approve the same application simultaneously:** the second attempt sees an "already approved" error from the API and the UI refreshes the row. Idempotent: only one approval, one email.
- **Approved applicant never registers:** application stays in "Pending registration" indefinitely (token expires after 30 days, but the application remains approved). Admin can resend.
- **Admin email removed from the allowlist mid-session:** admin's next API call fails with 401; admin app redirects to login.

## 10. Success criteria

- A prospective family can apply from `/beta` and receive confirmation that the application was received.
- An admin on the allowlist can log into `admin.<domain>`, see the queue, approve an application, and confirm the applicant received a working invite link that takes them through registration and onboarding.
- Every beta decision (approve / deny / re-open / resend) creates an audit-log row.
- The system records the link between approved beta applications and resulting user accounts so the billing system can find them later.
- The application form survives basic abuse: honeypot catches bots, rate limit slows spammers, duplicate submissions don't create dupes.

## 11. Out of scope (handled in follow-on)

- Overview / stats dashboard
- Families list, search, and drill-down
- Account moderation (block / ban / remove)
- Email blacklist
- Audit log viewer UI
- Admin allowlist management UI
- Admin promotion/demotion flow
