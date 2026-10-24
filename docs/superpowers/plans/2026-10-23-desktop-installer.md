# Oikos Desktop Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship unsigned Windows and macOS installers that run the whole Oikos stack locally (`desktop` mode). Cloud-only features stay visible behind an "online version only" popup. Backups can be saved in both modes and restored on the desktop. Cloud behavior must not change.

**Architecture:**
- **One codebase, two modes.** The mode is set by `APP_MODE` (API) and `NEXT_PUBLIC_APP_MODE` (web), and defaults to `cloud`.
- **Desktop processes.** An Electron app in `apps/desktop` starts three things:
  - bundled PostgreSQL 16;
  - a PyInstaller build of the FastAPI app (onedir), whose `migrate` mode runs the migration chain and whose `serve` mode runs uvicorn;
  - the Next.js standalone server.
- **Fixed localhost ports** connect the three.
- **Backups.** A family-scoped JSON-in-zip format (`.oikos`), produced and consumed by the API.
- **Safety copies before upgrades.** Electron runs `pg_dump` before migrating.

**Tech Stack:**
- Existing: FastAPI, SQLAlchemy async, Alembic, Next.js 14, next-intl, vitest, pytest.
- New: Electron, electron-builder, `embedded-postgres`, PyInstaller, Python's built-in `sqlite3` and `zipfile`.

**Spec:** `docs/superpowers/specs/2026-10-23-desktop-installer-design.md` (read it alongside this plan).

## Global Constraints

- **Modes:** `cloud` or `desktop`.
  - API setting: `APP_MODE`, default `"cloud"`.
  - Web env var: `NEXT_PUBLIC_APP_MODE`. Any value other than `desktop` means cloud.
  - **Cloud behavior must be byte-for-byte unchanged.** The existing pytest and vitest suites must pass untouched.
- **Fixed desktop ports:** web `47321`, API `47322`, Postgres `47323`. All bound to `127.0.0.1`.
- **PostgreSQL:** major version 16.
  - `initdb` runs with `--encoding=UTF8 --locale=C`.
  - The database name and role are both `oikos`.
- **Backup file:**
  - Extension `.oikos`.
  - Name `Oikos-backup-<family_name_slug>-YYYY-MM-DD.oikos`.
  - Zip containing `manifest.json` = `{format: 1, kind: "family-backup", appVersion, alembicRevision, createdAt, familyId}`, plus one `<table>.json` per table.
- **Safety copies:** written to `<userData>/backups/`. Keep the 5 most recent **per kind**:
  - `auto-premigrate-<timestamp>.dump`
  - `auto-prerestore-<timestamp>.oikos`
- **Passwords:** minimum 10 characters, maximum 128. Backups never contain `hashed_password`, `password_reset_token` or `password_reset_token_expires_at`.
- **Cloud-only API routers** (not mounted in desktop mode): `communities`, `meetups`, `notifications`, `messages`, `beta`, `admin`, `invitations`. In desktop mode, the family invite, resend and revoke endpoints return 404.
- **Desktop-only API routes:** `POST /api/v1/auth/local-reset-password` and `POST /api/v1/desktop/restore`.
- **Every visible string** goes through next-intl, in both `apps/web/messages/en.json` and `apps/web/messages/pt-BR.json`. New strings go in a new `Desktop` namespace; the backup UI strings go in the existing `Settings` namespace.
- **Web conventions:**
  - Buttons use `<Button>` from `@oikos/ui`; icons come only from `lucide-react`.
  - Forms use react-hook-form + zod, with `mode: 'onBlur'`, schemas memoized with `useMemo`, and required fields marked with an asterisk.
  - Fetches use `credentials: 'include'` (via `apiFetch` where it applies).
- **Builds:** no code signing or notarization.
  - Windows: NSIS installer, x64.
  - macOS: DMG, built separately for arm64 and x64.
  - The API is built with PyInstaller in **onedir** mode.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Non-ASCII characters or spaces in the OS user folder** (e.g. `C:\Users\João Silva\AppData\Roaming\Oikos`). `initdb`, `pg_dump`, the API and the safety copies must all still work. Every child process gets its arguments as an array, never a shell string. Pinned by `paths with spaces and accents survive spawn` (Task 11).
2. **A port already in use.** If another Oikos instance or another app holds 47321, 47322 or 47323, the app must show the error screen naming the port, not hang on the splash. Pinned by `findBusyPorts reports an occupied port` (Task 11).
3. **The pre-migration safety copy fails** (disk full, or `pg_dump` missing). Migrations must **not** run, and the error screen must show. Pinned by `startup aborts before migrating when the safety copy fails` (Task 11).
4. **The app is force-quit, or the machine loses power, while Postgres is running.** The next launch must start Postgres normally despite a stale `postmaster.pid`. Pinned by the smoke checklist step "kill from Task Manager / Force Quit, relaunch" (Task 13).
5. **A restore fails halfway through.** For example, a corrupt `<table>.json` partway into the zip. The existing data must stay exactly as it was. Pinned by `test_restore_failure_leaves_data_untouched` (Task 5).

---

## Task 0: Prerequisite — in-progress work is on `main`

The design makes this a hard gate. Merging is the author's call: this task **verifies** the state and branches. It does not merge anything itself.

- [ ] **Step 1: Confirm the three migrations are on `main`**

Run: `git fetch origin && git ls-tree -r --name-only origin/main apps/api/alembic/versions | grep -E "a6q0b2d4h6i8|b7r1c3e5i7j9|c8s2d4f6j8k0"`
Expected: three lines. If any are missing, **stop** and ask the author to merge `fix/coat-of-arms-refresh-issue-34` first.

- [ ] **Step 2: Branch from `main`**

Run: `git checkout main && git pull && git checkout -b feat/desktop-installer`
Expected: `Switched to a new branch 'feat/desktop-installer'`

- [ ] **Step 3: Commit the spec and this plan**

```bash
git add docs/superpowers/specs/2026-10-23-desktop-installer-design.md docs/superpowers/plans/2026-10-23-desktop-installer.md
git commit -m "docs: desktop installer design and plan"
```

---

## Task 1: API mode switch and app factory

**Files:**
- Modify: `apps/api/app/core/config.py`
- Create: `apps/api/app/core/app_mode.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/app/routers/families.py`: invite, resend and revoke endpoints
- Modify: `apps/api/tests/conftest.py`: add fixtures
- Test: `apps/api/tests/test_app_mode.py`

**Interfaces:**
- **Produces, config:** new `Settings` fields:
  - `APP_MODE: Literal["cloud", "desktop"] = "cloud"`
  - `REDIS_URL: str = ""` (now optional)
  - `SESSIONS_DB_PATH: str = ""`
  - `BACKUP_DIR: str = ""`
  - `APP_VERSION: str = "0.0.0"`
- **Produces, `app_mode.py`:**
  - `is_desktop() -> bool`
  - `async def require_cloud_mode() -> None`: raises `HTTPException(404)` in desktop mode.
  - `async def require_desktop_mode() -> None`: raises `HTTPException(404)` in cloud mode.
- **Produces, `main.py`:**
  - `CLOUD_ONLY_ROUTERS: list[APIRouter]`
  - `DESKTOP_ONLY_ROUTERS: list[APIRouter]` (empty for now; Tasks 3 and 5 append to it)
  - `create_app() -> FastAPI`, which reads `settings.APP_MODE` when called
  - `app = create_app()`
