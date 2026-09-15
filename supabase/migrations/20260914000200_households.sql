-- Households, children, and plan entries — the private half (ADR-0004, ADR-0006).
--
-- ⛔ READ ADR-0006 BEFORE ALTERING THIS FILE. ⛔
--
-- The `children` table stores a first name or nickname, an integer age, and a
-- grade. That is the complete list, and it is enforced here rather than in the
-- UI because a rule the schema cannot express is a rule that gets added back in
-- six months by someone who did not read the ADR.
--
-- There is NO column, and there must never be a column, for:
--   a last name · a date of birth · allergies · medications · dietary
--   restrictions · a diagnosis · IEP or 504 information · a photo · or ANY
--   free-text note attached to a child.
--
-- The free-text note is the one that matters most. It looks harmless, every app
-- grows one, and it is exactly where a parent types "peanut allergy — EpiPen in
-- backpack." A schema with a notes column on a child stores health information;
-- the only open question is when.
--
-- Age is an integer year, never derived from a birth date, because we do not
-- have a birth date and must never acquire one.
--
-- A ticket asking for any of the above is escalated to the humans before a
-- migration is written. The privacy guard hook (.claude/hooks/privacy-guard.sh)
-- blocks the edit; do not work around it.

create table households (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  district      school_district not null,

  -- The workday the hours-shortfall check measures camp days against
  -- (ADR-0008). Wall-clock, like session hours.
  workday_start time        not null default '08:30',
  workday_end   time        not null default '17:30',

  -- Home, for distance search. Geocoded once, at entry (ADR-0007).
  home_point    geography(Point, 4326),

  created_at    timestamptz not null default now()
);

-- Membership is the single access primitive every policy below resolves through.
create table household_members (
  household_id  uuid        not null references households(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on household_members (user_id);

create table children (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references households(id) on delete cascade,

  -- A first name or a nickname. Never a last name.
  display_name  text        not null,
  -- An integer year. Never a birth date.
  age_years     smallint    not null,
  -- Rising grade. -1 = pre-K, 0 = kindergarten.
  grade         smallint    not null,
  -- Grid row colour. Cosmetic, and the only other thing we keep.
  color         text        not null default 'slate',

  created_at    timestamptz not null default now(),

  constraint children_age_plausible   check (age_years between 2 and 18),
  constraint children_grade_plausible check (grade between -1 and 12)
);

create index children_household_id_idx on children (household_id);

-- One cell of the planner grid: this child, at this session.
create table plan_entries (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references households(id) on delete cascade,
  child_id      uuid        not null references children(id) on delete cascade,
  session_id    uuid        not null references sessions(id) on delete cascade,
  created_at    timestamptz not null default now(),

  unique (child_id, session_id)
);

create index plan_entries_household_id_idx on plan_entries (household_id);
create index plan_entries_child_id_idx     on plan_entries (child_id);

-- ------------------------------------------------------------------ RLS
alter table households        enable row level security;
alter table household_members enable row level security;
alter table children          enable row level security;
alter table plan_entries      enable row level security;

-- Resolved through membership, so household identity is checked in exactly one
-- place. SECURITY DEFINER plus a pinned search_path: the function reads
-- household_members, which is itself RLS-protected, and without DEFINER the
-- policies below would recurse.
create function is_household_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = target and user_id = auth.uid()
  );
$$;

create policy "members read their household" on households
  for select using (is_household_member(id));
create policy "members update their household" on households
  for update using (is_household_member(id)) with check (is_household_member(id));

-- Note the absence of an INSERT policy. Households are created ONLY through
-- create_household() below, so there is no client path that produces a household
-- without its first member. See the comment on that function for why a trigger
-- cannot do this job.

create policy "members read their own membership rows" on household_members
  for select using (user_id = auth.uid() or is_household_member(household_id));
create policy "members add others to their household" on household_members
  for insert to authenticated with check (is_household_member(household_id));
create policy "members remove from their household" on household_members
  for delete using (is_household_member(household_id));

create policy "members read their children" on children
  for select using (is_household_member(household_id));
create policy "members write their children" on children
  for insert to authenticated with check (is_household_member(household_id));
create policy "members update their children" on children
  for update using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members delete their children" on children
  for delete using (is_household_member(household_id));

create policy "members read their plan" on plan_entries
  for select using (is_household_member(household_id));
create policy "members write their plan" on plan_entries
  for insert to authenticated with check (is_household_member(household_id));
create policy "members delete from their plan" on plan_entries
  for delete using (is_household_member(household_id));

-- Creating a household and its first membership row is ONE operation, and this
-- function is the only way to perform it. No INSERT policy exists on households,
-- so there is no other path — the invariant "every household has at least one
-- member" is structural rather than remembered.
--
-- This was first written as an AFTER INSERT trigger, which does not work, and the
-- reason is worth keeping: Postgres applies the SELECT policy to an INSERT's
-- RETURNING clause, evaluating it *before* AFTER-row triggers fire. The household
-- SELECT policy requires membership, the trigger had not yet created it, and so
-- `insert ... returning id` — the app's most basic write — failed with "new row
-- violates row-level security policy". The row landed; the caller could not learn
-- its id. SECURITY DEFINER sidesteps the ordering entirely by doing both inserts
-- itself.
--
-- SECURITY DEFINER runs as the function's owner, which owns these tables. Table
-- owners bypass RLS unless FORCE ROW LEVEL SECURITY is set, and it is not — so
-- both inserts here are permitted while the caller's own direct writes are not.
create function create_household(
  household_name text,
  household_district school_district
)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  created households;
  caller uuid := auth.uid();
begin
  -- SECURITY DEFINER means this function runs with elevated rights, so it must
  -- refuse an unauthenticated caller itself rather than relying on a policy.
  if caller is null then
    raise exception 'create_household requires an authenticated caller'
      using errcode = '42501';
  end if;

  insert into households (name, district)
  values (household_name, household_district)
  returning * into created;

  insert into household_members (household_id, user_id)
  values (created.id, caller);

  return created;
end;
$$;

revoke all on function create_household(text, school_district) from public, anon;
grant execute on function create_household(text, school_district) to authenticated;
