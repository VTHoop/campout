-- The catalog's review gate (CAM-27, PR 2 of 2; ADR-0017).
--
-- Catalog and calendar data now live in the database as drafts until a human
-- reviewer approves them. Five pieces, each enforced here rather than in the
-- app:
--
--   1. STATUS. providers, camps, locations, sessions and school_calendars are
--      draft, verified or archived. verified_at/by are filled by approval and
--      required only once a row is verified. Options follow their session,
--      closures their calendar.
--   2. VISIBILITY (RLS). The public reads a session only when it, its camp,
--      its provider and its location are all verified (decision 16).
--      Reviewers read everything. A household reads whatever its own plan
--      references, whatever its status, so a cell says "no longer listed"
--      rather than going blank (decision 15).
--   3. APPROVAL. approve_record() is the only thing that makes a row
--      verified, and reviewer_edit() the only thing that changes a verified
--      row's facts (decision 13). A trigger refuses everything else — even
--      the secret key. It stops mistakes, not a key holder who disables it.
--   4. HISTORY. Every write to these tables lands in catalog_history.
--   5. PLANS. A plan entry names the chosen option and can't outlive a
--      deleted session. Its tightened insert policy is the next migration,
--      20260930000200_plan_entries_options, kept apart so no file both
--      touches children and defines catalog details (the privacy guard's
--      rule, ADR-0006).
--
-- The gate flag: approve_record() and reviewer_edit() set the transaction-local
-- setting campout.catalog_gate to 'on' around their own writes, and the guard
-- trigger lets a write through only while it is on. set_config(…, true) ends
-- with the transaction. A client can't set it: PostgREST exposes no way to run
-- set_config. The seed sets it to load verified rows.
--
-- Nothing is migrated: the live project holds no catalog or plan rows.

-- ------------------------------------------------------------------- types

create type record_status as enum ('draft', 'verified', 'archived');

-- What approve_record() and reviewer_edit() act on. Options and closures have
-- no status of their own, so only reviewer_edit() takes them.
create type catalog_record_kind as enum (
  'provider', 'camp', 'location', 'session', 'session_option',
  'school_calendar', 'school_closure'
);

-- ------------------------------------------------------------------ status
-- Evidence stays required on every row, drafts included (ADR-0012): a draft
-- comes from somewhere. Verification is required only to be verified.

alter table providers
  add column status record_status not null default 'draft',
  alter column verified_at drop not null,
  alter column verified_by drop not null,
  add constraint providers_verified_recorded
    check (status <> 'verified' or (verified_at is not null and verified_by is not null));

alter table camps
  add column status record_status not null default 'draft',
  alter column verified_at drop not null,
  alter column verified_by drop not null,
  add constraint camps_verified_recorded
    check (status <> 'verified' or (verified_at is not null and verified_by is not null));

alter table sessions
  add column status record_status not null default 'draft',
  alter column verified_at drop not null,
  alter column verified_by drop not null,
  add constraint sessions_verified_recorded
    check (status <> 'verified' or (verified_at is not null and verified_by is not null));

alter table school_calendars
  add column status record_status not null default 'draft',
  alter column verified_at drop not null,
  alter column verified_by drop not null,
  add constraint school_calendars_verified_recorded
    check (status <> 'verified' or (verified_at is not null and verified_by is not null));

-- Locations gain their own status (decision 16) — a location can be a private
-- host's home, so a draft one must not be world-readable — and with it the
-- same evidence and verification columns as everything else.
alter table locations
  add column status record_status not null default 'draft',
  add column source_url           text,
  add column source_document_path text,
  add column verified_at          timestamptz,
  add column verified_by          text,
  add constraint locations_provenance_present
    check (source_url is not null or source_document_path is not null),
  add constraint locations_verified_recorded
    check (status <> 'verified' or (verified_at is not null and verified_by is not null));