- **Produces, `conftest.py` fixtures:**
  - `desktop_mode`: monkeypatches `settings.APP_MODE = "desktop"`.
  - `desktop_client`: an `AsyncClient` over `create_app()` built under `desktop_mode`.

- [ ] **Step 1: Write the failing tests**

```python
CLOUD_ONLY_TAGS = {"communities", "meetups", "messages", "notifications", "beta-public", "admin", "invitations"}

def _tags(application):
    return {t for r in application.routes for t in getattr(r, "tags", [])}

def test_cloud_app_mounts_everything():
    assert CLOUD_ONLY_TAGS <= _tags(create_app())

def test_desktop_app_has_no_cloud_only_routes(desktop_mode):
    assert not (CLOUD_ONLY_TAGS & _tags(create_app()))

async def test_desktop_core_routes_still_work(desktop_client):
    assert (await desktop_client.get("/health")).status_code == 200

async def test_family_invite_404_in_desktop(authed_with_family, desktop_mode):
    client, _, _ = authed_with_family
    res = await client.post("/api/v1/families/me/members/invite", json={"email": "x@example.com"})
    assert res.status_code == 404

async def test_family_invite_unchanged_in_cloud(authed_with_family):
    client, _, _ = authed_with_family
    res = await client.post("/api/v1/families/me/members/invite", json={"email": "x@example.com"})
    assert res.status_code != 404
```

- [ ] **Step 2: Run them and check they fail**

Run: `cd apps/api && pytest tests/test_app_mode.py -v`
Expected: FAIL (`create_app` does not exist yet).

- [ ] **Step 3: Implement**

Add the config fields and `app_mode.py`. Move router registration in `main.py` into `create_app()`:
- Middleware, the exception handler, `/health` and the E2E guard move inside the function unchanged.
- Cloud-only routers are included only when `not is_desktop()`.

Add `dependencies=[Depends(require_cloud_mode)]` to the three invite route decorators in `families.py`.

- [ ] **Step 4: Run the new tests and the full suite**

Run: `pytest tests/test_app_mode.py -v && pytest`
Expected: all PASS, including every pre-existing test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core apps/api/app/main.py apps/api/app/routers/families.py apps/api/tests
git commit -m "feat(api): APP_MODE switch with cloud-only routers unmounted in desktop mode"
```

---

## Task 2: Local session store (Redis replacement)

**Files:**
- Create: `apps/api/app/core/kv_store.py`
- Modify: `apps/api/app/services/auth_service.py:13`, the `redis_client = ...` line
- Test: `apps/api/tests/test_kv_store.py`

**Interfaces:**
- **Consumes:** `settings.SESSIONS_DB_PATH` and `is_desktop()` from Task 1.
- **Produces, `kv_store.py`:**
  - `class SqliteKVStore(path: str)`. Its async methods match the redis.asyncio subset that `auth_service` uses:
    - `get(key) -> str | None`
    - `setex(key, seconds, value)`
    - `incr(key) -> int`
    - `expire(key, seconds)`
    - `delete(*keys)`
    - `sadd(key, *members)`
    - `srem(key, *members)`
    - `smembers(key) -> set[str]`
  - `pipeline()` returns an object with the same methods (synchronous, queued) and `async execute()`.
  - `async clear()`
- **Produces, factory:** `make_kv_client()` returns `redis.from_url(settings.REDIS_URL, decode_responses=True)` in cloud mode and `SqliteKVStore(settings.SESSIONS_DB_PATH)` in desktop mode.
- **Produces, `auth_service`:**
  - `auth_service.redis_client = make_kv_client()`
  - `async def clear_all_sessions() -> None`: calls `redis_client.clear()` when `redis_client` is a `SqliteKVStore`, otherwise does nothing.
  - Task 5 calls `clear_all_sessions()`. The conftest `mock_rate_limit` fixture patches it to a no-op alongside the other token-store functions, because tests import the app in cloud mode with a real Redis client.

- [ ] **Step 1: Write the failing tests**

```python
async def test_setex_get_and_expiry(tmp_path, monkeypatch):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.setex("rt:a", 60, "user1")
    assert await store.get("rt:a") == "user1"
    monkeypatch.setattr(kv_store, "_now", lambda: time.time() + 61)
    assert await store.get("rt:a") is None

