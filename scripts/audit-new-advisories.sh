#!/usr/bin/env bash
# Fails only on advisories the working tree adds over a base commit, so an advisory against
# a dependency the base already has does not block unrelated work; Dependabot fixes those.
# Usage: scripts/audit-new-advisories.sh [base-commit]. Without a base every advisory is new.
set -euo pipefail

base_commit="${1:-}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

mkdir "$work_dir/base"

if [[ -z "$base_commit" ]]; then
  echo '{"advisories":{}}' > "$work_dir/base-audit.json"
else
  for file in package.json pnpm-lock.yaml pnpm-workspace.yaml; do
    if git cat-file -e "$base_commit:$file" 2>/dev/null; then
      git show "$base_commit:$file" > "$work_dir/base/$file"
    fi
  done

  # pnpm audit exits non-zero whenever it finds advisories; the JSON check below catches real failures
  pnpm audit --json --dir "$work_dir/base" > "$work_dir/base-audit.json" || true
fi

pnpm audit --json > "$work_dir/head-audit.json" || true

jq -e 'has("advisories")' "$work_dir/base-audit.json" "$work_dir/head-audit.json" > /dev/null

jq -r --slurpfile base "$work_dir/base-audit.json" '
  .advisories
  | to_entries[]
  | select(.key as $id | $base[0].advisories | has($id) | not)
  | .value
  | "\(.severity) \(.module_name) \(.github_advisory_id): \(.title), patched in \(.patched_versions)"
' "$work_dir/head-audit.json" > "$work_dir/new-advisories.txt"

echo "Advisories already present in the base: $(jq '.advisories | length' "$work_dir/base-audit.json")"

if [[ -s "$work_dir/new-advisories.txt" ]]; then
  echo "The change introduces vulnerable dependencies:" >&2
  cat "$work_dir/new-advisories.txt" >&2
  exit 1
fi
