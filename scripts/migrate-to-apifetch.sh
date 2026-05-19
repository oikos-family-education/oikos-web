#!/usr/bin/env bash
# One-shot migration: replace direct fetch() calls to /api/v1/* with apiFetch().
# Adds an import to each touched file. Skips AuthProvider and test files.
#
# Run from repo root:
#   bash scripts/migrate-to-apifetch.sh
#
# After running, this script can be deleted — it's a one-time migration.

set -euo pipefail

mapfile -t files < <(
  grep -rln -E "fetch\(\s*['\"\`]/api/v1" apps/web \
    --include="*.tsx" --include="*.ts" \
    | grep -v "providers/AuthProvider.tsx" \
    | grep -v "/tests/" \
    | grep -v "lib/apiFetch.ts"
)

for file in "${files[@]}"; do
  # Compute relative import path from this file to apps/web/lib/apiFetch
  rel="${file#apps/web/}"
  # Count directory separators to know how many levels up
  depth=$(awk -F'/' '{print NF-1}' <<< "$rel")
  prefix=""
  for ((i=0; i<depth; i++)); do prefix+="../"; done
  import_path="${prefix}lib/apiFetch"

  # Skip if already imported
  if grep -q "from '${import_path}'" "$file" || grep -q 'apiFetch' "$file"; then
    echo "skip (already migrated): $file"
    continue
  fi

  # Insert the import before the first existing import line
  perl -i -pe "
    if (!\$done && /^import /) {
      print \"import { apiFetch } from '${import_path}';\n\";
      \$done = 1;
    }
  " "$file"

  # Replace fetch('/api/v1, fetch(\"/api/v1, fetch(\`/api/v1 → apiFetch(...)
  perl -i -pe "s/\bfetch\(\s*'\\/api\\/v1/apiFetch('\\/api\\/v1/g" "$file"
  perl -i -pe 's/\bfetch\(\s*"\/api\/v1/apiFetch("\/api\/v1/g' "$file"
  perl -i -pe 's/\bfetch\(\s*`\/api\/v1/apiFetch(`\/api\/v1/g' "$file"

  echo "migrated: $file"
done

echo "done. ${#files[@]} files processed."
