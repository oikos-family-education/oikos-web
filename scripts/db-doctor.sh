#!/usr/bin/env bash
# db-doctor.sh — read-only diagnostic for the local Oikos Postgres container.
#
# Reports:
#   * is the db container running?
#   * what does alembic_version say?
#   * what tables actually exist?
#   * is the DB in the "ghost stamp" corrupted state?
#
# Never mutates anything. Run before db-reset.sh to confirm what's broken.

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RESET='\033[0m'

DB_CONTAINER="${DB_CONTAINER:-oikos-web-db-1}"
DB_USER="${DB_USER:-oikos}"
DB_NAME="${DB_NAME:-oikos}"

say() { printf '%b\n' "$1"; }

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    say "${RED}✗ Postgres container '${DB_CONTAINER}' is not running.${RESET}"
    say "  Start it with: ${BLUE}docker compose up -d db${RESET}"
    exit 1
fi
say "${GREEN}✓ Postgres container '${DB_CONTAINER}' is running.${RESET}"

# --- alembic_version --------------------------------------------------------

HAS_ALEMBIC=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version');")

if [ "$HAS_ALEMBIC" = "f" ]; then
    say "${YELLOW}• alembic_version table does not exist — DB is fresh.${RESET}"
    say "  Run ${BLUE}docker compose up -d${RESET} to apply all migrations."
    exit 0
fi

STAMP=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT version_num FROM alembic_version LIMIT 1;" | tr -d '[:space:]')

if [ -z "$STAMP" ]; then
    say "${YELLOW}• alembic_version exists but is empty.${RESET}"
    say "  Next migration run will start from base."
    exit 0
fi

say "${BLUE}• alembic_version: ${STAMP}${RESET}"

# --- table presence ---------------------------------------------------------

HAS_USERS=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users');")

TABLE_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name <> 'alembic_version';" \
    | tr -d '[:space:]')

say "${BLUE}• ${TABLE_COUNT} application tables present (excluding alembic_version).${RESET}"

if [ "$HAS_USERS" = "f" ]; then
    say ""
    say "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    say "${RED} CORRUPTED STATE DETECTED${RESET}"
    say "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    say " alembic_version says ${YELLOW}${STAMP}${RESET}, but the ${YELLOW}users${RESET} table does not exist."
    say " This is the 'ghost stamp' bug — alembic will skip ahead and"
    say " fail mid-DDL on the next migration."
    say ""
    say " Fix it with:"
    say "   ${BLUE}./scripts/db-reset.sh${RESET}        (wipes the DB volume — asks first)"
    say ""
    exit 2
fi

# --- migration head match ---------------------------------------------------

HEAD=$(grep -lE '^revision[: ]' apps/api/alembic/versions/*.py 2>/dev/null \
    | xargs grep -lE 'down_revision.*head\b' 2>/dev/null || true)

# A simpler, more reliable head detection: find the revision that no other
# migration declares as its down_revision.
ALL_REVS=$(grep -hE "^revision[: ]" apps/api/alembic/versions/*.py \
    | sed -E "s/.*['\"]([^'\"]+)['\"].*/\1/" | sort -u)
ALL_DOWN=$(grep -hE "^down_revision" apps/api/alembic/versions/*.py \
    | sed -E "s/.*['\"]([^'\"]+)['\"].*/\1/" | sort -u)
HEAD_REV=$(comm -23 <(echo "$ALL_REVS") <(echo "$ALL_DOWN") | head -n1)

if [ -n "$HEAD_REV" ]; then
    if [ "$STAMP" = "$HEAD_REV" ]; then
        say "${GREEN}✓ DB is at head (${HEAD_REV}). All migrations applied.${RESET}"
    else
        say "${YELLOW}• DB is behind head — current ${STAMP}, head ${HEAD_REV}.${RESET}"
        say "  Run ${BLUE}docker compose up -d migrate${RESET} to apply pending migrations."
    fi
fi
