"""Pre-flight DB sanity check, run before `alembic upgrade head`.

Catches the "ghost stamp" failure mode where `alembic_version` claims the DB
is migrated but the actual schema is empty (or missing the foundational
`users` table). When that happens, alembic blindly tries to run the *next*
migration and dies with a confusing "relation X does not exist" error
half-way through DDL.

This script detects that state and exits with code 2 + a clear message
telling the developer how to fix it. Pre-existing healthy DBs and brand-new
empty DBs both pass through cleanly.

Exit codes:
  0  — DB is in a sane state, proceed to alembic upgrade.
  2  — DB is corrupted (ghost stamp). Print fix instructions.
  3  — DB is unreachable.
"""
import os
import sys

import psycopg2


SYNC_URL = os.environ.get("DATABASE_SYNC_URL") or os.environ.get("DATABASE_URL", "")
if SYNC_URL.startswith("postgresql+asyncpg://"):
    SYNC_URL = SYNC_URL.replace("postgresql+asyncpg://", "postgresql://", 1)


RED = "\033[0;31m"
YELLOW = "\033[1;33m"
GREEN = "\033[0;32m"
RESET = "\033[0m"


def main() -> int:
    if not SYNC_URL:
        print(f"{RED}DATABASE_SYNC_URL / DATABASE_URL not set{RESET}", file=sys.stderr)
        return 3

    try:
        conn = psycopg2.connect(SYNC_URL)
    except Exception as e:
        print(f"{RED}Cannot reach the database: {e}{RESET}", file=sys.stderr)
        return 3

    try:
        with conn.cursor() as cur:
            # Is alembic_version present at all?
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'alembic_version'
                );
            """)
            has_alembic = cur.fetchone()[0]

            if not has_alembic:
                print(f"{GREEN}DB is fresh — alembic will run all migrations from scratch.{RESET}")
                return 0

            cur.execute("SELECT version_num FROM alembic_version;")
            rows = cur.fetchall()
            stamped = rows[0][0] if rows else None

            if not stamped:
                print(f"{GREEN}alembic_version exists but is empty — alembic will run from base.{RESET}")
                return 0

            # The real check: if alembic claims any migration is applied,
            # the foundational `users` table must exist (it's created by 0001).
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'users'
                );
            """)
            has_users = cur.fetchone()[0]

            if not has_users:
                print(
                    f"{RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n"
                    f"{RED} DB STATE IS CORRUPT — REFUSING TO MIGRATE.{RESET}\n"
                    f"{RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n"
                    f"\n"
                    f" alembic_version says: {YELLOW}{stamped}{RESET}\n"
                    f" but the {YELLOW}users{RESET} table does not exist.\n"
                    f"\n"
                    f" This means the DB was wiped or partially restored\n"
                    f" without clearing the alembic stamp. Running migrations\n"
                    f" now would fail with a confusing 'relation X does not\n"
                    f" exist' error half-way through DDL.\n"
                    f"\n"
                    f" {YELLOW}To fix from your host shell:{RESET}\n"
                    f"\n"
                    f"   ./scripts/db-doctor.sh         # diagnose\n"
                    f"   ./scripts/db-reset.sh          # wipe + re-migrate (destructive — asks first)\n"
                    f"\n"
                    f"{RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}",
                    file=sys.stderr,
                )
                return 2

            print(f"{GREEN}DB state OK — alembic at {stamped}, schema present.{RESET}")
            return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
