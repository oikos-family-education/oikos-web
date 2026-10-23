# Oikos Desktop Installer — Design

**Date:** 2026-10-23
**Status:** Draft for approval

## Intent

Oikos was built to be hosted in the cloud. Hosting is paused for now. Instead, Oikos will be packaged as a desktop app for **Windows and macOS** and sent directly to a small group of families the author knows personally. One parent per family installs it on their own computer and is the only person who uses it.

This is a test version for friends, not a public release. The cloud plan is still alive, so **every existing feature stays in the codebase and the cloud deployment must keep working exactly as it does today**. The desktop build is the same app running in a different *mode*.

## Goals

1. A parent can download one installer file (`.exe` on Windows, `.dmg` on macOS), install it, and use Oikos with no Docker, no terminal, and no internet connection.
2. One codebase, two modes: `cloud` (today's behavior, the default) and `desktop`. Every desktop difference is gated on that mode.
3. Features that need other families or a server (see "Cloud-only features") stay **visible** in the desktop app. Clicking them opens a friendly popup saying they are only available in the online version of Oikos.
4. A family's data is never lost to an update or a bad restore.
5. In **both** versions, a parent can save a backup of their data from Settings. Only the desktop version can **restore** a backup, from the welcome page. It accepts backups saved by either version, so a family can bring their cloud data onto a computer.
6. A parent who forgets their password can get back in without email.

## Non-goals

- Code signing or notarization on either OS. Families click past the one-time OS warning (see "Install guide").
- Auto-updates. A new version means the author sends a new installer.
- Moving desktop data into the future cloud version. Families start fresh in the cloud.
- Multiple users per computer, accounts for children, or sync between computers.
- Encrypting data at rest or strong local security. This is a test version on the family's own computer.
- Linux, Windows on ARM.
- Any new product feature beyond backup/restore and local password recovery.

## Anti-goals (a failure even if it technically works)

- Any change in behavior in `cloud` mode.
- Deleting or forking cloud-only feature code.
- A family losing data because of an update, a restore, or a crash during either.
- A desktop app that only works if the parent opens a terminal (beyond the one documented macOS fallback).

## Constraints

- PostgreSQL stays the database. The models use Postgres-only column types (`ARRAY` ×21, `JSONB` ×8, `UUID`) and 13 of the 30 migrations run raw SQL, so switching to SQLite is out of scope.
- Monorepo conventions in `CLAUDE.md` and `.claude/rules/*` apply: i18n for every visible string (`en.json` and `pt-BR.json`), `@oikos/ui` components, layered API structure.
- Builds are unsigned. On Apple Silicon every binary still needs an ad-hoc signature, which electron-builder and PyInstaller apply by default. Confirm this for the bundled Postgres binaries too.

## Prerequisite (decided by the author)

The in-progress work on `fix/coat-of-arms-refresh-issue-34` must be **merged to `main` before any desktop work starts**. That covers subject archiving, parent profiles with subject responsibility, child highlights and child reports, including their three new migrations:
- `a6q0b2d4h6i8_add_archived_at_to_subjects`
- `b7r1c3e5i7j9_add_parent_profiles_and_subject_responsible`
- `c8s2d4f6j8k0_add_child_highlights`

The desktop work then branches from `main`.

**Why:** once an installer ships, every migration revision it contains is permanent. Families' databases and `.oikos` backups are tied to those revision IDs, so migrations already in a shipped installer must never be renamed, squashed or re-parented.

**Rule from the first installer on:** schema changes only ever arrive as new migrations on top of the existing ones.

---

## Architecture

```
Oikos.app / Oikos.exe  (Electron)
 ├─ main process
 │   ├─ starts PostgreSQL 16   (bundled binaries, data in the user-data folder)
 │   ├─ runs migrations + seeds
 │   ├─ starts the API         (PyInstaller build of apps/api, uvicorn on 127.0.0.1)
 │   ├─ starts the web server  (Next.js standalone server.js, run with Electron's Node)
 │   ├─ writes pre-migration safety copies (pg_dump)
 │   ├─ shows the native Save dialog for downloads (backup files)
 │   └─ shuts everything down cleanly on quit
 └─ BrowserWindow → http://127.0.0.1:<web port>
```

### New workspace: `apps/desktop`

An Electron app built with **electron-builder**:
- Windows: NSIS installer, x64.
- macOS: DMG, built separately for arm64 and x64.

**Splash and errors.** While the services start, a small window shows a loading screen. If anything fails to start, it shows an error screen with "Open log folder" and "Quit" buttons. Logs go to `<userData>/logs/`.

**Single instance.** The app takes Electron's single-instance lock. Launching it a second time focuses the existing window instead.

**User-data folder.** This is Electron's `app.getPath('userData')`. It holds:
- `config.json`: generated on first run. Contains `jwtSecret`, the Postgres password, and `lastRunVersion`.
- `pgdata/`: the database files.
- `sessions.db`: persisted logins (see "Redis → local store").
- `backups/`: automatic safety copies.
- `logs/`

**Ports.** The builder's call. Fixed, uncommon ports are acceptable. Next.js bakes `rewrites()` destinations at build time, so the web→API port must be known when the web app is built, or the web server needs another way to find it. If a fixed port is busy, show a clear error.

**Where the files come from.** The installer bundles three things:
- Portable PostgreSQL 16 binaries per platform. The `embedded-postgres` npm packages are the suggested source. **Verify that they include `pg_dump`** (needed for pre-migration safety copies; `pg_restore` is nice to have for manual recovery). If they don't, take the binary from the official PostgreSQL builds for the same major version.
- The API, built with PyInstaller in **onedir** mode (not onefile, which antivirus tools flag more often).
- The Next.js standalone output and its static assets.

### Startup sequence (main process)

1. Read or create `config.json`.
2. If `pgdata/` doesn't exist: run `initdb`, then create the `oikos` role and database.
3. Start Postgres and wait until it accepts connections.
4. If `lastRunVersion` differs from the current app version and the database has any users, write an **automatic safety backup** (see "Automatic safety backups") before migrating.
5. Run the API launcher in "migrate" mode. It runs `scripts/check_db_state.py`, `alembic upgrade head`, and `python -m app.seeds.run_seeds`, which is the same chain as the `migrate` service in `docker-compose.yml`.
   - If this fails, show the error screen and tell the user where the safety backup is.
6. Start the API in "serve" mode on `127.0.0.1`.
7. Start the web server.
8. Once both answer their health checks, update `lastRunVersion`, close the splash, and open the main window at the welcome page (`/`).

On quit: stop the web server, stop the API, then stop Postgres with a fast, clean shutdown.

## Mode switch

| Layer | How mode is read | Default |
|---|---|---|
| API | `settings.APP_MODE: Literal["cloud", "desktop"]` in `app/core/config.py` | `cloud` |
| Web | `NEXT_PUBLIC_APP_MODE`, baked in at build time. The desktop build is its own build. | `cloud` |

Add a small helper on each side so mode checks read the same everywhere:
- API: `is_desktop()`.
- Web: `lib/appMode.ts` exporting `isDesktop`.

## Infrastructure changes

### Redis → local store in desktop mode
Redis is used in only one place, `app/services/auth_service.py`, for refresh-token storage and rate limiting.

- In desktop mode `redis_client` is replaced by a small local store that offers the subset of the `redis.asyncio` interface `auth_service` uses: `pipeline`, `setex`, `get`, `sadd`, `smembers`, `srem`, `delete`, `expire` and `incr`. Cloud keeps the real Redis.
- In desktop mode `REDIS_URL` is no longer required.
- **The login must survive an app restart (decided by the author).** Once logged in, the parent stays logged in when they quit and reopen Oikos, until they log out or the refresh token expires.
  - Refresh-token entries (`rt:*`, `rt_user:*`) must therefore persist on disk in the user-data folder, with their expiry times respected.
  - **My call:** use a small SQLite file (`<userData>/sessions.db`, via Python's built-in `sqlite3`) behind the adapter. It stays outside Postgres, so the cloud schema and migrations are untouched.
  - Rate-limit counters may live only in memory.
  - Electron must keep the auth cookies across restarts. Its default session persists cookies that have an expiry, so the builder must confirm `set_auth_cookies` sets `max_age`/`expires` on both cookies.
- After a restore, `sessions.db` is cleared, because the restored data may have different users.

### Email
Desktop mode sends no email. The only email sender is `beta_service`, and the beta router isn't mounted in desktop mode (see below). Today's `forgot_password` doesn't send email either.

### Next.js standalone build
Add `output: 'standalone'` **only when building for desktop**, e.g. through an env var. The cloud Docker build stays unchanged.

### API launcher
Add a small entry script (for example `apps/api/desktop_entry.py`) that PyInstaller builds. It has two modes:
- `migrate`: runs the startup migration chain.
- `serve`: runs uvicorn on the given host and port.

It reads its environment (`DATABASE_URL`, `DATABASE_SYNC_URL`, `JWT_SECRET_KEY`, `APP_MODE=desktop`) from what Electron passes in. **No `.env` file is shipped.**

## Cloud-only features

### Web: visible but gated

| Feature | Where it appears today | Desktop behavior |
|---|---|---|
| Messages | Sidebar `/messages`, unread badge (`/api/v1/messages/unread-count`) | Clicking the nav item opens the cloud-only popup. No unread-count request. |
| Discover | Sidebar `/discover`, `/discover/[familySlug]` | Popup |
| Community and meetups | Sidebar `/community`, admin-pending badge (`/api/v1/communities/admin-pending-count`) | Popup. No badge request. |
| Notifications | `NotificationBell` in `TopBar` | The bell stays visible. Clicking it opens the popup. No polling. |
| Dashboard communities widget | `DashboardCommunities` | Replaced by a small static card saying communities are available online. No request. |
| Family member invitations | `MembersTab`: invite, resend, revoke | The invite button opens the popup. Adding non-login parent profiles keeps working. |
| Beta program | Landing page link to `/beta`, `/beta` page | The link opens the popup. A direct visit to `/beta` shows the cloud-only page state. |
| Email notification preferences | `NotificationPreferencesSection` in Settings | **My call:** the builder checks whether this section only controls cloud notifications. If it does, it is shown disabled with a one-line "online version only" note. |
| Family directory visibility | Onboarding `WizardStep3`, `PrivacyTab` | **My call:** the onboarding step hides the choice, using the existing `hideVisibility` prop. `PrivacyTab` shows the visibility control disabled with the "online version only" note. The stored value stays at its default. |
| Assistant | Already a "soon" placeholder | Unchanged |

**Shared pieces (web):**
- **`CloudOnlyDialog`** in `components/desktop/`: the popup. It has an icon, a title, one sentence, and an OK button, and uses a new `Desktop` i18n namespace.
- **Intercepting clicks.** A hook or wrapper lets nav items and buttons open the dialog instead of navigating or acting.
- **Typed URLs.** If someone types a cloud-only route into the address bar, the page renders a full-page version of the same message. A shared guard component used by those routes' layouts or pages handles this.

### API: unmounted in desktop mode

The following routers are not included in `app/main.py` in desktop mode:
- `communities`, `meetups`, `notifications`, `messages`
- `beta`, `admin`
- `invitations`

The invite, resend and revoke endpoints in `families.py` return 404 in desktop mode. Everything else in `families.py` is unchanged.

Before unmounting anything, the builder must check that no remaining endpoint *depends* on these routers. Services may still be imported internally; only the HTTP surface goes away.

Cloud mode mounts everything as today.

## Desktop-only features

### 1. Local password recovery
- **Web.** In desktop mode, `/forgot-password` shows a different form: email, new password, and confirm password. Validation is the same as registration (minimum 10 characters, zod, `onBlur`, required-field asterisks). The "Forgot password?" link on the login page stays where it is.
- **API.** `POST /api/v1/auth/local-reset-password`, mounted only in desktop mode, takes `{email, new_password}`:
  - If the email exists: set the new password, clear the lockout fields, revoke refresh tokens, set the auth cookies, and log the user in. This mirrors `reset_password`.
  - If the email isn't found: return 404 with the code `account_not_found`. Hiding which emails exist isn't needed on a local single-user install.
  - Keep the existing per-IP rate limit.
- **Desktop mode only.** `/forgot-password` and `/reset-password` keep the token flow in cloud mode.
- No stronger check than knowing the email. This was explicitly accepted as a test version.

### 2. Restore from a backup (welcome page)
- In desktop mode, the welcome page (`app/[locale]/page.tsx`) shows a "Restore from backup" button next to the login and register actions.
- **Picking the file:** the parent chooses the backup with a normal file picker (an HTML file input works in Electron). No preload bridge is needed.
- **Confirming:** before anything happens, a confirmation step warns: "This replaces everything currently in Oikos on this computer."
- **Uploading:** on confirm, the page uploads the file to `POST /api/v1/desktop/restore`.
  - The endpoint is mounted **only in desktop mode** and needs no login: restoring happens before anyone is logged in, and low local security was explicitly accepted.
  - The API then:
    1. Validates the zip and its `manifest.json`. It refuses a file that isn't an Oikos backup, or one whose `format` or `alembicRevision` this app doesn't know (meaning a newer Oikos made it), with a clear message such as "This backup was made by a newer version of Oikos. Please install the latest version first."
    2. Writes a safety copy of the current data to `<userData>/backups/` before touching anything, in the same backup format, produced by the same exporter.
    3. In **one database transaction**: deletes all family and user data (platform seed rows and `alembic_version` are kept), then imports the backup. If anything fails, the transaction rolls back and nothing has changed.
    4. Clears `sessions.db`.
    5. Returns the email addresses of the imported login accounts.
- **Afterwards:** the page goes straight to a **"Set your password"** screen with the email filled in. It reuses the desktop password-recovery form and endpoint, because backups never contain passwords (see below). The parent picks a password and is logged in.
- Restore **replaces** all data. There is no merge.
- **Where the backup comes from doesn't matter:** a backup downloaded from the cloud version restores the same way as one saved on a desktop.

## Save a backup (both versions)

**Decided by the author:** the cloud version can save a backup, and the **desktop app must be able to import it**. Restoring stays desktop-only.

**My call: one backup format everywhere.** The desktop "Save backup" produces exactly the same file as the cloud version, so there is one exporter (API) and one importer (API, desktop-only), and a parent never has to know which kind of file they hold. Internal pre-migration safety copies are the only exception (see "Automatic safety backups").

### The button
- A new **"Backup"** section on the Settings page (`SettingsPageClient`), the same in **both modes**, with one "Save backup" button.
- It downloads the file from the export endpoint:
  - in a browser, it is a normal download;
  - in Electron, the window's download handler shows the native Save dialog.
- **The existing stub to replace:** `POST /api/v1/families/me/export` in `app/routers/families.py` is a "v1 stub" that returns `{status: "pending", url: null}`. The builder replaces it with a real, synchronous download. Route shape and the response schema are the builder's call.
- The usual rules apply: authenticated, cookie-based, and rate-limited as the builder sees fit.

### The file
- **Name:** `Oikos-backup-<family-slug>-YYYY-MM-DD.oikos`
- **Contents:** a zip with
  - `manifest.json`: `{ format: 1, kind: "family-backup", appVersion, alembicRevision, createdAt, familyId }`
  - one JSON file per table, with rows written as column-name → value.

### What's included
- Everything the logged-in user's family owns: the family profile, members and parent profiles, children (including highlights), subjects, curriculums, week planner, calendar, projects, lessons and teaching logs, notes, progress, resources and child reports.
- The family's **user accounts** (name, email, preferences, and so on), but **never password hashes** or reset tokens. After a restore, the parent sets a password (see the restore flow above).
- **Platform subjects and curriculum templates** are seeded with random IDs, so they differ between installs. Backups refer to them **by slug**, and the importer maps each slug to the local ID.
- **Content from other families that this family uses**, such as another family's public subject or resource. **My call:** it is copied into the backup and imported as owned by the importing family, so nothing that depends on it is lost. The builder first checks whether such cross-family references can actually exist.

### What's excluded
- Other families' data, beyond the referenced content above.
- Community content and messages, which belong to more than one family and are cloud-only anyway.
- Notifications, invitations, moderation, audit, admin and beta data.

### Keeping it complete
- The builder adds a test that fails when a model isn't classified as exported or explicitly excluded, so a future feature can't quietly drop out of backups.
- A round-trip test exports a fully populated family, imports it into an empty database, and compares the result.

### Versions
- The importer accepts backups whose `alembicRevision` this app knows: the same version or older. Columns added since then take their model defaults.
- When a schema change can't be filled by defaults (a rename, a split table), the builder bumps `format` and adds a converter for the previous format, so older backups keep importing.
- Cloud usually runs a newer version than a family's desktop install. A cloud backup that is too new is refused with the "install the latest version" message, and the author sends a newer installer.

### Automatic safety backups (desktop only)
- **Before migrations on a version change:** Electron writes a `pg_dump` of the whole database to `<userData>/backups/auto-premigrate-<timestamp>.dump`. This can't use the exporter, because the new app's code doesn't match the old schema until the migrations have run. These files are for the author to recover from by hand.
- **Before every restore:** the API writes a normal `.oikos` backup (see the restore flow).
- Only the 5 most recent of each kind are kept. They are not shown in the UI. The error screen points to the folder if a migration fails.

## Builds and distribution

- **Build script** (root `package.json`, e.g. `npm run desktop:build`):
  1. builds the web app in standalone desktop mode;
  2. builds the API with PyInstaller;
  3. collects the Postgres binaries;
  4. runs electron-builder.
- Each OS must be built on that OS. **Suggested:** a manually triggered GitHub Actions workflow with a matrix of `windows-latest`, `macos-14` (arm64) and `macos-13` (x64). It uploads the installers as workflow artifacts. No release publishing.
- The installer version comes from `apps/desktop/package.json`.

## Install guide

`docs/desktop/install-guide.md`, written in English and Portuguese (pt-BR, which the app already supports). Short, with a placeholder for one screenshot per OS.

- **Windows:** "If you see 'Windows protected your PC', click **More info → Run anyway**."
- **macOS:**
  - Open the DMG and drag Oikos to Applications.
  - Open it. When macOS blocks it, go to **System Settings → Privacy & Security → Open Anyway**.
  - If macOS says the app "is damaged", run `xattr -cr /Applications/Oikos.app` in Terminal, or call the author.

## Testing

- **API (pytest):**
  - In desktop mode, cloud-only routers return 404 and `local-reset-password` works.
  - In cloud mode, `local-reset-password` doesn't exist and everything else is unchanged.
  - The backup export contains only the requesting family's data, refers to platform subjects by slug, and contains no password hashes or tokens.
  - The coverage test fails when a model is neither exported nor explicitly excluded.
  - Round trip: a fully populated family exported from one database and imported into an empty one comes back identical, with platform subjects remapped by slug.
  - Restore endpoint: it exists only in desktop mode; it refuses non-Oikos files and too-new backups; it writes a safety copy; and a failure partway through leaves the existing data untouched.
  - The auth flow works with the local store, and a refresh token stored before the store is reopened still validates afterwards (simulating an app restart).
- **Web (vitest):**
  - `CloudOnlyDialog` opens from the Sidebar items and the bell in desktop mode, and doesn't in cloud mode.
  - No cloud-only requests are made in desktop mode.
  - The Backup section renders in both modes.
  - The Restore button renders only in desktop mode, and leads to the "Set your password" screen after a successful restore.
  - The desktop forgot-password form validates and submits.
- **Desktop shell:** a manual smoke checklist per OS: install, first run, register, onboarding, add a child, quit and relaunch (still logged in), save a backup, restore it, restore a backup downloaded from the cloud version, install a newer build over it (safety backup made, data intact), and forgot password. Automated tests for the Electron main process are the builder's call.
- **Cloud regression:** the existing pytest and vitest suites pass unchanged in cloud mode.

## Left to the builder

- Exact ports and how the web server finds the API port.
- Which Postgres binary distribution to use, as long as it is PostgreSQL 16 and includes `pg_dump`.
- How the API learns the backups folder and `sessions.db` path (environment variables passed in by Electron are suggested).
- Internals of the local Redis-replacement adapter, within the constraints above.
- Splash and error screen styling (follow the design system).
- Exact copy for the new strings, in English and Portuguese.
- How cloud-only route guards are wired (layout vs. page).
- Whether Electron main-process logic gets unit tests.
