# 4. Authorization: Supabase Auth + Row Level Security as a tested boundary

- Status: Accepted
- Date: 2026-09-14

## Context
Campout holds one genuinely sensitive thing: which children belong to which family, and where those children will physically be on a given day in July. The volume is small. The sensitivity is not.

Authorization could live in the application layer (every query filters by household) or in the database (RLS policies the database enforces regardless of what the query says). Application-layer filtering fails open — one forgotten `WHERE household_id = $1` and household B reads household A's children. Database-layer filtering fails closed.

Supabase's model assumes RLS. Working against that assumption means fighting the platform.

## Decision
**Supabase Auth (magic link) for identity; Row Level Security for authorization on every user-data table.**

- Magic link, no passwords. Fewer credentials to leak, and nothing to reset for a family beta.
- **Every table holding household or child data has RLS enabled in the migration that creates it.** A table shipped with RLS disabled is a release-blocking bug.
- Policies key off `auth.uid()` resolved through `household_members`, so household membership is the single access primitive.
- **Reference data — `camps`, `locations`, `sessions`, `school_calendars` — is world-readable and writable only by the service role.** This is deliberate: the catalog is the public half of the product, and keeping it out of the policy surface keeps the policies that matter small enough to reason about.

### Policies are tested code
This is the part that makes the decision real rather than aspirational.

- Policy tests ship **in the same PR as the table**.
- Tests run against a local Supabase instance with **two real households and two real JWTs**.
- **The required assertion is the negative case:** household B reaching for household A's children gets **zero rows**, not an error. Zero rows is what a correct policy produces; an error usually means the query failed for an unrelated reason and the test is proving nothing.
- **⛔ The service-role key bypasses every policy and never appears in application code.** It belongs to migrations and local seed scripts.

## Consequences
- **+** A forgotten filter in application code is not a data breach.
- **+** The boundary is one reviewable place — the migrations — rather than scattered across every query.
- **−** RLS is the sharpest edge in this stack. Policies can be subtly over-permissive in ways that look fine. The negative-case test requirement exists entirely because of this.
- **−** Debugging a policy that returns zero rows when it should return some is genuinely annoying. Budget for it.
- **−** Magic link means email deliverability becomes a dependency. Acceptable for an invited beta; revisit before any public launch.