async def test_sets_and_pipeline(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    pipe = store.pipeline()
    pipe.sadd("rt_user:u", "h1", "h2"); pipe.srem("rt_user:u", "h1"); pipe.expire("rt_user:u", 60)
    await pipe.execute()
    assert await store.smembers("rt_user:u") == {"h2"}

async def test_incr_counts_from_one(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    assert await store.incr("ratelimit:x") == 1
    assert await store.incr("ratelimit:x") == 2

async def test_survives_reopen(tmp_path):
    path = str(tmp_path / "s.db")
    await SqliteKVStore(path).setex("rt:a", 3600, "user1")
    assert await SqliteKVStore(path).get("rt:a") == "user1"

async def test_clear(tmp_path):
    store = SqliteKVStore(str(tmp_path / "s.db"))
    await store.setex("rt:a", 60, "u"); await store.clear()
    assert await store.get("rt:a") is None

def test_factory_picks_store_by_mode(desktop_mode, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SESSIONS_DB_PATH", str(tmp_path / "s.db"))
    assert isinstance(make_kv_client(), SqliteKVStore)
```

- [ ] **Step 2: Run them and check they fail**

Run: `pytest tests/test_kv_store.py -v`
Expected: FAIL (`ModuleNotFoundError: app.core.kv_store`).

- [ ] **Step 3: Implement `SqliteKVStore`**

- Two tables:
  - `kv(key TEXT PRIMARY KEY, value TEXT, expires_at REAL NULL)`
  - `kv_set(key TEXT, member TEXT, PRIMARY KEY(key, member))`
- Set expiry is stored in `kv` under the key `"__set_ttl__:" + key`.
- Expired rows are treated as missing on read.
- Wrap blocking `sqlite3` calls in `asyncio.to_thread`.
- Read the current time through a module-level `_now()` so the tests can patch it.

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_kv_store.py -v && pytest tests/test_auth.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/kv_store.py apps/api/app/services/auth_service.py apps/api/tests/test_kv_store.py
git commit -m "feat(api): persistent sqlite session store for desktop mode"
```

---

## Task 3: Local password reset endpoint

**Files:**
- Create: `apps/api/app/routers/auth_local.py` (`APIRouter(prefix="/auth", tags=["auth-local"])`)
- Modify: `apps/api/app/schemas/auth.py`
- Modify: `apps/api/app/services/auth_service.py`
- Modify: `apps/api/app/main.py`: append to `DESKTOP_ONLY_ROUTERS`
- Test: `apps/api/tests/test_local_password_reset.py`

**Interfaces:**
- **Consumes:**
  - `set_auth_cookies(response, user_id) -> str` and `store_refresh_token` from `app/routers/auth.py`
  - `revoke_all_refresh_tokens` from `auth_service`
  - `desktop_client` (Task 1)
- **Produces:**
  - `LocalResetPasswordRequest(email: EmailStr, new_password: str[10..128], confirm_password: str)`, using the same match validator as `ResetPasswordRequest`.
  - `AuthService.local_reset_password(req) -> User`. It raises `HTTPException(404, {"detail": "No account with that email.", "code": "account_not_found"})` when the email isn't found.
  - `POST /api/v1/auth/local-reset-password`, returning `LoginResponse`.

- [ ] **Step 1: Write the failing tests**

```python
async def test_resets_and_logs_in(desktop_client, make_user):
    await make_user(email="ana@example.com")
    res = await desktop_client.post("/api/v1/auth/local-reset-password",
        json={"email": "ANA@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!"})
    assert res.status_code == 200
    assert "access_token" in res.cookies
    login = await desktop_client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "NewPassword1!"})
    assert login.status_code == 200

async def test_clears_lockout(desktop_client, make_user):
    await make_user(email="lock@example.com", failed_login_attempts=5, locked_until=datetime.now(timezone.utc) + timedelta(hours=1))
    res = await desktop_client.post("/api/v1/auth/local-reset-password",
        json={"email": "lock@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!"})
    assert res.status_code == 200

async def test_unknown_email_404(desktop_client):
    res = await desktop_client.post("/api/v1/auth/local-reset-password",
        json={"email": "nobody@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!"})
    assert res.status_code == 404 and res.json()["detail"]["code"] == "account_not_found"

async def test_short_or_mismatched_password_422(desktop_client, make_user):
    await make_user(email="b@example.com")
    for body in ({"new_password": "short", "confirm_password": "short"},
                 {"new_password": "NewPassword1!", "confirm_password": "Different1!!"}):
        res = await desktop_client.post("/api/v1/auth/local-reset-password", json={"email": "b@example.com", **body})
        assert res.status_code == 422

async def test_absent_in_cloud(client):
    res = await client.post("/api/v1/auth/local-reset-password",
        json={"email": "a@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!"})
    assert res.status_code in (404, 405)
```

- [ ] **Step 2: Run them and check they fail**

Run: `pytest tests/test_local_password_reset.py -v`
Expected: FAIL (404 for every call).

- [ ] **Step 3: Implement**

`local_reset_password` mirrors the field updates in `reset_password` (password hash, clearing the token fields, `failed_login_attempts = 0`, `locked_until = None`, revoking all refresh tokens). The router applies `check_rate_limit(f"ratelimit:localreset:{ip}", 5, 3600)`.

Extend the conftest `mock_rate_limit` fixture so it also patches `check_rate_limit` in `app.routers.auth_local`. Do the same later for `app.routers.families` (Task 4) and `app.routers.desktop` (Task 5), so tests never reach Redis.

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_local_password_reset.py tests/test_app_mode.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app apps/api/tests/test_local_password_reset.py
git commit -m "feat(api): desktop-only local password reset"
```

---

## Task 4: Backup export (both modes)

**Files:**
- Create: `apps/api/app/services/backup/__init__.py`
- Create: `apps/api/app/services/backup/registry.py`: classifies every table
- Create: `apps/api/app/services/backup/codec.py`: JSON encoding and decoding by column type
- Create: `apps/api/app/services/backup/exporter.py`
- Modify: `apps/api/app/routers/families.py:207-214`: replace the export stub
- Create: `apps/api/app/core/migrations.py`
- Test: `apps/api/tests/test_backup_export.py`

**Interfaces:**
- **Constants:** `FORMAT_VERSION = 1` and `BACKUP_KIND = "family-backup"`, in `backup/__init__.py`.
- **`registry.py`:**
  - `EXPORTED: list[TableRule]`, in insert order with parents first.
  - `TableRule(table: str, where_sql: str, drop_columns: frozenset[str] = frozenset())`. `where_sql` selects the family's rows using the bound parameter `:fid`.
  - `EXCLUDED: frozenset[str]`
- **`codec.py`:**
  - `encode_row(table: Table, row: Mapping) -> dict`
  - `decode_row(table: Table, data: dict) -> dict`
  - Values: UUID → str, date or datetime → ISO 8601, arrays and JSONB as-is.
- **`migrations.py`:**
  - `current_revision() -> str`: the head of the Alembic script directory.
  - `known_revisions() -> set[str]`
  - Both use `alembic.script.ScriptDirectory` with `settings.ALEMBIC_INI_PATH`, a new setting that defaults to the `alembic.ini` next to `apps/api/app`.
- **`exporter.py`:** `async def export_family_backup(db: AsyncSession, family_id: UUID) -> tuple[str, bytes]`, returning `(filename, zip_bytes)`.
- **Route:** `POST /api/v1/families/me/export` returns `application/zip` with `Content-Disposition: attachment; filename="Oikos-backup-<slug>-YYYY-MM-DD.oikos"`. It is rate-limited with `check_rate_limit(f"ratelimit:export:{user_id}", 10, 3600)`.

**Classification (pins the spec):**
- **`EXPORTED`, scoped by family:** `users` (the family's members' users plus `families.account_id`), `families`, `family_members`, `children`, `child_highlights`, `subjects` (family-owned, plus any referenced subject owned by another family, rewritten to `family_id = :fid`), `curriculums` (family-owned), `curriculum_subjects`, `child_curriculums`, `week_templates`, `routine_entries`, `calendar_events`, `projects`, `project_children`, `project_subjects`, `project_milestones`, `milestone_completions`, `project_resources`, `portfolio_entries`, `child_achievements`, `resources`, `subject_resources`, `lessons`, `lesson_blocks`, `teaching_logs`, `notes`.
- **`users.drop_columns`:** `hashed_password`, `password_reset_token`, `password_reset_token_expires_at`, `failed_login_attempts`, `locked_until`, `moderation_status`, `moderation_reason`, `moderation_set_by`, and any other `moderation_*` column.
- **`EXCLUDED`:** every `community_*`, `communities`, `notifications`, `message_*`, `messages`, `family_blocks`, `family_invitations`, `beta_applications`, `admin_allowlist`, `audit_log`, `email_blacklist`.
- **Platform references:**
  - Any value that points at a subject with `is_platform_subject = true` is written as `{"$platform_subject": "<slug>"}`. That covers `subject_id` columns, `curriculum_subjects.subject_id` and the elements of `subjects.prerequisite_subject_ids`.
  - Any value that points at a curriculum with `family_id IS NULL AND status = 'template'` is written as `{"$platform_curriculum": "<name>"}`.
  - Platform rows are never exported as rows.

- [ ] **Step 1: Write the failing tests**

```python
def test_every_table_is_classified():
    exported = {r.table for r in EXPORTED}
    assert exported.isdisjoint(EXCLUDED)
    assert set(Base.metadata.tables) == exported | EXCLUDED

async def test_export_contains_only_own_family(authed_with_family, make_user, make_child, db):
    client, user, family = authed_with_family
    await make_child(family.id, first_name="Mine")
    other = await _make_other_family(db, make_user)          # helper in the test file
    await make_child(other.id, first_name="Theirs")
    res = await client.post("/api/v1/families/me/export")
    assert res.status_code == 200 and res.headers["content-type"] == "application/zip"
    assert f'Oikos-backup-{family.family_name_slug}-' in res.headers["content-disposition"]
    z = zipfile.ZipFile(io.BytesIO(res.content))
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["format"] == 1 and manifest["kind"] == "family-backup" and manifest["familyId"] == str(family.id)
    names = [c["first_name"] for c in json.loads(z.read("children.json"))]
    assert names == ["Mine"]

async def test_export_has_no_secrets(authed_with_family):
    client, _, _ = authed_with_family
    z = zipfile.ZipFile(io.BytesIO((await client.post("/api/v1/families/me/export")).content))
    raw = b"".join(z.read(n) for n in z.namelist())
    for secret in (b"hashed_password", b"password_reset_token", b"$2b$"):
        assert secret not in raw

async def test_platform_subject_exported_by_slug(authed_with_family, make_subject, db):
    client, user, family = authed_with_family
    platform = await make_subject(None, slug="mathematics", is_platform_subject=True)
    await _make_lesson(db, family.id, platform.id)            # helper in the test file
    z = zipfile.ZipFile(io.BytesIO((await client.post("/api/v1/families/me/export")).content))
    lesson = json.loads(z.read("lessons.json"))[0]
    assert lesson["subject_id"] == {"$platform_subject": "mathematics"}
    assert all(s["id"] != str(platform.id) for s in json.loads(z.read("subjects.json")))
```

- [ ] **Step 2: Run them and check they fail**

Run: `pytest tests/test_backup_export.py -v`
Expected: FAIL (`ModuleNotFoundError: app.services.backup`).

- [ ] **Step 3: Implement**

Implement the registry, codec, migrations helper and exporter.
- The exporter runs each rule's `SELECT * FROM <table> WHERE <where_sql>` through `sqlalchemy.text`, encodes the rows, replaces platform references, and writes the zip.
- Before finishing the registry, the builder checks whether any family row can reference another family's subject or resource. `lesson_service` already rejects other families' subjects for lessons, so check the other `subject_id` and `resource_id` columns. Only add the "copy in referenced subjects" logic where such a reference can actually exist.

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_backup_export.py -v && pytest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app apps/api/tests/test_backup_export.py
git commit -m "feat(api): family backup export (.oikos) replacing the export stub"
```

---

## Task 5: Backup import and the desktop restore endpoint

**Files:**
- Create: `apps/api/app/services/backup/importer.py`
- Create: `apps/api/app/routers/desktop.py` (`APIRouter(prefix="/desktop", tags=["desktop"])`)
- Modify: `apps/api/app/main.py`: append to `DESKTOP_ONLY_ROUTERS`
- Test: `apps/api/tests/test_backup_restore.py`

**Interfaces:**
- **Consumes:** `EXPORTED`, `EXCLUDED`, `decode_row`, `known_revisions()` and `export_family_backup` (Task 4); `clear_all_sessions()` (Task 2); `settings.BACKUP_DIR` (Task 1).
- **Produces:**
  - `class BackupError(Exception)` with `code: Literal["not_a_backup", "backup_too_new"]`
  - `def read_backup(data: bytes) -> tuple[dict, dict[str, list[dict]]]`, returning `(manifest, tables)`. It raises `BackupError`:
    - `not_a_backup`: the file isn't a zip, `manifest.json` is missing, or `kind != "family-backup"`.
    - `backup_too_new`: `format > FORMAT_VERSION`, or `alembicRevision` isn't in `known_revisions()`.
  - `async def write_safety_copy(db) -> list[Path]`: exports every family to `BACKUP_DIR/auto-prerestore-<timestamp>.oikos` and prunes to 5.
  - `async def restore_backup(db, data: bytes) -> list[str]`, returning the emails of the imported users.
  - `POST /api/v1/desktop/restore`:
    - Takes a multipart `file`, needs no login, and returns `{"emails": [...]}`.
    - Maps `BackupError` to `400 {"detail": ..., "code": <code>}`.
    - Rate-limited with `check_rate_limit(f"ratelimit:restore:{ip}", 10, 3600)`.

**Restore algorithm (pins the spec):**
1. `read_backup`.
2. `write_safety_copy`.
3. In a **single transaction**:
   - Delete every row of every `EXPORTED` and `EXCLUDED` table, except platform rows: subjects with `is_platform_subject`, curriculums with `family_id IS NULL AND status = 'template'`, and those templates' `curriculum_subjects`. Delete children first, in the reverse of `EXPORTED` order.
   - Resolve `$platform_subject` by slug and `$platform_curriculum` by name against the local seed rows. An unresolved reference raises and rolls back.
   - Insert the tables in `EXPORTED` order with `decode_row`. Keys missing from older backups fall back to the column defaults.
   - Set each user's `hashed_password` to `get_password_hash(secrets.token_urlsafe(32))`.
4. After the commit, `await clear_all_sessions()`.

**Host allowlist (ruling R5, from a security review of Task 3):** in desktop mode, `create_app()` adds Starlette's `TrustedHostMiddleware` with `allowed_hosts=["127.0.0.1", "localhost"]`. This rejects DNS-rebinding requests to the unauthenticated desktop endpoints. Test: in desktop mode, a request with `Host: evil.example` gets a 400; cloud mode is unaffected.

- [ ] **Step 1: Write the failing tests**

```python
async def test_round_trip_restores_identically(authed_with_family, desktop_client, db, populate_family):
    client, user, family = authed_with_family
    await populate_family(family.id)          # fixture in this file: ≥1 row in every EXPORTED table, uses a platform subject
    before = await snapshot_family(db, family.id)
    data = (await client.post("/api/v1/families/me/export")).content
    await wipe_all_user_data(db)
    res = await desktop_client.post("/api/v1/desktop/restore", files={"file": ("b.oikos", data)})
    assert res.status_code == 200 and res.json()["emails"] == [user.email]
    assert await snapshot_family(db, family.id) == before   # snapshot excludes hashed_password

async def test_restore_remaps_platform_subject_by_slug(...):
    # export references slug "mathematics"; reseed the platform subject with a NEW id before restore;
    # assert the restored lesson.subject_id equals the new id

async def test_rejects_non_backup(desktop_client):
    res = await desktop_client.post("/api/v1/desktop/restore", files={"file": ("x.oikos", b"not a zip")})
    assert res.status_code == 400 and res.json()["detail"]["code"] == "not_a_backup"

async def test_rejects_too_new(desktop_client, valid_backup_bytes):
    data = rewrite_manifest(valid_backup_bytes, alembicRevision="ffffffffffff")
    res = await desktop_client.post("/api/v1/desktop/restore", files={"file": ("b.oikos", data)})
    assert res.json()["detail"]["code"] == "backup_too_new"

async def test_restore_failure_leaves_data_untouched(desktop_client, valid_backup_bytes, authed_with_family, db):
    _, _, family = authed_with_family
    before = await snapshot_family(db, family.id)
    data = corrupt_table(valid_backup_bytes, "notes.json")   # malformed row midway through insert order
    res = await desktop_client.post("/api/v1/desktop/restore", files={"file": ("b.oikos", data)})
    assert res.status_code >= 400
    assert await snapshot_family(db, family.id) == before

async def test_writes_safety_copy(desktop_client, valid_backup_bytes, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "BACKUP_DIR", str(tmp_path))
    await desktop_client.post("/api/v1/desktop/restore", files={"file": ("b.oikos", valid_backup_bytes)})
    assert len(list(tmp_path.glob("auto-prerestore-*.oikos"))) >= 1

async def test_restored_user_must_set_password(desktop_client, valid_backup_bytes, user_email_in_backup):
    await desktop_client.post("/api/v1/desktop/restore", files={"file": ("b.oikos", valid_backup_bytes)})
    res = await desktop_client.post("/api/v1/auth/login", json={"email": user_email_in_backup, "password": "Password123!"})
    assert res.status_code == 401

async def test_restore_absent_in_cloud(client):
    res = await client.post("/api/v1/desktop/restore", files={"file": ("b.oikos", b"x")})
    assert res.status_code == 404
```

The helpers `snapshot_family`, `wipe_all_user_data`, `rewrite_manifest`, `corrupt_table` and the fixtures `populate_family`, `valid_backup_bytes` and `user_email_in_backup` live in this test file. `populate_family` must insert at least one row into every `EXPORTED` table. Assert that inside the fixture, so the round trip covers future tables too.

- [ ] **Step 2: Run them and check they fail**

Run: `pytest tests/test_backup_restore.py -v`
Expected: FAIL (route not found / import error).

- [ ] **Step 3: Implement the importer and router as specified above.**

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_backup_restore.py tests/test_backup_export.py -v && pytest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app apps/api/tests/test_backup_restore.py
git commit -m "feat(api): desktop-only backup restore with safety copy and atomic import"
```

---

## Task 6: Web mode helper, cloud-only dialog, sidebar, bell and route guards

**Files:**
- Create: `apps/web/lib/appMode.ts`
- Create: `apps/web/components/desktop/CloudOnlyDialog.tsx`
- Create: `apps/web/components/desktop/CloudOnlyPage.tsx`
- Create: `apps/web/components/desktop/CloudOnlyRouteGuard.tsx`
- Modify: `apps/web/components/dashboard/SidebarNavItem.tsx`
- Modify: `apps/web/components/dashboard/Sidebar.tsx`
- Modify: `apps/web/components/community/NotificationBell.tsx`
- Create: `layout.tsx` in each of `apps/web/app/[locale]/(dashboard)/messages/`, `.../discover/`, `.../community/` and `apps/web/app/[locale]/beta/`
- Modify: `apps/web/messages/en.json` and `pt-BR.json`: new `Desktop` namespace
- Test: `apps/web/tests/desktop/appMode.test.ts`, `apps/web/tests/desktop/CloudOnly.test.tsx`, and additions to `tests/dashboard/SidebarNavItem.test.tsx`

**Interfaces:**
- **Produces, `appMode.ts`:** `isDesktop(): boolean`. It reads `process.env.NEXT_PUBLIC_APP_MODE === 'desktop'` **on every call**, so tests can use `vi.stubEnv`.
- **Produces, components:**
  - `CloudOnlyDialog({ open, onClose }: { open: boolean; onClose: () => void })`: built on the existing `components/dashboard/Modal.tsx`. Shows a lucide `Cloud` icon, `t('cloudOnlyTitle')`, `t('cloudOnlyBody')` and an OK `<Button>`.
  - `CloudOnlyPage()`: full-page version, using `t('cloudOnlyPageTitle')` and `t('cloudOnlyBody')`.
  - `CloudOnlyRouteGuard({ children })`: renders `<CloudOnlyPage/>` when `isDesktop()`, otherwise `children`.
- **Produces, `SidebarNavItem`:** new prop `cloudOnly?: boolean`. In desktop mode it renders a `<button>` with the same classes as the link, which opens `CloudOnlyDialog`, instead of a `Link`.
- **`Desktop` namespace keys (en):**
  - `cloudOnlyTitle`: "Available online"
  - `cloudOnlyBody`: "This feature connects you with other families, so it's only available in the online version of Oikos."
  - `cloudOnlyOk`: "OK"
  - `cloudOnlyPageTitle`: "Available in the online version"
  - `onlineOnlyNote`: "Only available in the online version of Oikos."
  - `communitiesCardTitle`: "Communities"
  - `communitiesCardBody`: "Connect with other families in the online version of Oikos."

  Write pt-BR equivalents of each.

- [ ] **Step 1: Write the failing tests**

```tsx
it('isDesktop follows NEXT_PUBLIC_APP_MODE', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop'); expect(isDesktop()).toBe(true);
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', ''); expect(isDesktop()).toBe(false);
});

it('cloudOnly nav item opens the dialog in desktop mode', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
  renderWithIntl(<SidebarNavItem href="/messages" label="Messages" icon={MessageCircle} collapsed={false} cloudOnly />);
  await userEvent.click(screen.getByRole('button', { name: 'Messages' }));
  expect(screen.getByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
});

it('cloudOnly nav item is a normal link in cloud mode', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
  renderWithIntl(<SidebarNavItem href="/messages" label="Messages" icon={MessageCircle} collapsed={false} cloudOnly />);
  expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', expect.stringContaining('/messages'));
});

it('Sidebar and bell make no cloud-only requests in desktop mode', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
  const fetchSpy = vi.spyOn(global, 'fetch');
  renderWithIntl(<><Sidebar mobileOpen={false} onMobileClose={() => {}} /><NotificationBell /></>);
  await new Promise((r) => setTimeout(r, 0));
  const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
  expect(urls.filter((u) => /communities|messages|notifications/.test(u))).toEqual([]);
});