-- --------------------------------------------------------------- reviewers
-- Who may read drafts and approve. Managed with the secret key; no client
-- reads or writes it, so RLS is on with no policies. is_reviewer() reads it
-- for them.
create table reviewers (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  -- What approve_record() writes into verified_by. A name or initials.
  display_name text not null,
  created_at   timestamptz not null default now()
);

alter table reviewers enable row level security;

-- The same shape as is_household_member() (ADR-0004): SECURITY DEFINER with a
-- pinned search_path, so policies can call it without reading reviewers
-- themselves.
create function is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from reviewers where user_id = auth.uid());
$$;

-- ------------------------------------------------------------ plan entries
-- Decision 15: a plan entry records the session AND the chosen option, and a
-- family's plan is never silently deleted by a catalog change. A referenced
-- session or option is archived, not deleted; `on delete restrict` refuses
-- the delete (it used to cascade).

alter table session_options
  add constraint session_options_id_session_unique unique (id, session_id);

alter table plan_entries
  drop constraint plan_entries_session_id_fkey,
  add constraint plan_entries_session_id_fkey
    foreign key (session_id) references sessions (id) on delete restrict,
  add column option_id uuid not null,
  -- The option must belong to the planned session.
  add constraint plan_entries_option_fkey
    foreign key (option_id, session_id) references session_options (id, session_id)
    on delete restrict;

create index plan_entries_session_id_idx on plan_entries (session_id);
create index plan_entries_option_idx     on plan_entries (option_id, session_id);

-- ------------------------------------------------------- chain predicates
-- SECURITY DEFINER so a policy can ask about a parent row without that row's
-- own policy applying (which would recurse). Each returns only a boolean.

create function provider_is_public(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from providers where id = target and status = 'verified');
$$;

create function location_is_public(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from locations where id = target and status = 'verified');
$$;

create function camp_is_public(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from camps
    where id = target and status = 'verified' and provider_is_public(provider_id)
  );
$$;

-- The whole chain (decision 16): the session, its camp, the camp's provider,
-- and its location.
create function session_is_public(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from sessions
    where id = target
      and status = 'verified'
      and camp_is_public(camp_id)
      and location_is_public(location_id)
  );
$$;

-- Whether the caller's own household has planned something that reaches this
-- row (decision 15). Starts from the caller's memberships, so an anonymous
-- visitor costs one empty index lookup.
create function plan_references(kind catalog_record_kind, target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from household_members hm
    join plan_entries pe on pe.household_id = hm.household_id
    join sessions s on s.id = pe.session_id
    join camps c on c.id = s.camp_id
    where hm.user_id = auth.uid()
      and case kind
            when 'session'        then s.id = target
            when 'session_option' then pe.option_id = target
            when 'camp'           then c.id = target
            when 'provider'       then c.provider_id = target
            when 'location'       then s.location_id = target
            else false
          end
  );
$$;

-- --------------------------------------------------------------- policies
-- `(select is_reviewer())`, not a bare call: it takes no row argument, so the
-- subquery runs once per statement instead of once per row.
--
-- Replaces every "catalog is world readable" policy (20260914000100,
-- 20260929000100). Still no write policy anywhere: writes are the secret key's,
-- or the two reviewer functions'.

drop policy "catalog is world readable" on providers;
drop policy "catalog is world readable" on camps;
drop policy "catalog is world readable" on locations;
drop policy "catalog is world readable" on sessions;
drop policy "catalog is world readable" on session_options;
drop policy "catalog is world readable" on school_calendars;
drop policy "catalog is world readable" on school_closures;

create policy "verified, or a reviewer, or in my plan" on providers
  for select using (
    status = 'verified' or (select is_reviewer()) or plan_references('provider', id)
  );

create policy "verified chain, or a reviewer, or in my plan" on camps
  for select using (
    (status = 'verified' and provider_is_public(provider_id))
    or (select is_reviewer())
    or plan_references('camp', id)
  );

create policy "verified, or a reviewer, or in my plan" on locations
  for select using (
    status = 'verified' or (select is_reviewer()) or plan_references('location', id)
  );

