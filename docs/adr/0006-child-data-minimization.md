# 6. Child data minimization and the browser-only vault

- Status: Accepted
- Date: 2026-09-14

## Context
Campout's users are children's parents, and the obvious direction for a product like this runs directly at the most sensitive data a family has. Camp registration forms want emergency contacts, insurance policy numbers, physician names, allergies, medications, and immunization records. A planner that auto-filled those forms would be genuinely useful.

It would also make a two-person side project with no security team the custodian of children's health information. The regulatory exposure is real, but the practical argument is stronger: **we cannot leak what we never had.**

Two separate decisions follow, and they are separate on purpose. The first is about what we store at all. The second is about where the data we *don't* store actually goes.

## Decision

### 1. The database holds three facts about a child
A first name or nickname, an integer age, and a grade. That is the complete list.

**⛔ No column, field, type, or form input may exist for:** a last name, a date of birth, allergies, medications, dietary restrictions, diagnoses, IEP/504 information, a photo, or **any free-text note attached to a child.**

The free-text note deserves its own sentence. It looks harmless, it is the field every app grows, and it is exactly where a parent will type *"peanut allergy — EpiPen in backpack."* A schema with a notes field on a child is a schema that stores health information; the only question is when.

Age is an **integer year**, never derived from a birth date, because we do not have a birth date and must never acquire one.

**This is enforced structurally, not by policy.** The `children` table has no such columns and the `Child` type has no such fields, so no code path can persist one. A ticket asking for one of these fields is escalated to the humans before any migration is written.

### 2. Sensitive family data lives in the browser and never leaves it
Form-fill data — emergency contacts, insurance, physician, medical history — is stored **in browser storage only**, in `src/lib/vault/`.

- It is never sent to Supabase, never logged, never included in an error report, and never present in a server component's props.
- The boundary is structural: vault modules carry a `server-only` guard, so importing one from server code is a **build error**, not a review comment somebody might miss.
- **Cross-device sync is explicitly out of scope and requires a new ADR plus a conversation with the humans.** Sync means server-side storage of precisely the data this ADR exists to avoid. It is not an implementation detail and no agent may treat it as one.

## Consequences
- **+** A breach of Campout's database exposes first names, ages, and camp schedules. Bad, and survivable. It cannot expose a child's medical information, because the information is not there.
- **+** The compliance surface stays small enough for two part-time people to actually hold.
- **−** The vault is per-device. A parent who switches phones re-enters it. **This is the accepted cost, not a bug to fix**, and the UI should set that expectation rather than apologize for it.
- **−** Some otherwise plausible capabilities are off the table. That is the point.