it('route guard shows the cloud-only page in desktop mode', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
  renderWithIntl(<CloudOnlyRouteGuard><p>secret</p></CloudOnlyRouteGuard>);
  expect(screen.queryByText('secret')).toBeNull();
  expect(screen.getByText(en.Desktop.cloudOnlyPageTitle)).toBeInTheDocument();
});
```

`renderWithIntl` is whichever intl render helper the existing tests already use. Mirror `tests/dashboard/SidebarNavItem.test.tsx`.

- [ ] **Step 2: Run them and check they fail**

Run: `cd apps/web && npx vitest run tests/desktop tests/dashboard/SidebarNavItem.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

- **Sidebar:** pass `cloudOnly` to the Messages, Discover and Communities items. Skip both polling `useEffect` bodies when `isDesktop()`.
- **NotificationBell:** in desktop mode, render the bell button only. Clicking it opens `CloudOnlyDialog`. No polling.
- **The four `layout.tsx` files:** `export default function Layout({ children }) { return <CloudOnlyRouteGuard>{children}</CloudOnlyRouteGuard>; }`
- **Host allowlist (ruling R5):** in `apps/web/middleware.ts`, when `isDesktop()`, respond 403 to any request whose `Host` header isn't `127.0.0.1:47321` or `localhost:47321`. The middleware matcher must also cover `/api/*` for this check. Next's proxy rewrites the Host header, so the API's own check can't see the browser's Host. Test in `tests/middleware.test.ts`: a desktop request with `Host: evil.example` gets a 403, and cloud mode is unaffected.