create policy "verified chain, or a reviewer, or in my plan" on sessions
  for select using (
    (status = 'verified' and camp_is_public(camp_id) and location_is_public(location_id))
    or (select is_reviewer())
    or plan_references('session', id)
  );

create policy "its session is public, or a reviewer, or in my plan" on session_options
  for select using (
    session_is_public(session_id) or (select is_reviewer()) or plan_references('session_option', id)
  );

create policy "verified, or a reviewer" on school_calendars
  for select using (status = 'verified' or (select is_reviewer()));

-- Through the calendar's own policy: a closure is visible when its calendar is.
create policy "its calendar is visible" on school_closures
  for select using (
    exists (select 1 from school_calendars c where c.id = school_closures.calendar_id)
  );

-- ------------------------------------------------------------ guard trigger
-- Refuses, outside the gate:
--   · an insert that is verified or names a verifier;
--   · an update that makes a row verified or touches verified_at/by;
--   · an update to a verified row's facts — everything but its status;
--   · a delete of a verified row: archive it, or put it back to draft first.
--     A delete unpublishes as surely as an edit, and cascades.
-- A status-only change away from verified is allowed: it unpublishes, never
-- publishes, and it is how a row is archived or put back to draft.
--
-- ⛔ This guards against mistakes. Anyone holding the secret key can disable
-- the trigger or open the gate; that key stays out of application code.

create function catalog_gate_is_open()
returns boolean
language sql stable
as $$
  select coalesce(current_setting('campout.catalog_gate', true), '') = 'on';
$$;

create function guard_catalog_write()
returns trigger
language plpgsql
as $$
begin
  if catalog_gate_is_open() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'verified' then
      raise exception 'a verified % row can''t be deleted; archive it instead', tg_table_name
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'verified' or new.verified_at is not null or new.verified_by is not null then
      raise exception 'only approve_record() can verify a % row', tg_table_name
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.status = 'verified' and old.status <> 'verified')
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by then
    raise exception 'only approve_record() can verify a % row', tg_table_name
      using errcode = '42501';
  end if;

  -- Facts are every column but status and the ones Postgres maintains.
  if old.status = 'verified'
     and (to_jsonb(new) - '{status,updated_at,address_key}'::text[])
         is distinct from (to_jsonb(old) - '{status,updated_at,address_key}'::text[]) then
    raise exception 'a verified % row changes only through reviewer_edit()', tg_table_name
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard_catalog_write before insert or update or delete on providers
  for each row execute function guard_catalog_write();
create trigger guard_catalog_write before insert or update or delete on camps
  for each row execute function guard_catalog_write();
create trigger guard_catalog_write before insert or update or delete on locations
  for each row execute function guard_catalog_write();
create trigger guard_catalog_write before insert or update or delete on sessions
  for each row execute function guard_catalog_write();
create trigger guard_catalog_write before insert or update or delete on school_calendars
  for each row execute function guard_catalog_write();

-- Options and closures have no status: they are facts of their parent. Any
-- insert, update or delete touching a verified session's options, or a
-- verified calendar's closures, is refused outside the gate. SECURITY DEFINER
-- so the parent's status is read past RLS.
create function refuse_if_session_verified(target uuid)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  -- A session already gone is a cascade from its own delete: nothing to guard.
  if exists (select 1 from sessions where id = target and status = 'verified') then
    raise exception 'a verified session''s options change only through reviewer_edit()'
      using errcode = '42501';
  end if;
end;
$$;

create function refuse_if_calendar_verified(target uuid)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if exists (select 1 from school_calendars where id = target and status = 'verified') then
    raise exception 'a verified calendar''s closures change only through reviewer_edit()'
      using errcode = '42501';
  end if;
end;
$$;

