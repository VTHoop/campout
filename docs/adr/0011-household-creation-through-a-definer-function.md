# 11. Household creation goes through a SECURITY DEFINER function

- Status: Accepted
- Date: 2026-09-15

## Context
A household is useless without at least one member: the RLS policies in ADR-0004 all resolve through `is_household_member()`, so a household with no members is a row nobody — including its creator — can read, update, or delete. Creating the household and creating its first membership row have to be one operation.

The obvious implementation was a permissive `INSERT` policy on `households` plus an `AFTER INSERT` trigger adding the creator to `household_members`. That is what shipped in the original migration, and **it does not work.**

Postgres applies the **SELECT** policy to an `INSERT`'s `RETURNING` clause, and evaluates it *before* `AFTER`-row triggers fire. The household SELECT policy requires membership. The trigger had not yet created it. So `insert … returning id` — the single most basic write the app performs, and what every Supabase client emits when you chain `.select()` — failed with `new row violates row-level security policy for table "households"`. The row was inserted; the caller could not learn its id.

**The RLS policy suite found this on its first run.** No amount of reading the policies in isolation would have: each one is individually correct, and the bug lives in the interaction between policy evaluation order and trigger timing.

## Decision
`households` has **no `INSERT` policy at all**. Households are created only through `create_household(household_name, household_district)`, a `SECURITY DEFINER` function that inserts both rows itself and returns the new household.

- **`SECURITY DEFINER` runs as the function's owner**, which owns these tables. Table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is set, and it is not — so the function's two inserts are permitted while the caller's own direct writes are not.
- Because it runs with elevated rights, **the function checks `auth.uid()` itself** and raises `42501` on an unauthenticated caller rather than relying on a policy that no longer applies to it.
- `EXECUTE` is granted to `authenticated` and revoked from `public` and `anon`.

This is the "structural over remembered" principle from `AGENTS.md`: the invariant is not "remember to add a membership row", it is "there is exactly one way to create a household, and it does both".

## Consequences
- **+** A household without a member is unreachable by construction, not by convention.
- **+** The client's create path is one RPC call rather than an insert whose success depends on trigger timing.
- **+** Direct inserts are refused for everyone, so there is no second path to keep in step.
- **−** `SECURITY DEFINER` is elevated code and deserves the scrutiny that implies. Mitigated by keeping it short, pinning `search_path`, checking the caller explicitly, and covering both the happy path and the unauthenticated case in the policy suite.
- **−** Adding a member to an *existing* household still goes through the `household_members` INSERT policy, so there are two mechanisms for two different operations. They are genuinely different — one bootstraps, one extends — but the distinction has to be understood rather than inferred.
- **−** Any future table with a policy that depends on a row written by a trigger has the same trap. The general lesson: **if a policy depends on state a trigger creates, the trigger is too late.**