- [ ] **Step 4: Run the web suite**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): desktop mode with cloud-only dialog, sidebar/bell gating and route guards"
```

---

## Task 7: Remaining cloud-only touchpoints

**Files:**
- Modify: `apps/web/components/dashboard/DashboardCommunities.tsx`: in desktop mode, a static card with no fetch
- Modify: `apps/web/components/family/tabs/MembersTab.tsx`: `submitInvite` opens `CloudOnlyDialog` in desktop mode; the resend and revoke buttons do the same
- Modify: `apps/web/components/family/tabs/PrivacyTab.tsx`: the visibility options are disabled in desktop mode, with `t('onlineOnlyNote')` shown under the heading
- Modify: `apps/web/components/onboarding/FamilyWizard.tsx:99`: `<WizardStep3 … hideVisibility={isDesktop()} />`
- Modify: `apps/web/app/[locale]/page.tsx`: lines ~174-180, the beta `Link` becomes a `<button>` with the same classes that opens `CloudOnlyDialog` in desktop mode
- Test: `apps/web/tests/desktop/CloudOnlyTouchpoints.test.tsx`

**Interfaces:** consumes `isDesktop`, `CloudOnlyDialog` and the `Desktop` keys from Task 6.

**Decided:** `NotificationPreferencesSection` isn't rendered by `SettingsPageClient` today, so the spec's notification-preferences rule needs no work.

- [ ] **Step 1: Write the failing tests**

```tsx
it('DashboardCommunities shows the static card and does not fetch in desktop mode', ...)
  // expect(screen.getByText(en.Desktop.communitiesCardTitle)); expect(fetch).not.toHaveBeenCalled()
