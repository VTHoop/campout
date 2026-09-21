-- Campout catalog: the public half of the product (ADR-0002, ADR-0004).
--
-- Two shapes matter here, and the rest follows from them:
--
--   1. A CAMP is an organization. A SESSION is a dated offering. The directory
--      searches sessions, because a parent shops for "the week of July 12", not
--      for an organization. Nearly every planner query starts at sessions.
--   2. Every camp and every session carries PROVENANCE: who verified it, when,
--      and what they verified it against. Campout lists camps; it does not vet or
--      endorse them, and these columns are how that posture is made true in the
--      data rather than merely stated in the terms (AGENTS.md §2).
--
--      The evidence is a source_url OR a stored document, never neither — a camp
--      whose only published information is a paper flyer or a phone call is still
--      listable, but somebody has to have kept a copy of what it said. A written
--      claim with nothing behind it is not evidence.
--
-- Catalog tables are world-readable and service-role-writable. That is deliberate:
-- keeping the public catalog out of the policy surface keeps the policies that do
-- matter — the household ones — small enough to reason about.

create extension if not exists postgis;
-- Lets the exclusion constraint on school_closures compare a uuid with `=` inside
-- a GiST index. Without it that constraint cannot be created (ADR-0013).
create extension if not exists btree_gist;

create type camp_category as enum (
  'sports', 'arts', 'academic', 'stem', 'nature_outdoors',
  'day_camp', 'specialty', 'faith_based', 'theater_music'
);

create type school_district as enum (
  'richmond_city', 'chesterfield', 'henrico', 'hanover'
);

-- How a school year is shaped (ADR-0013). An expectation signal for the UI, not a
-- second algorithm: a year-round calendar is promised intersessions, not a summer.
create type calendar_type as enum ('traditional', 'year_round');

-- Facts a district attaches to a closed day. A closure carries a set of them.
create type closure_tag as enum ('holiday', 'teacher_workday', 'conference_day', 'break');

-- ---------------------------------------------------------------- camps
create table camps (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  -- A short summary WE wrote. ⛔ Never paste a camp's marketing copy here —
  -- that is someone else's copyrighted text in a public repo (ADR-0010).
  summary       text,
  -- Nullable on purpose. A church, a rec league, or a neighbour running a soccer
  -- week may have no site at all, and those are exactly the camps no existing
  -- Richmond directory carries.
  website_url   text,
  phone         text,
  email         text,

  -- Provenance (ADR-0012). verified_at/by are always required. The evidence is
  -- either a URL or a document kept in the camp-sources bucket — see the check
  -- constraint below.
  --
  -- source_document_path is an OBJECT KEY INSIDE the camp-sources bucket, with no
  -- bucket prefix: 'parish-hall-2027-flyer.jpg', not 'camp-sources/…'.
  --
  -- The constraint below checks only that one of the two columns is non-null. It
  -- does NOT parse the path or confirm the object exists, and deliberately so —
  -- a storage lookup in a CHECK constraint would be both impossible and wrong.
  -- A path pointing at a file nobody uploaded is a data-quality bug for the
  -- verification workflow to prevent, not something Postgres will catch.
  source_url            text,
  source_document_path  text,
  verified_at           timestamptz not null,
  verified_by           text        not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint camps_provenance_present
    check (source_url is not null or source_document_path is not null)
);

-- ------------------------------------------------------------ locations
-- A camp may run at several sites. Geocoding happens once, at verification
-- time, never at query time (ADR-0007).
create table locations (
  id            uuid primary key default gen_random_uuid(),
  camp_id       uuid        not null references camps(id) on delete cascade,
  label         text        not null,
  street        text        not null,
  city          text        not null,
  state         text        not null default 'VA',
  postal_code   text        not null,
  district      school_district,
  point         geography(Point, 4326) not null,
  created_at    timestamptz not null default now()
);

create index locations_camp_id_idx on locations (camp_id);
-- GiST, so ST_DWithin can use it. ⛔ ST_Distance in a WHERE clause cannot, and
-- will table-scan every location on the product's main search.
create index locations_point_idx on locations using gist (point);

