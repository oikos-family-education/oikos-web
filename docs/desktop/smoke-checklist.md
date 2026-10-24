# Desktop installer smoke checklist

Run this on every build before sending it to a family. Each row has a result column.

**How to read the results column**

- **pending (author to run)**: nobody has run this yet. Replace it with PASS, FAIL or a note, plus the date and build.
- **verified on unpacked Windows build** or **verified in Windows dev launch**: observed on the developer's Windows PC by launching the app folder (`release/win-unpacked/Oikos.exe`) or the app from source (`npm run dev` in `apps/desktop`). **The installer itself was not installed and run**, so the install steps are still pending.
- Pre-filled notes only repeat what the Task 11 and Task 12 reports recorded. Nothing else has been run: no installer was installed, nothing was pushed, the GitHub workflow has not run, and there was no Mac.

Build the pre-filled notes refer to: `0.1.0`. Fill in the build and date when you run each row.

## How to get the installers

1. Push the `feat/desktop-installer` branch to GitHub, and get the workflow file onto `main` first. GitHub lists a manual-only (`workflow_dispatch`) workflow in the Actions tab only once its file exists on the default branch (`main`). Either merge this branch, or merge just `.github/workflows/desktop-build.yml` in a small PR.
2. Open the repository's **Actions** tab, choose the **Desktop installers** workflow (`.github/workflows/desktop-build.yml`, the "desktop-build" workflow), click **Run workflow**, and pick `feat/desktop-installer` (or `main` after merging) in the branch picker. It only runs by hand and publishes nothing. Once the file is on `main`, the command line works too: `gh workflow run desktop-build.yml --ref feat/desktop-installer`.
3. Wait for the three jobs (`windows-x64`, `macos-arm64`, `macos-x64`) to finish. Each builds the API, the web server and the installer, so allow some time.
4. Open the finished run and download the artifacts from the **Artifacts** section. They are kept for 14 days.

| Artifact | Contains | For |
|---|---|---|
| `oikos-windows-x64` | `Oikos Setup <version>.exe` | Windows 10/11, 64-bit |
| `oikos-macos-arm64` | `Oikos-<version>-arm64.dmg` | Apple Silicon Macs (M1 and later) |
| `oikos-macos-x64` | `Oikos-<version>-x64.dmg` | Intel Macs |

GitHub zips each artifact, so unzip it to get the `.exe` or `.dmg`. A local Windows build (`npm run desktop:build` from the repo root) puts the installer in `apps/desktop/release/`. On the developer's PC that build stops before producing the `.exe`, because Smart App Control blocks the unsigned uninstaller stub it runs (see Windows row 13).

## Checklist

Test on a fresh Windows user or VM when you can, and on a Mac of each chip type if you have both. Rows 1 to 12 come from the task brief. Rows marked "Extra" were added later.

### Windows