it('MembersTab invite submit opens the dialog instead of POSTing in desktop mode', ...)
  // fill email, tick consent, submit → dialog visible; no call to /families/me/members/invite
it('PrivacyTab visibility buttons are disabled with the note in desktop mode', ...)
it('FamilyWizard step 3 hides the visibility choice in desktop mode', ...)
it('each touchpoint is unchanged in cloud mode', ...)   // one assertion per component above
```

Each test stubs `NEXT_PUBLIC_APP_MODE` and mocks `fetch`, following the existing tests for that component (`tests/family`, `tests/dashboard`, `tests/onboarding`).

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run tests/desktop/CloudOnlyTouchpoints.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the five changes listed under Files.**

- [ ] **Step 4: Run the web suite**

Run: `npx vitest run && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): gate communities widget, invites, directory visibility and beta link in desktop mode"
```

---

## Task 8: Desktop "forgot password" form

**Files:**
- Create: `apps/web/components/auth/LocalResetPasswordForm.tsx`
- Modify: `apps/web/app/[locale]/(auth)/forgot-password/page.tsx`: `isDesktop() ? <LocalResetPasswordForm /> : <ForgotPasswordForm />`
- Modify: `en.json` and `pt-BR.json`, `Desktop` namespace:
  - `setPasswordTitle`: "Set a new password"
  - `setPasswordSubtitle`: "Enter the email you use in Oikos and choose a new password."
  - `setPasswordButton`: "Save and log in"
  - `accountNotFound`: "There's no account with that email on this computer."
- Test: `apps/web/tests/auth/LocalResetPasswordForm.test.tsx`

**Interfaces:**
- **Consumes:** `POST /api/v1/auth/local-reset-password` (Task 3).
- **Produces:** `LocalResetPasswordForm({ initialEmail, title }: { initialEmail?: string; title?: string })`. On success it calls `router.push('/dashboard')`. Task 9 reuses it.

The form follows the pattern in `ResetPasswordForm.tsx`, with three required fields: email, new password (minimum 10) and confirm. It uses `Validation`-namespace messages, maps 404 to `accountNotFound`, maps 429 to the existing rate-limit message, and shows the spinner while loading.

- [ ] **Step 1: Write the failing tests**

```tsx
it('submits and redirects', async () => { /* mock 200 → push('/dashboard'); body has email/new_password/confirm_password */ });
it('shows accountNotFound on 404', async () => { /* mock 404 {detail:{code:'account_not_found'}} */ });
it('validates min length and match on blur', async () => { /* 'short' → tVal min message; mismatch → tVal match message */ });
it('prefills initialEmail', () => { /* input has value */ });
it('forgot-password page renders the desktop form only in desktop mode', () => { /* stubEnv both ways */ });
```

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run tests/auth/LocalResetPasswordForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): desktop local password reset form"
```

---

## Task 9: Backup section (Settings) and restore (welcome page)

**Files:**
- Create: `apps/web/components/settings/BackupSection.tsx`, rendered in `SettingsPageClient.tsx` before `DangerZoneSection`
- Create: `apps/web/components/desktop/RestoreBackupButton.tsx`, rendered in `app/[locale]/page.tsx` next to the login and register actions **only when `isDesktop()`**
- Modify: `en.json` and `pt-BR.json`
  - `Settings` keys:
    - `backupTitle`: "Backup"
    - `backupSubtitle`: "Save a copy of all your family's data to a file you keep."
    - `backupButton`: "Save backup"
    - `backupError`: "The backup couldn't be saved. Please try again."
  - `Desktop` keys:
    - `restoreButton`: "Restore from backup"
    - `restoreConfirmTitle`: "Replace everything?"
    - `restoreConfirmBody`: "This replaces everything currently in Oikos on this computer."
    - `restoreConfirmButton`: "Replace and restore"
    - `restoreNotABackup`: "This file isn't an Oikos backup."
    - `restoreTooNew`: "This backup was made by a newer version of Oikos. Please install the latest version first."
    - `restoreFailed`: "The restore didn't work. Nothing was changed."
    - `restoreDoneTitle`: "Backup restored — set your password"
- Test: `apps/web/tests/settings/BackupSection.test.tsx`, `apps/web/tests/desktop/RestoreBackupButton.test.tsx`

**Interfaces:**
- **Consumes:** `POST /api/v1/families/me/export` (Task 4), `POST /api/v1/desktop/restore` (Task 5), and `LocalResetPasswordForm` (Task 8).
- **Download:**
  - `BackupSection` calls `apiFetch('/api/v1/families/me/export', { method: 'POST' })` and takes the filename from `Content-Disposition`.
  - It saves the blob through a temporary `<a download>` with an object URL, then revokes the URL.
- **Restore:**
  - `RestoreBackupButton` uses a hidden `<input type="file" accept=".oikos">`, then a confirmation `Modal`, then `fetch('/api/v1/desktop/restore', { method: 'POST', body: FormData, credentials: 'include' })`.
  - On a 400, it maps `detail.code` (`not_a_backup` or `backup_too_new`) to the matching message. Anything else that isn't ok shows `restoreFailed`.
  - On 200, it replaces itself with `<LocalResetPasswordForm initialEmail={emails[0]} title={t('restoreDoneTitle')} />`. No email goes into the URL.

- [ ] **Step 1: Write the failing tests**

