#!/usr/bin/env bash
# db-reset.sh — wipe the local Oikos Postgres volume and re-run all migrations.
#
# DESTRUCTIVE: every family, child, subject, lesson, note, etc. in your local
# dev DB will be lost. The platform-seeded subjects/templates ARE re-created
# automatically by the seed step.
#
# Refuses to run without an explicit "yes". Pass --yes to skip the prompt
# (e.g. for use in CI / a dev-bootstrap script).

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RESET='\033[0m'

VOLUME="${VOLUME:-oikos-web_postgres_data}"

ASSUME_YES=false
for arg in "$@"; do
    case "$arg" in
        --yes|-y) ASSUME_YES=true ;;
        --help|-h)
            cat <<EOF
db-reset.sh — wipe the local Oikos Postgres volume.

Usage:
  ./scripts/db-reset.sh           # interactive, asks for confirmation
  ./scripts/db-reset.sh --yes     # skip confirmation (DESTRUCTIVE — careful)

Environment overrides:
  VOLUME      docker volume name (default: ${VOLUME})
EOF
            exit 0
            ;;
    esac
done

cat <<EOF
${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
${RED} DESTRUCTIVE OPERATION — DB-RESET${RESET}
${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}

This will:
  1. Stop all docker compose services
  2. ${RED}DELETE${RESET} the postgres volume (${VOLUME})
  3. Bring the stack back up so all migrations re-run from scratch

After this, ${YELLOW}every record in your local dev DB will be gone${RESET}.
The schema and seeded subjects/templates will be recreated automatically.

EOF

if [ "$ASSUME_YES" != true ]; then
    read -r -p "$(printf '%bType "wipe" to confirm:%b ' "$YELLOW" "$RESET")" answer
    if [ "$answer" != "wipe" ]; then
        echo "Aborted."
        exit 1
    fi
fi

echo
echo "${BLUE}→ docker compose down${RESET}"
docker compose down

echo "${BLUE}→ docker volume rm ${VOLUME}${RESET}"
if docker volume ls --format '{{.Name}}' | grep -q "^${VOLUME}$"; then
    docker volume rm "$VOLUME"
else
    echo "  (volume already absent — nothing to remove)"
fi

echo "${BLUE}→ docker compose up -d${RESET}"
docker compose up -d

echo
echo "${GREEN}✓ Reset complete. Watching migrate logs:${RESET}"
echo
docker logs -f --tail 50 oikos-web-migrate-1 || true