create function guard_session_option_write()
returns trigger
language plpgsql
as $$
begin
  if not catalog_gate_is_open() then
    if tg_op in ('UPDATE', 'DELETE') then
      perform refuse_if_session_verified(old.session_id);
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      perform refuse_if_session_verified(new.session_id);
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function guard_school_closure_write()
returns trigger
language plpgsql
as $$
begin
  if not catalog_gate_is_open() then
    if tg_op in ('UPDATE', 'DELETE') then
      perform refuse_if_calendar_verified(old.calendar_id);
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      perform refuse_if_calendar_verified(new.calendar_id);
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger guard_session_option_write before insert or update or delete on session_options
  for each row execute function guard_session_option_write();
create trigger guard_school_closure_write before insert or update or delete on school_closures
  for each row execute function guard_school_closure_write();

-- ----------------------------------------------------------------- approval
-- The only path to `verified`. Checks is_reviewer() itself (ADR-0011's
-- pattern: a DEFINER function refuses an unauthorized caller, rather than
-- relying on a policy), refuses what isn't ready, then sets status,
-- verified_at and verified_by and nothing else.
--
-- Approving a verified row again re-dates it: the reviewer checked it today.

create function assert_approvable(
  record_kind       catalog_record_kind,
  record_id         uuid,
  confirm_long_span boolean
)
returns void
language plpgsql stable security definer set search_path = public
as $$
declare
  target sessions;
  span   integer;
begin
  -- A missing row falls through to approve_record(), which reports it.
  if record_kind = 'camp'
     and exists (
       select 1 from camps
       where id = record_id and not provider_is_public(provider_id)
     ) then
    raise exception 'approve the camp''s provider first' using errcode = '55000';
  end if;

  if record_kind <> 'session' then
    return;
  end if;

  select * into target from sessions where id = record_id;
  if not found then
    return;  -- approve_record() reports the missing row
  end if;
  if not (camp_is_public(target.camp_id) and location_is_public(target.location_id)) then
    raise exception 'approve the session''s camp, provider and location first'
      using errcode = '55000';
  end if;
  if not exists (select 1 from session_options where session_id = record_id) then
    raise exception 'a session needs at least one time option' using errcode = '55000';
  end if;
  -- Most camps run one week, occasionally two. Longer is usually a weekly
  -- class or a mistyped end date, so the reviewer must say they checked.
  span := target.end_date - target.start_date + 1;
  if span > 14 and not confirm_long_span then
    raise exception 'the session spans % days; confirm it before approving', span
      using errcode = '55000';
  end if;
end;
$$;