```tsx
it('BackupSection renders in cloud and desktop and downloads with the server filename', ...)
  // mock 200 blob + content-disposition; assert anchor.download === 'Oikos-backup-smith-2026-10-23.oikos'
it('BackupSection shows backupError on failure', ...)
it('RestoreBackupButton is absent in cloud mode (welcome page)', ...)
it('restore asks for confirmation before uploading', ...)          // no fetch until confirm clicked
it('restore maps not_a_backup / backup_too_new to their messages', ...)
it('successful restore shows the set-password form prefilled', ...)
```

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run tests/settings/BackupSection.test.tsx tests/desktop/RestoreBackupButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): backup download in settings and desktop restore on welcome page"
```

---

## Task 10: Desktop builds of the API and web

**Files:**
- Create: `apps/api/desktop_entry.py`
- Create: `apps/api/desktop/oikos-api.spec`: PyInstaller spec, onedir. It bundles `alembic/`, `alembic.ini`, `scripts/check_db_state.py` and `app/seeds`.
- Create: `apps/api/requirements-desktop.txt`: `-r requirements.txt` plus `pyinstaller`
- Modify: `apps/web/next.config.js`: `output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined`
- Create: `apps/web/scripts/build-desktop.mjs`: runs `next build` with these variables set, then copies `.next/static` and `public` into the standalone folder:
  - `NEXT_PUBLIC_APP_MODE=desktop`
  - `NEXT_OUTPUT_STANDALONE=1`
  - `API_URL=http://127.0.0.1:47322`
- Test: `apps/api/tests/test_desktop_entry.py`

**Interfaces:**
- **Produces, CLI:** `oikos-api migrate` and `oikos-api serve --port 47322`.
  - Both read these environment variables: `DATABASE_URL`, `DATABASE_SYNC_URL`, `JWT_SECRET_KEY`, `APP_MODE=desktop`, `SESSIONS_DB_PATH`, `BACKUP_DIR`, `APP_VERSION` and `ALEMBIC_INI_PATH`.
  - `migrate` runs `check_db_state.main()`, then `alembic.config.main(["-c", ini, "upgrade", "head"])`, then `asyncio.run(run_seeds.main())`. It exits non-zero on the first failure.
  - `serve` runs `uvicorn.run(app, host="127.0.0.1", port=port)`.
- **Produces, Python function:** `desktop_entry.main(argv: list[str]) -> int`

- [ ] **Step 1: Write the failing tests**

```python
def test_migrate_runs_chain_in_order(monkeypatch):
    calls = []
    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: calls.append("check") or 0)
    monkeypatch.setattr(desktop_entry, "_alembic_upgrade", lambda: calls.append("alembic"))
    monkeypatch.setattr(desktop_entry, "_run_seeds", lambda: calls.append("seeds"))
    assert desktop_entry.main(["migrate"]) == 0 and calls == ["check", "alembic", "seeds"]

def test_migrate_stops_on_failure(monkeypatch):
    monkeypatch.setattr(desktop_entry, "_check_db_state", lambda: 1)
    monkeypatch.setattr(desktop_entry, "_alembic_upgrade", lambda: pytest.fail("must not run"))
    assert desktop_entry.main(["migrate"]) != 0

def test_serve_binds_localhost(monkeypatch):
    seen = {}
    monkeypatch.setattr(desktop_entry.uvicorn, "run", lambda app, host, port: seen.update(host=host, port=port))
    desktop_entry.main(["serve", "--port", "47322"])
    assert seen == {"host": "127.0.0.1", "port": 47322}
```

- [ ] **Step 2: Run them and check they fail**

Run: `pytest tests/test_desktop_entry.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement the entry point, the PyInstaller spec, the Next config switch and the build script.**

- [ ] **Step 4: Verify the real builds on the dev machine**

1. Run `pytest tests/test_desktop_entry.py -v` → PASS.
2. Build the API:
   ```bash
   cd apps/api && python -m venv .venv-desktop && .venv-desktop/Scripts/pip install -r requirements-desktop.txt && .venv-desktop/Scripts/pyinstaller desktop/oikos-api.spec --noconfirm
   ```
   Expected: `dist/oikos-api/oikos-api(.exe)` exists.
3. Point it at a scratch database (`docker compose up -d db`, database `oikos_desktop_smoke`).
   - Run `oikos-api migrate` → exit code 0.
   - Run `oikos-api serve --port 47322`, then `curl http://127.0.0.1:47322/health` → `{"status":"ok"}`.
4. Build the web app: `cd apps/web && node scripts/build-desktop.mjs` → `.next/standalone/apps/web/server.js` exists.
5. Confirm the cloud build is unchanged: `npm run build` (without `NEXT_OUTPUT_STANDALONE`) succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/api/desktop_entry.py apps/api/desktop apps/api/requirements-desktop.txt apps/api/tests/test_desktop_entry.py apps/web/next.config.js apps/web/scripts/build-desktop.mjs
git commit -m "build: desktop entry point for API (PyInstaller) and standalone web build"
```

---

## Task 11: Electron shell (`apps/desktop`)

**Files:**
- Create in `apps/desktop/`:
  - `package.json` (name `@oikos/desktop`; dependencies `electron`, `electron-builder`, `embedded-postgres` at major version 16; dev dependencies `typescript` and `vitest`)
  - `tsconfig.json`
- Create in `apps/desktop/src/`:
  - `ports.ts`: `WEB_PORT = 47321`, `API_PORT = 47322`, `PG_PORT = 47323`, and `findBusyPorts(ports: number[]): Promise<number[]>`
  - `config.ts`: `loadOrCreateConfig(userDataDir: string): AppConfig`, where `AppConfig = { jwtSecret: string; pgPassword: string; lastRunVersion: string | null }`, with random 32-byte hex secrets. Plus `saveConfig(dir, cfg)`.
  - `paths.ts`: `resolvePaths(userDataDir: string, resourcesDir: string): AppPaths`, covering `pgdata`, `backups`, `logs`, `sessionsDb`, `apiExe`, `webServerJs`, `pgDumpExe` and `alembicIni`
  - `postgres.ts`: `startPostgres(paths, cfg): Promise<PgHandle>` and `PgHandle.stop()`, using `embedded-postgres` with `initdbFlags: ['--encoding=UTF8', '--locale=C']`, `persistent: true`, port `PG_PORT`, user `oikos`, and the `oikos` database created when missing
  - `safetyCopy.ts`: `writePremigrateCopy(paths, cfg): Promise<string>`, which runs `pg_dump -Fc` into `backups/auto-premigrate-<timestamp>.dump`, and `pruneBackups(dir: string, prefix: string, keep: number): string[]`, which returns the deleted files
  - `services.ts`:
    - `runMigrations(paths, env): Promise<void>`: rejects with the stderr tail
    - `startApi(paths, env): ChildProcess`
    - `startWeb(paths): UtilityProcess`: `utilityProcess.fork(webServerJs)` with `PORT=47321`, `HOSTNAME=127.0.0.1`
    - `waitForHealth(url, timeoutMs): Promise<void>`
    - All children are spawned with argument **arrays**, never a shell.
    - Each child's stdout and stderr is appended to `logs/<api|web|migrate>.log`.
  - `startup.ts`: `runStartup(deps: StartupDeps): Promise<void>`. This is the startup sequence from the spec, with every side effect injected through `deps` so it can be tested.
  - `windows.ts`: splash, error window (with "Open log folder" and "Quit"), and the main window at `http://127.0.0.1:47321/`. The `session.defaultSession.on('will-download')` handler shows the native Save dialog (`item.setSaveDialogOptions`).
  - `main.ts`: takes the single-instance lock, then on `app.whenReady` → `runStartup`, and on `before-quit` stops web, then API, then Postgres.
- Test: `apps/desktop/tests/*.test.ts`

