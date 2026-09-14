#!/usr/bin/env bash
# Privacy guard (PostToolUse hook) — enforces the cardinal rules in ADR-0006 and ADR-0004.
#
# AGENTS.md says the Child type must make forbidden fields impossible rather than
# merely absent. A rule an agent has to remember is one that gets missed once and
# then lives on in a migration. This hook is the "structural over remembered"
# principle applied to the rules themselves.
#
# Blocks, on any Edit/Write:
#   1. A child-PII field name introduced anywhere (last name, DOB, allergies,
#      medications, health info, or a free-text note on a child).
#   2. RLS being disabled, or a table created without it, in a migration.
#   3. The service-role key reaching application code.
#
# It is a blunt instrument on purpose: a false positive costs one conversation
# with a human, and a false negative costs a child's medical data in a public repo.
set -uo pipefail

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty')
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[[ "$tool_name" == "Edit" || "$tool_name" == "Write" ]] || exit 0
[[ -n "$file_path" && -f "$file_path" ]] || exit 0

# This hook's own source and the docs that define the rules necessarily name the
# forbidden terms. Exempt them or the guard blocks every edit to its own spec.
case "$file_path" in
  */.claude/hooks/*|*/docs/adr/*|*/AGENTS.md|*/docs/data/*|*/README.md) exit 0 ;;
esac

diff=$(git diff HEAD -- "$file_path" 2>/dev/null || true)
if [[ -n "$diff" ]]; then
  subject=$(printf '%s\n' "$diff" | grep -E '^\+' | grep -vE '^\+\+\+' | sed 's/^+//')
else
  subject=$(cat "$file_path")
fi
[[ -n "$subject" ]] || exit 0

# Strip comments before matching. The migration that creates `children` carries a
# long warning naming every forbidden field — that comment is the rule, not a
# violation of it, and scanning it would block every edit to the file we most
# want people editing carefully. Code is still scanned: a comment reading
# "-- never add allergies" passes, a column reading "allergies text" does not.
scannable=$(printf '%s\n' "$subject" \
  | grep -vE '^[[:space:]]*(--|//|#|\*|/\*)' \
  | sed -E 's://.*$::; s:--.*$::')

lower=$(printf '%s' "$scannable" | tr '[:upper:]' '[:lower:]')

fail() {
  printf 'Privacy guard: %s\n\nFile: %s\n\n%s\n' "$1" "$file_path" \
    'This is a cardinal rule (AGENTS.md §2, ADR-0006). Do not work around it, rename the field, or add an exception. Stop and escalate to the humans.'
  exit 2
}

# 1. Forbidden child fields. Matched as identifier-ish tokens (snake_case, camelCase,
#    or a quoted column name) to keep unrelated prose from tripping the gate.
forbidden_child_fields=(
  'last_?name' 'lastname' 'surname' 'family_?name'
  'date_?of_?birth' 'birth_?date' 'birthday' '\bdob\b'
  'allerg' 'medication' 'medical' 'immuniz' 'vaccin'
  'diagnos' 'dietary' 'epipen' 'prescription'
  'iep\b' '504_?plan'
)
for pattern in "${forbidden_child_fields[@]}"; do
  if printf '%s' "$lower" | grep -qE "$pattern"; then
    fail "the term matching /$pattern/ was introduced. The children table and the Child type must have no field for a last name, a birth date, or any health information — we store a first name, an integer age, and a grade, and nothing else."
  fi
done

# 2. A free-text note on a child. Blunt on purpose: if the change touches the
#    child domain at all AND introduces a note-shaped column or field, it blocks.
#    Adjacency matching was tried and missed "alter table children add column
#    notes text" — the exact shape this gate exists to catch. A false positive
#    costs one conversation; a false negative costs a child's medical data.
if printf '%s' "$lower" | grep -qE '\bchild(ren)?\b'; then
  if printf '%s' "$lower" | grep -qE '\b(note|notes|comment|comments|remark|remarks|memo|free_?text|details)\b'; then
    fail 'a free-text note field on a child was introduced. This is the field a parent types "peanut allergy" into — it is forbidden precisely because it looks harmless (ADR-0006). If this is a note on a camp rather than on a child, name it so, and keep it out of any file that also touches children.'
  fi
fi

# 3. RLS disabled, or a migration creating a user-data table without enabling it.
if printf '%s' "$lower" | grep -qE 'disable[[:space:]]+row[[:space:]]+level[[:space:]]+security'; then
  fail 'RLS is being disabled. Row Level Security is the only boundary between one family and another (ADR-0004); a table with it disabled is a release-blocking bug.'
fi

case "$file_path" in
  *supabase/migrations/*)
    created=$(printf '%s' "$lower" | grep -oE 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?[a-z0-9_."]+' | grep -oE '[a-z0-9_]+"?$' || true)
    for table in $created; do
      case "$table" in
        households|children|household_members|plan_entries|profiles)
          if ! printf '%s' "$lower" | grep -qE "alter[[:space:]]+table[[:space:]]+[a-z0-9_.\"]*${table}\"?[[:space:]]+enable[[:space:]]+row[[:space:]]+level[[:space:]]+security"; then
            fail "the migration creates the user-data table \"$table\" without enabling Row Level Security in the same migration (ADR-0004)."
          fi
          ;;
      esac
    done
    ;;
esac

# 4. The service-role key in application code. It bypasses every policy.
case "$file_path" in
  */src/*|*/packages/*)
    if printf '%s' "$lower" | grep -qE 'service_?role'; then
      fail 'the Supabase service-role key is referenced from application code. It bypasses every RLS policy and belongs only to migrations and local seed scripts (ADR-0004, ADR-0010).'
    fi
    ;;
esac

exit 0