create function approve_record(
  record_kind       catalog_record_kind,
  record_id         uuid,
  confirm_long_span boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer_name text;
begin
  select display_name into reviewer_name from reviewers where user_id = auth.uid();
  if reviewer_name is null then
    raise exception 'only a reviewer can approve' using errcode = '42501';
  end if;

  perform assert_approvable(record_kind, record_id, confirm_long_span);

  perform set_config('campout.catalog_gate', 'on', true);
  case record_kind
    when 'provider' then
      update providers set status = 'verified', verified_at = now(), verified_by = reviewer_name
      where id = record_id;
    when 'camp' then
      update camps set status = 'verified', verified_at = now(), verified_by = reviewer_name
      where id = record_id;
    when 'location' then
      update locations set status = 'verified', verified_at = now(), verified_by = reviewer_name
      where id = record_id;
    when 'session' then
      update sessions set status = 'verified', verified_at = now(), verified_by = reviewer_name
      where id = record_id;
    when 'school_calendar' then
      update school_calendars
      set status = 'verified', verified_at = now(), verified_by = reviewer_name
      where id = record_id;
    else
      raise exception 'a % has no status of its own; approve its parent', record_kind
        using errcode = '22023';
  end case;
  if not found then
    raise exception 'no % with id %', record_kind, record_id using errcode = 'P0002';
  end if;
  perform set_config('campout.catalog_gate', '', true);
end;
$$;

-- ------------------------------------------------------------ reviewer edit
-- Decision 13: a reviewer edits a row's facts and the row stays as it was —
-- verified stays verified, so nothing is unpublished by an edit. The change is
-- recorded in catalog_history by the history trigger, like any other write.
--
-- `changes` is a JSON object of column → new value. Only the columns listed
-- per kind below are facts; anything else (status, verified_*, ids, unknown
-- names) is refused rather than ignored. Each update names its columns
-- statically and merges `changes` over the current row with
-- jsonb_populate_record, so there is no dynamic SQL. Every check constraint
-- still applies.
--
-- verified_at and verified_by are left alone: the reviewer checked the changed
-- facts, not the whole record. Re-approve to re-date it.

-- ⛔ Each kind's facts are written three times: here, and in reviewer_edit()'s
-- SET and SELECT lists. Change all three together when a table gains a column;
-- catalog-review.rls.test.ts fails if a column is in none of them.
create function editable_columns(record_kind catalog_record_kind)
returns text[]
language sql immutable
as $$
  select case record_kind
    when 'provider' then
      '{name,website_url,phone,email,source_url,source_document_path}'::text[]
    when 'camp' then
      '{provider_id,name,summary,categories,registration_url,registration_note,details,source_url,source_document_path}'::text[]
    when 'location' then
      '{label,street,city,state,postal_code,district,point,source_url,source_document_path}'::text[]
    when 'session' then
      '{camp_id,location_id,theme,start_date,end_date,closed_dates,min_age,max_age,min_grade,max_grade,capacity_note,details,source_url,source_document_path}'::text[]
    when 'session_option' then
      '{kind,price_cents,price_note,daily_start,daily_end,earliest_dropoff,latest_pickup,details}'::text[]
    when 'school_calendar' then
      '{district,type,school,label,first_instructional_day,last_instructional_day,covers_from,covers_to,source_url,source_document_path}'::text[]
    when 'school_closure' then
      '{start_date,end_date,tags,source_label,common_name}'::text[]
  end;
$$;

create function reviewer_edit(
  record_kind catalog_record_kind,
  record_id   uuid,
  changes     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  refused text;
begin
  if not is_reviewer() then
    raise exception 'only a reviewer can edit through reviewer_edit()' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) is distinct from 'object' then
    raise exception 'changes must be a JSON object' using errcode = '22023';
  end if;
  select key into refused
  from jsonb_object_keys(changes) as key
  where key <> all (editable_columns(record_kind))
  limit 1;
  if refused is not null then
    raise exception '% is not an editable fact of a %', refused, record_kind
      using errcode = '22023';
  end if;

  perform set_config('campout.catalog_gate', 'on', true);
  case record_kind
    when 'provider' then
      update providers t
      set (name, website_url, phone, email, source_url, source_document_path) = (
            select r.name, r.website_url, r.phone, r.email, r.source_url, r.source_document_path
            from jsonb_populate_record(t, changes) r),
          updated_at = now()
      where t.id = record_id;
    when 'camp' then
      update camps t
      set (provider_id, name, summary, categories, registration_url, registration_note,
           details, source_url, source_document_path) = (
            select r.provider_id, r.name, r.summary, r.categories, r.registration_url,
                   r.registration_note, r.details, r.source_url, r.source_document_path
            from jsonb_populate_record(t, changes) r),
          updated_at = now()
      where t.id = record_id;
    when 'location' then
      update locations t
      set (label, street, city, state, postal_code, district, point,
           source_url, source_document_path) = (
            select r.label, r.street, r.city, r.state, r.postal_code, r.district, r.point,
                   r.source_url, r.source_document_path
            from jsonb_populate_record(t, changes) r)
      where t.id = record_id;
    when 'session' then
      update sessions t
      set (camp_id, location_id, theme, start_date, end_date, closed_dates, min_age, max_age,
           min_grade, max_grade, capacity_note, details, source_url, source_document_path) = (
            select r.camp_id, r.location_id, r.theme, r.start_date, r.end_date, r.closed_dates,
                   r.min_age, r.max_age, r.min_grade, r.max_grade, r.capacity_note, r.details,
                   r.source_url, r.source_document_path
            from jsonb_populate_record(t, changes) r),
          updated_at = now()
      where t.id = record_id;
    when 'session_option' then
      update session_options t
      set (kind, price_cents, price_note, daily_start, daily_end, earliest_dropoff,
           latest_pickup, details) = (
            select r.kind, r.price_cents, r.price_note, r.daily_start, r.daily_end,
                   r.earliest_dropoff, r.latest_pickup, r.details
            from jsonb_populate_record(t, changes) r),
          updated_at = now()
      where t.id = record_id;
    when 'school_calendar' then
      update school_calendars t
      set (district, type, school, label, first_instructional_day, last_instructional_day,
           covers_from, covers_to, source_url, source_document_path) = (
            select r.district, r.type, r.school, r.label, r.first_instructional_day,
                   r.last_instructional_day, r.covers_from, r.covers_to, r.source_url,
                   r.source_document_path
            from jsonb_populate_record(t, changes) r)
      where t.id = record_id;
    when 'school_closure' then
      update school_closures t
      set (start_date, end_date, tags, source_label, common_name) = (
            select r.start_date, r.end_date, r.tags, r.source_label, r.common_name
            from jsonb_populate_record(t, changes) r)
      where t.id = record_id;
  end case;
  if not found then
    raise exception 'no % with id %', record_kind, record_id using errcode = 'P0002';
  end if;
  perform set_config('campout.catalog_gate', '', true);
end;
$$;

-- --------------------------------------------------- location duplicates
-- Narrowed to reviewers, now that is_reviewer() exists (20260929000100 left
-- it to any signed-in user until then).
create or replace function find_location_duplicates(target_id uuid)
returns setof locations
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not is_reviewer() then
    raise exception 'find_location_duplicates is for reviewers' using errcode = '42501';
  end if;
  return query
    select other.*
    from locations target
    join locations other
      on other.id <> target.id
     and (other.address_key = target.address_key
          or st_dwithin(other.point, target.point, 30))
    where target.id = target_id
    order by other.id;
end;
$$;

-- ------------------------------------------------------------------- search
-- search_sessions() (20260929000100) ran as the caller, so RLS applied. Two
-- reasons it now runs as definer and applies the chain itself:
--
--   · Speed. RLS must be evaluated before a caller's non-leakproof filters,
--     and range && and array && are not leakproof, so under these policies
--     the date and category filters could no longer use sessions_dates_idx
--     or camps_categories_idx: every search scanned every session.
--   · Scope. Decision 15's "in my plan" read is for a family's own grid. In
--     search it would list a session the family planned that is no longer
--     listed.
--
-- So: the verified chain, or a reviewer (who previews drafts through the
-- same query a parent uses, ADR-0017). Nothing else. catalog-review.rls.test.ts
-- holds this in step with the table policies.
create or replace function search_sessions(
  window_start      date            default null,
  window_end        date            default null,
  wanted_categories camp_category[] default null,
  max_price_cents   integer         default null
)
returns table (
  session_id       uuid,
  camp_id          uuid,
  location_id      uuid,
  start_date       date,
  end_date         date,
  theme            text,
  from_price_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.camp_id, s.location_id, s.start_date, s.end_date, s.theme,
    (select min(o.price_cents) from session_options o where o.session_id = s.id)
  from sessions s
  join camps c     on c.id = s.camp_id
  join providers p on p.id = c.provider_id
  join locations l on l.id = s.location_id
  -- A null bound makes the range open on that side.
  where daterange(s.start_date, s.end_date, '[]') && daterange(window_start, window_end, '[]')
    and (wanted_categories is null or c.categories && wanted_categories)
    and (max_price_cents is null or exists (
      select 1 from session_options o
      where o.session_id = s.id and o.price_cents <= max_price_cents
    ))
    and (
      (s.status = 'verified' and c.status = 'verified'
       and p.status = 'verified' and l.status = 'verified')
      or (select is_reviewer())
    )
  order by s.start_date, s.id;
$$;

-- ------------------------------------------------------------------ history
-- Every insert, update and delete on the catalog and calendar tables (ADR-0017
-- §4). This replaces the PR diff as the record of what changed and who did it.
create table catalog_history (
  id              bigint generated always as identity primary key,
  table_name      text        not null,
  row_id          uuid        not null,
  action          text        not null check (action in ('insert', 'update', 'delete')),
  -- The signed-in user behind the write: the reviewer, for an approval or a
  -- reviewer edit. Null for a script with the secret key, or the seed.
  changed_by      uuid,
  -- The API role behind the write (service_role, authenticated), or the
  -- database user when there was none (postgres, for the seed).
  changed_by_role text        not null,
  changed_at      timestamptz not null default now(),
  old_row         jsonb,
  new_row         jsonb
);

create index catalog_history_row_idx on catalog_history (row_id, id);

alter table catalog_history enable row level security;

create policy "reviewers read history" on catalog_history
  for select using ((select is_reviewer()));

-- SECURITY DEFINER so the row is written whoever made the change; no client
-- has a write grant on catalog_history.
create function record_catalog_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
begin
  insert into catalog_history
    (table_name, row_id, action, changed_by, changed_by_role, old_row, new_row)
  values (
    tg_table_name,
    (coalesce(after_row, before_row) ->> 'id')::uuid,
    lower(tg_op),
    auth.uid(),
    coalesce(auth.jwt() ->> 'role', session_user),
    before_row,
    after_row
  );
  return null;
end;
$$;

create trigger record_catalog_history after insert or update or delete on providers
  for each row execute function record_catalog_history();
create trigger record_catalog_history after insert or update or delete on camps
  for each row execute function record_catalog_history();
create trigger record_catalog_history after insert or update or delete on locations
  for each row execute function record_catalog_history();
create trigger record_catalog_history after insert or update or delete on sessions
  for each row execute function record_catalog_history();
create trigger record_catalog_history after insert or update or delete on session_options
  for each row execute function record_catalog_history();
create trigger record_catalog_history after insert or update or delete on school_calendars
  for each row execute function record_catalog_history();
create trigger record_catalog_history after insert or update or delete on school_closures
  for each row execute function record_catalog_history();

-- ------------------------------------------------------------------- grants
-- Policies call these, so every role that reads the catalog needs execute.
revoke all on function is_reviewer() from public;
revoke all on function provider_is_public(uuid) from public;
revoke all on function location_is_public(uuid) from public;
revoke all on function camp_is_public(uuid) from public;
revoke all on function session_is_public(uuid) from public;
revoke all on function plan_references(catalog_record_kind, uuid) from public;
grant execute on function
  is_reviewer(), provider_is_public(uuid), location_is_public(uuid), camp_is_public(uuid),
  session_is_public(uuid), plan_references(catalog_record_kind, uuid)
  to anon, authenticated, service_role;

-- The reviewer functions check is_reviewer() themselves; anon never calls them.
revoke all on function approve_record(catalog_record_kind, uuid, boolean) from public, anon;
revoke all on function reviewer_edit(catalog_record_kind, uuid, jsonb) from public, anon;
grant execute on function approve_record(catalog_record_kind, uuid, boolean)
  to authenticated, service_role;
grant execute on function reviewer_edit(catalog_record_kind, uuid, jsonb)
  to authenticated, service_role;

-- Internal: called only from the functions and triggers above.
revoke all on function assert_approvable(catalog_record_kind, uuid, boolean)
  from public, anon, authenticated;
revoke all on function refuse_if_session_verified(uuid) from public, anon, authenticated;
revoke all on function refuse_if_calendar_verified(uuid) from public, anon, authenticated;
revoke all on function editable_columns(catalog_record_kind) from public, anon, authenticated;

grant select, insert, update, delete on reviewers to service_role;
-- anon too, so a refused read is zero rows rather than a table-level error,
-- as for the household tables (20260923000200).
grant select on catalog_history to anon, authenticated;
grant select, insert, update, delete on catalog_history to service_role;
