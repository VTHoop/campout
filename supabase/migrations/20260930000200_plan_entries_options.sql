-- The plan-entry insert policy (CAM-27 decision 15). Follows
-- 20260930000100_catalog_review_gate.sql, which adds plan_entries.option_id
-- and the session_is_public() this policy uses.
--
-- Kept in its own file so no migration both touches children and defines the
-- catalog's details columns (.claude/hooks/privacy-guard.sh, ADR-0006).
--
-- The old insert policy checked only household_id, so a member could name
-- another household's child or any session at all.
drop policy "members write their plan" on plan_entries;
create policy "members plan their own children into verified sessions" on plan_entries
  for insert to authenticated with check (
    is_household_member(household_id)
    and exists (
      select 1 from children ch
      where ch.id = plan_entries.child_id and ch.household_id = plan_entries.household_id
    )
    and session_is_public(session_id)
  );
