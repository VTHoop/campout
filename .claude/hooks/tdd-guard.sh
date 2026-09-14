#!/usr/bin/env bash
# TDD integrity guard (PostToolUse hook)
# Blocks the turn when test-integrity violations are detected in the just-edited file.
# Violations: .skip/.only added, test cases removed, assertions removed, coverage
# thresholds lowered, code-health floor lowered.
#
# Two details worth knowing before editing:
#   - gate 4 compares EVERY threshold occurrence, because vitest.config.ts carries
#     two floors (packages/planner 95%, src 80%) — see ADR-0009. Checking only the
#     first match would miss a lowered second floor.
#   - gate 5 guards .codescene-thresholds, which AGENTS.md ranks as the same
#     offence as weakening a test.
set -uo pipefail

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty')
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[[ "$tool_name" == "Edit" || "$tool_name" == "Write" ]] || exit 0
[[ -n "$file_path" && -f "$file_path" ]] || exit 0

diff=$(git diff HEAD -- "$file_path" 2>/dev/null || true)

# New/untracked files have no diff — still check for .skip/.only in file content
if [[ -z "$diff" ]]; then
  if grep -qE '\.(skip|only)\s*\(' "$file_path"; then
    printf 'TDD guard: .skip or .only modifier found in new test file %s — remove before proceeding.\n' "$file_path"
    exit 2
  fi
  exit 0
fi

added()   { printf '%s\n' "$diff" | grep -E '^\+' | grep -vE '^\+\+\+'; }
removed() { printf '%s\n' "$diff" | grep -E '^-'  | grep -vE '^---';    }

# A parametrize refactor — folding individual it/test cases into a single
# it.each / test.each / describe.each table — legitimately reduces the literal
# count of both test blocks and expect calls while preserving (or growing) the
# runtime cases. It exempts the count-based gates (#2, #3); the skip/only gate
# (#1) and the ratchet gates (#4, #5) still apply.
#
# Scope the exemption to a REAL conversion: an added each-table AND removed
# it()/test() block(s) in the same diff. A lone added `.each` must NOT blanket-
# exempt the file — otherwise an unrelated `.each` could mask assertion or
# test-case removals elsewhere.
parametrized=false
if added | grep -qE '\.each\s*\(' && removed | grep -qE '^-\s*(it|test)\s*\('; then
  parametrized=true
fi

# 1. .skip or .only added
if added | grep -qE '\.(skip|only)\s*\('; then
  printf 'TDD guard: .skip or .only modifier added to a test in %s — remove before proceeding.\n' "$file_path"
  exit 2
fi

# 2. Test case or describe block removed (unless parametrized into a .each table)
if [[ "$parametrized" == false ]] && removed | grep -qE '^-\s*(it|test|describe)\s*\('; then
  printf 'TDD guard: test case or describe block removed from %s — restore the test, parametrize it with it.each, or justify the removal in its own commit.\n' "$file_path"
  exit 2
fi

# 3. Assertion removed (test files only; net-count gate so refactors don't
#    false-trigger — also exempt when parametrized into a .each table)
if [[ "$parametrized" == false ]] && printf '%s\n' "$file_path" | grep -qE '\.(test|spec)\.(ts|tsx|js|jsx)$'; then
  removed_expect=$(removed | grep -cE 'expect\s*\(' || true)
  added_expect=$(added   | grep -cE 'expect\s*\(' || true)
  if (( removed_expect > 0 && removed_expect > added_expect )); then
    printf 'TDD guard: assertions (expect) net-removed from %s — restore or fix the assertions rather than removing them.\n' "$file_path"
    exit 2
  fi
fi

# 4. Coverage threshold lowered (vitest/jest config files only).
#    This repo carries TWO floors — packages/planner at 95%, src at 80% (ADR-0009)
#    — so every occurrence of each key is compared, not just the first. Values are
#    sorted and matched pairwise: if any added floor undercuts the corresponding
#    removed floor, or a floor disappears entirely, the edit is blocked.
if printf '%s\n' "$file_path" | grep -qE '(vitest|jest)\.config\.(ts|js|mts|mjs)$'; then
  # Portable to bash 3.2, which is what macOS ships — `mapfile` is bash 4+ and
  # its absence made this gate fail OPEN, which on a ratchet is the one failure
  # mode that must never happen.
  collect() {
    local line
    thresholds=()
    while IFS= read -r line; do
      [ -n "$line" ] && thresholds+=("$line")
    done
  }

  for key in lines functions branches statements; do
    collect < <(removed | grep -oE "${key}[[:space:]]*:[[:space:]]*[0-9]+" | grep -oE '[0-9]+$' | sort -n)
    old_vals=("${thresholds[@]:-}")
    old_count=${#thresholds[@]}

    collect < <(added | grep -oE "${key}[[:space:]]*:[[:space:]]*[0-9]+" | grep -oE '[0-9]+$' | sort -n)
    new_vals=("${thresholds[@]:-}")
    new_count=${#thresholds[@]}

    if [ "$old_count" -gt "$new_count" ]; then
      printf 'TDD guard: a coverage threshold "%s" was removed from %s — thresholds are a ratchet and may only go up.\n' "$key" "$file_path"
      exit 2
    fi

    i=0
    while [ "$i" -lt "$old_count" ]; do
      if [ "${new_vals[$i]}" -lt "${old_vals[$i]}" ]; then
        printf 'TDD guard: coverage threshold "%s" lowered from %s to %s in %s — thresholds are a ratchet and may only go up.\n' \
          "$key" "${old_vals[$i]}" "${new_vals[$i]}" "$file_path"
        exit 2
      fi
      i=$((i + 1))
    done
  done
fi

# 5. Code-health floor lowered. AGENTS.md ranks lowering this as the same offence
#    as weakening a test, so it is blocked in the same place.
if printf '%s\n' "$file_path" | grep -qE '\.codescene-thresholds$'; then
  old_floor=$(removed | grep -oE '[0-9]+\.[0-9]+' | sort -n | head -1)
  new_floor=$(added   | grep -oE '[0-9]+\.[0-9]+' | sort -n | head -1)
  if [[ -n "$old_floor" && -n "$new_floor" ]] && awk -v a="$new_floor" -v b="$old_floor" 'BEGIN{exit !(a<b)}'; then
    printf 'TDD guard: code-health floor lowered from %s to %s in %s — the floor only moves upward (AGENTS.md §1).\n' \
      "$old_floor" "$new_floor" "$file_path"
    exit 2
  fi
fi

exit 0
