-- Data API role grants (CAM-25).
--
-- RLS restricts which ROWS a role may touch; it says nothing about whether the
-- role may touch the TABLE at all — that is a separate, coarser Postgres GRANT.
-- Supabase's "automatically expose new tables" project setting normally makes
-- that second grant for you on every new table. This project has it switched
-- off deliberately (nothing reaches the Data API just by existing), so the
-- grants it would have made are explicit here instead — one migration, each
-- grant matching exactly what the table's own RLS policies already allow.

-- Catalog: world-readable, service-role-writable (20260914000100_catalog.sql).
grant select on camps, locations, sessions, school_calendars, school_closures
  to anon, authenticated;
grant select, insert, update, delete
  on camps, locations, sessions, school_calendars, school_closures
  to service_role;

-- Households: every policy resolves through household membership, which
-- requires a real auth.uid() (20260914000200_households.sql). anon can never
-- satisfy that, so anon gets no grant here at all.
grant select, update on households to authenticated;
grant select, insert, delete on household_members to authenticated;
grant select, insert, update, delete on children to authenticated;
grant select, insert, delete on plan_entries to authenticated;

grant select, insert, update, delete
  on households, household_members, children, plan_entries
  to service_role;
