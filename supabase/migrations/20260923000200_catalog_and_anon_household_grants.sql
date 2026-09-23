-- Follow-up to 20260923000100_data_api_grants.sql: two gaps the RLS suite
-- caught when run against the live project (CAM-25) that local Docker's
-- implicit default privileges had been papering over.

-- Catalog write grants: RLS is the write boundary here, not the grant — see
-- 20260914000100_catalog.sql's own header comment. Without INSERT/UPDATE/
-- DELETE granted to anon and authenticated, a blocked write surfaces as a flat
-- "permission denied for table" instead of the specific "matched no rows" /
-- row-level-security-policy-violation behavior supabase/tests/catalog.rls.test.ts
-- expects — no write policy exists on any catalog table, so the grant alone
-- does not open a path; RLS still blocks every row.
grant insert, update, delete
  on camps, locations, sessions, school_calendars, school_closures
  to anon, authenticated;

-- Household select grants for anon: every select policy on these four tables
-- resolves through is_household_member()/auth.uid(), which is always false
-- for an unauthenticated caller — so anon can run the query and correctly see
-- nothing, rather than hitting a table-level wall before RLS ever runs.
grant select on households, household_members, children, plan_entries to anon;