| # | Step | Result |
|---|---|---|
| 1 | Install, then first run. SmartScreen shows "Windows protected your PC"; **More info → Run anyway** installs it. The loading screen appears, then the welcome page with "Restore from backup". | Installer: pending (author to run). First launch of the app folder, verified on unpacked Windows build: splash ("Starting Oikos...") first, then the welcome page at `http://localhost:47321/` with "Restore from backup"; migrations ran with exit code 0. |
| 2 | Register and complete onboarding (no visibility question). | Register, family (3 steps), children and coat of arms, then the dashboard: verified in Windows dev launch (not the unpacked build). That there is no visibility question was not recorded: pending (author to check). Installed build: pending (author to run). |
| 3 | Add a child. | A child ("Maria", nickname "Mari") was added during onboarding: verified in Windows dev launch. Adding one from the dashboard afterwards, and the installed build: pending (author to run). |
| 4 | Click Messages, Discover, Communities, the bell and Invite. Each shows the popup. | pending (author to run) |
| 5 | Quit and relaunch: still logged in. | Closed the main window and relaunched: `/api/v1/auth/me` returned 200 and `/dashboard` stayed open, verified in Windows dev launch. The unpacked build quit cleanly (no Oikos, API or Postgres processes left, no `postmaster.pid` or `api.pid`), verified on unpacked Windows build, but no login was made on it. Login check on the unpacked and installed builds: pending (author to run). |
| 6 | Save a backup from Settings: the Save dialog opens and the file is written. | Settings → Save backup opened the native Save dialog (title "Save backup", folder Documents, type "Oikos backup", a suggested name like `Oikos-backup-<name>-<date>`), and a valid 4,812-byte `.oikos` zip was written, verified in Windows dev launch. The test automation typed into the wrong field, so the file landed in Documents. Unpacked and installed builds: pending (author to run). |
| 7 | Restore it from the welcome page: the set-password screen appears and the data is intact. | Signed out, then "Restore from backup" on the welcome page with the saved file: the confirmation modal was fully visible, `POST /api/v1/desktop/restore` returned 200, the "Backup restored — set your password" form appeared with the email prefilled, and a new password logged in to the dashboard, verified in Windows dev launch. Checking that all the data (family, child) is intact was not recorded: pending (author to check). Installed build: pending (author to run). |
| 8 | Restore a backup downloaded from the cloud version (a local docker stack in cloud mode). | pending (author to run) |
| 9 | Forgot password: set a new one. | "Forgot your password?" on `/login` opened the desktop form "Set a new password" (email, new password, confirm, "Save and log in"), verified in Windows dev launch. Submitting that form was not recorded (the set-password step after a restore, row 7, did work): pending (author to run). |
| 10 | Kill the app from Task Manager, then relaunch: it starts normally. | Force-ending the Electron main process (`taskkill /f`) took the API and Postgres down with it. The relaunch started normally, Postgres recovered ("automatic recovery in progress ... ready to accept connections") and `/health` returned ok, verified in Windows dev launch. Task Manager on the installed build: pending (author to run). |
| 11 | Install a newer build over the old one: an `auto-premigrate-*.dump` appears in the backups folder and the data is intact. | pending (author to run). Not observed yet: in the dev launch the safety copy failed because `pg_dump` was missing (since fixed by bundling it). The bundled `pg_dump.exe --version` printed `pg_dump (PostgreSQL) 16.14` on the unpacked build, but no real dump was written there. |
| 12 | Use a Windows account whose user name has a space or an accent (for example `João Silva`). | pending (author to run). See the note below the table: only temp folders were exercised, not a real Windows account. |
| 13 | Extra: a PC with Smart App Control on. | pending (author to run). Expected: Windows blocks the installer with no "Run anyway" option, and the family contacts the author (see the install guide). Do not tell families to turn Smart App Control off. For context: Smart App Control is on on the developer's PC and blocked electron-builder from running the unsigned NSIS uninstaller stub, so the local `.exe` could not be finished. That was a build-time block, not a test on a family PC. |

Note on row 12: the accent and space case was exercised only through temp folders (for example `Oikos João Silva ...`, `dev João` and `unpacked João`) used as the app's user data and for the real Postgres tests. It was not run under a real Windows account whose user name has an accent or a space, where the profile path comes from Windows itself.

### macOS (run on arm64 and x64 if possible)

Nothing in this section has been run. There was no Mac available. The macOS build, its ad-hoc signature and its bundled `pg_dump` libraries stay untested until the CI Mac jobs run and a DMG is opened on a real Mac.

| # | Step | arm64 result | x64 result |
|---|---|---|---|
| 1 | Install, then first run. Open the DMG, drag Oikos to Applications. Gatekeeper blocks the first launch; **System Settings → Privacy & Security → Open Anyway** opens it. If macOS says the app "is damaged", `xattr -cr /Applications/Oikos.app` fixes it. Loading screen, then the welcome page. | pending (author to run) | pending (author to run) |
| 2 | Register and complete onboarding (no visibility question). | pending (author to run) | pending (author to run) |
| 3 | Add a child. | pending (author to run) | pending (author to run) |
| 4 | Click Messages, Discover, Communities, the bell and Invite. Each shows the popup. | pending (author to run) | pending (author to run) |
| 5 | Quit and relaunch: still logged in. | pending (author to run) | pending (author to run) |
| 6 | Save a backup from Settings: the Save dialog opens and the file is written. | pending (author to run) | pending (author to run) |
| 7 | Restore it from the welcome page: the set-password screen appears and the data is intact. | pending (author to run) | pending (author to run) |
| 8 | Restore a backup downloaded from the cloud version (a local docker stack in cloud mode). | pending (author to run) | pending (author to run) |
| 9 | Forgot password: set a new one. | pending (author to run) | pending (author to run) |
| 10 | Force Quit the app, then relaunch: it starts normally. A Mac has no job object, so also check that no stale `postgres` or `oikos-api` is left over and the app still starts. | pending (author to run) | pending (author to run) |
| 11 | Install a newer build over the old one: an `auto-premigrate-*.dump` appears and the data is intact. This is also the first test of the bundled `pg_dump` and its libraries on a Mac. | pending (author to run) | pending (author to run) |
| 12 | Extra: user data is in `~/Library/Application Support/Oikos`. | pending (author to run) | pending (author to run) |

## Failures

Any failing row goes back to the task that owns it. Write the row number, OS, build and what you saw below.

| Date | Build | OS | Row | What happened |
|---|---|---|---|---|
| | | | | |