**Interfaces:**
- **Consumes:** the API CLI and the web standalone output from Task 10.
- **Produces:** `runStartup(deps: StartupDeps): Promise<void>`. `StartupDeps` = `{ cfg: AppConfig, appVersion: string, findBusyPorts, startPostgres, hasUsers: () => Promise<boolean>, writePremigrateCopy, runMigrations, startApi, startWeb, waitForHealth, saveConfig, showError: (kind: 'ports' | 'migration' | 'start', detail: string) => void }`

**Startup order (from the spec):**
1. Check ports.
2. Start Postgres.
3. If `cfg.lastRunVersion !== appVersion` and `hasUsers()`, write the safety copy.
4. Run migrations.
5. Start the API, then the web server.
6. Wait for both health checks (`/health` on the API, `/` on the web server), with a 60 s timeout each.
7. Save `lastRunVersion`.

If migrations fail, the `showError('migration', …)` detail includes the path of the safety copy, when one was written.

- [ ] **Step 1: Write the failing tests**

```ts
it('findBusyPorts reports an occupied port', async () => {
  const srv = net.createServer().listen(47399, '127.0.0.1');
  expect(await findBusyPorts([47399, 47398])).toEqual([47399]);
  srv.close();
});

it('loadOrCreateConfig creates once and then reuses', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oikos '));
  const a = loadOrCreateConfig(dir); const b = loadOrCreateConfig(dir);
  expect(a.jwtSecret).toMatch(/^[0-9a-f]{64}$/); expect(b).toEqual(a);
});

it('pruneBackups keeps the 5 newest per prefix', () => { /* 7 premigrate + 2 prerestore files → 2 premigrate deleted, prerestore untouched */ });

it('paths with spaces and accents survive spawn', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'Oikos João Silva '));
  const p = resolvePaths(dir, '/res');
  const out = execFileSync(process.execPath, ['-e', 'console.log(process.argv[1])', p.backups]).toString().trim();
  expect(out).toBe(p.backups);
});

it('runStartup runs steps in order and records the version', async () => { /* fake deps push names; expect order; saveConfig called with lastRunVersion */ });
it('startup aborts before migrating when the safety copy fails', async () => {
  const deps = fakeDeps({ cfg: { ...cfg, lastRunVersion: '0.1.0' }, appVersion: '0.2.0', hasUsers: async () => true,
                          writePremigrateCopy: async () => { throw new Error('disk full'); } });
  await runStartup(deps);
  expect(deps.runMigrations).not.toHaveBeenCalled();
  expect(deps.showError).toHaveBeenCalledWith('migration', expect.stringContaining('disk full'));
});
it('busy ports show the ports error and start nothing', async () => { /* findBusyPorts → [47322]; showError('ports', '47322'); startPostgres not called */ });
it('no safety copy on first run or same version', async () => { /* lastRunVersion null or equal → writePremigrateCopy not called */ });
```

- [ ] **Step 2: Run them and check they fail**

Run: `cd apps/desktop && npx vitest run`
Expected: FAIL.

- [ ] **Step 3: Implement all the modules listed under Files.**

Before relying on `embedded-postgres` for `pg_dump`, check whether the platform package ships `pg_dump`:
- Look for `node_modules/@embedded-postgres/<platform>/native/bin/pg_dump*`.
- If it isn't there, add an `extraResources` entry in Task 12 that bundles `pg_dump` from the official PostgreSQL 16 binaries, and point `paths.pgDumpExe` at it.

- [ ] **Step 4: Run the tests and a dev launch**

1. `npx vitest run` → PASS.
2. Launch in dev mode against the Task 10 outputs (`npm run dev` in `apps/desktop`, with `resourcesDir` pointing at the local build folders).
   - Expected: splash, then the welcome page.
   - Registering works.
   - After quitting and relaunching, the parent is still logged in.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop package.json package-lock.json
git commit -m "feat(desktop): Electron shell running bundled Postgres, API and web"
```

---

## Task 12: Installers and the CI workflow

**Files:**
- Create: `apps/desktop/electron-builder.yml`
  - `appId: family.oikos.desktop`, `productName: Oikos`
  - `win: nsis (x64)`, `mac: dmg`, built separately for arm64 and x64
  - `mac.identity: null` (unsigned; ad-hoc signing still applies)
  - `extraResources`: `api/` (PyInstaller dist), `web/` (standalone), and `pg_dump` if Task 11 needed it
- Modify: root `package.json`: `"desktop:build": "npm run build:desktop --workspace=@oikos/desktop"`. That workspace script chains the Task 10 API build, the web build and `electron-builder`.
- Create: `.github/workflows/desktop-build.yml`
  - Triggered by `workflow_dispatch`.
  - Matrix: `windows-latest`, `macos-14` (arm64), `macos-13` (x64).
  - Sets up Node 20 and Python 3.12, then runs `npm ci` and `npm run desktop:build`.
  - Uploads the installer with `actions/upload-artifact`.
  - Publishes no release.

- [ ] **Step 1: Build locally on Windows**

Run: `npm run desktop:build`
Expected: `apps/desktop/dist/Oikos Setup <version>.exe`

- [ ] **Step 2: Install and check the installed app**

Install the `.exe`, launch it, register, quit, and relaunch.
Expected: the SmartScreen warning appears on first run, the parent is still logged in after relaunch, and the data is in `%APPDATA%\Oikos\pgdata`.

- [ ] **Step 3: Run the workflow from the GitHub Actions UI on the pushed branch**

Expected: three green jobs, each with an installer artifact.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron-builder.yml package.json .github/workflows/desktop-build.yml
git commit -m "build(desktop): unsigned NSIS/DMG installers and manual CI workflow"
```

---

## Task 13: Install guide and smoke checklist

**Files:**
- Create: `docs/desktop/install-guide.md` (English) and `docs/desktop/install-guide.pt-BR.md`. Each has a screenshot placeholder per OS and the exact text below:
  - **Windows:** "If you see 'Windows protected your PC', click **More info → Run anyway**."
  - **macOS:** "Open the DMG and drag Oikos to Applications. Open it; when macOS blocks it, go to **System Settings → Privacy & Security → Open Anyway**. If macOS says the app 'is damaged', run `xattr -cr /Applications/Oikos.app` in Terminal, or call me."
- Create: `docs/desktop/smoke-checklist.md`

- [ ] **Step 1: Write both guides and the checklist.**

The checklist steps, per OS:
1. Install, then first run.
2. Register and complete onboarding (no visibility question).
3. Add a child.
4. Click Messages, Discover, Communities, the bell and Invite. Each shows the popup.
5. Quit and relaunch: still logged in.
6. Save a backup from Settings: the Save dialog opens and the file is written.
7. Restore it from the welcome page: the set-password screen appears and the data is intact.
8. Restore a backup downloaded from the cloud version (a local docker stack in cloud mode).
9. Forgot password: set a new one.
10. Kill the app from Task Manager / Force Quit, then relaunch: it starts normally.
11. Install a newer build over the old one: an `auto-premigrate-*.dump` appears and the data is intact.
12. On Windows, use an account whose user name has a space or an accent.

- [ ] **Step 2: Run the checklist on Windows and on at least one Mac, and record the results in the checklist file.**

Expected: every step passes. Any failure goes back to the task that owns it.

- [ ] **Step 3: Commit**

```bash
git add docs/desktop
git commit -m "docs(desktop): install guide (en, pt-BR) and smoke checklist"
```