-- ------------------------------------------------------------- sessions
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  camp_id       uuid        not null references camps(id) on delete cascade,
  location_id   uuid        not null references locations(id) on delete restrict,
  name          text        not null,
  category      camp_category not null,

  -- Calendar dates, never timestamps. A camp running June 15–19 runs those days
  -- in Richmond regardless of the reader's timezone (ADR-0008).
  start_date    date        not null,
  end_date      date        not null,

  -- Wall-clock times, compared against the household workday in the same space.
  daily_start   time        not null,
  daily_end     time        not null,
  before_care_start time,
  after_care_end    time,

  min_age       smallint,
  max_age       smallint,
  min_grade     smallint,
  max_grade     smallint,

  -- ⛔ Integer cents. Never a float.
  price_cents   integer,
  price_note    text,

  -- Nullable: plenty of camps take a paper form, a phone call, or a walk-in.
  -- registration_note carries the instructions when there is no link.
  registration_url  text,
  registration_note text,
  capacity_note     text,

  -- Provenance per session, because sessions change independently of the
  -- organization that runs them (ADR-0012).
  source_url            text,
  source_document_path  text,
  verified_at           timestamptz not null,
  verified_by           text        not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint sessions_provenance_present
    check (source_url is not null or source_document_path is not null),
  -- A parent must be told how to sign up, one way or the other.
  constraint sessions_registration_reachable
    check (registration_url is not null or registration_note is not null),
  constraint sessions_dates_ordered check (end_date >= start_date),
  constraint sessions_hours_ordered check (daily_end > daily_start),
  constraint sessions_ages_ordered  check (max_age is null or min_age is null or max_age >= min_age),
  constraint sessions_price_non_negative check (price_cents is null or price_cents >= 0)
);

create index sessions_camp_id_idx    on sessions (camp_id);
create index sessions_location_id_idx on sessions (location_id);
-- The directory's primary query: sessions overlapping a week, by category.
create index sessions_start_date_idx on sessions (start_date);
create index sessions_category_idx   on sessions (category);

-- ------------------------------------------------- school_calendars
-- Reference data. The entire coverage model is meaningless without it: every
-- closed day, and therefore every coverage gap, is derived from these rows.
--
-- The rows are a transcription of what a district publishes: a first day, a last
-- day, and dated closures. Summer is NEVER stored — no district publishes it. It
-- is derived from one year's last_instructional_day and the next year's
-- first_instructional_day, so a verifier checks a row against the document in
-- front of them without doing date arithmetic (ADR-0013).
create table school_calendars (
  id       uuid primary key default gen_random_uuid(),
  district school_district not null,
  type     calendar_type   not null,
  school   text,                                  -- null = the district-wide calendar
  label    text not null,                         -- '2026-27'
  first_instructional_day date not null,
  last_instructional_day  date not null,
  -- The window this record speaks for. Outside it we do not know, and say so.
  covers_from date not null,
  covers_to   date not null,

  source_url            text,
  source_document_path  text,
  verified_at           timestamptz not null,
  verified_by           text        not null,

  -- Null-safe: a district-wide calendar has no school, and Postgres would
  -- otherwise treat two null schools as distinct and allow the year twice.
  unique nulls not distinct (district, school, label),
  constraint school_calendars_instruction_ordered
    check (last_instructional_day > first_instructional_day),
  constraint school_calendars_window check (covers_to > covers_from),
  constraint school_calendars_provenance_present
    check (source_url is not null or source_document_path is not null)
);

-- -------------------------------------------------- school_closures
-- A contiguous run of days school is shut, inclusive at both ends. A single day
-- repeats start_date as end_date.
create table school_closures (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references school_calendars (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  tags        closure_tag[] not null default '{}',
  source_label text not null,                     -- the district's exact words
  common_name  text,                              -- ours, and only with its own source
  constraint school_closures_ordered check (end_date >= start_date),
  -- Two rows both claiming December 21st starts winter break is a data-entry
  -- mistake we would otherwise make, and it would double-count a gap.
  exclude using gist (
    calendar_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index on school_closures (calendar_id, start_date);

-- What the database does NOT enforce: that a closure falls inside its calendar's
-- window. A check constraint cannot read the parent row, and a trigger would hide
-- the rule where nobody reads it. Containment is the verification workflow's job,
-- and the planner refuses a calendar that breaks it (ADR-0013, following ADR-0012).

-- ------------------------------------------------------------------ RLS
-- Enabled on every table, including the public ones. A world-readable table with
-- RLS *off* looks identical to one with RLS on and a permissive select policy —
-- until someone adds a column that should not have been public. Enabling it
-- everywhere means the policy is always the thing being reviewed.
alter table camps            enable row level security;
alter table locations        enable row level security;
alter table sessions         enable row level security;
alter table school_calendars enable row level security;
alter table school_closures  enable row level security;

create policy "catalog is world readable" on camps            for select using (true);
create policy "catalog is world readable" on locations        for select using (true);
create policy "catalog is world readable" on sessions         for select using (true);
create policy "catalog is world readable" on school_calendars for select using (true);
create policy "catalog is world readable" on school_closures  for select using (true);

-- No insert/update/delete policy is defined, so writes are impossible for every
-- role except service_role, which bypasses RLS entirely. Every catalog record is
-- verified by a human before it goes live (AGENTS.md §2), so catalog writes do not
-- belong to application code.
