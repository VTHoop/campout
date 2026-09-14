-- Campout catalog: the public half of the product (ADR-0002, ADR-0004).
--
-- Two shapes matter here, and the rest follows from them:
--
--   1. A CAMP is an organization. A SESSION is a dated offering. The directory
--      searches sessions, because a parent shops for "the week of July 12", not
--      for an organization. Nearly every planner query starts at sessions.
--   2. Every camp and every session carries a source_url and a verified_at, both
--      NOT NULL. Campout lists camps; it does not vet or endorse them, and the
--      provenance columns are how that posture is made true in the data rather
--      than merely stated in the terms (AGENTS.md §2).
--
-- Catalog tables are world-readable and service-role-writable. That is deliberate:
-- keeping the public catalog out of the policy surface keeps the policies that do
-- matter — the household ones — small enough to reason about.

create extension if not exists postgis;

create type camp_category as enum (
  'sports', 'arts', 'academic', 'stem', 'nature_outdoors',
  'day_camp', 'specialty', 'faith_based', 'theater_music'
);

create type school_district as enum (
  'richmond_city', 'chesterfield', 'henrico', 'hanover'
);

-- ---------------------------------------------------------------- camps
create table camps (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  -- A short summary WE wrote. ⛔ Never paste a camp's marketing copy here —
  -- that is someone else's copyrighted text in a public repo (ADR-0010).
  summary       text,
  website_url   text        not null,
  phone         text,
  email         text,

  -- Provenance. Both required: a record missing either is not live (AGENTS.md §2).
  source_url    text        not null,
  verified_at   timestamptz not null,
  verified_by   text        not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
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

  registration_url text     not null,
  capacity_note text,

  source_url    text        not null,
  verified_at   timestamptz not null,
  verified_by   text        not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

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
-- summer week, and therefore every coverage gap, is derived from these two dates.
create table school_calendars (
  district            school_district not null,
  year                smallint        not null,
  last_day_of_school  date            not null,
  first_day_of_school date            not null,

  source_url          text            not null,
  verified_at         timestamptz     not null,

  primary key (district, year),
  constraint school_calendars_ordered check (first_day_of_school > last_day_of_school)
);

-- ------------------------------------------------------------------ RLS
-- Enabled on every table, including the public ones. A world-readable table with
-- RLS *off* looks identical to one with RLS on and a permissive select policy —
-- until someone adds a column that should not have been public. Enabling it
-- everywhere means the policy is always the thing being reviewed.
alter table camps            enable row level security;
alter table locations        enable row level security;
alter table sessions         enable row level security;
alter table school_calendars enable row level security;

create policy "catalog is world readable" on camps            for select using (true);
create policy "catalog is world readable" on locations        for select using (true);
create policy "catalog is world readable" on sessions         for select using (true);
create policy "catalog is world readable" on school_calendars for select using (true);

-- No insert/update/delete policy is defined, so writes are impossible for every
-- role except service_role, which bypasses RLS entirely. Every catalog record is
-- verified by a human before it goes live (AGENTS.md §2), so catalog writes do not
-- belong to application code.
