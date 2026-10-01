-- The catalog's shape (CAM-27, PR 1 of 2).
--
-- Reshapes 20260914000100_catalog.sql around what real camps turned out to
-- need (acac, SwimRVA, SCOR, Richmond Ballet — CAM-42). Each change names the
-- CAM-27 decision it records; the ticket carries the reasoning in full.
--
--   provider → camp → session (decision 8). A PROVIDER is the organization, a
--   CAMP is a program it runs, a SESSION is a dated offering of that program.
--   The directory still searches sessions.
--
--   session_options (decisions 3 and 4). One to three per session — full day,
--   morning, afternoon — each with its own price, optional hours, and optional
--   drop-off and pickup times.
--
--   Locations are standalone and shared (decisions 7 and 17). A location
--   belongs to no camp; duplicates are flagged at review, not blocked.
--
--   details jsonb (decision 12). Facts a parent reads but the app never
--   computes with, checked against a fixed vocabulary by pg_jsonschema.
--
-- What stays for PR 2: status and the verified chain, reviewers, the approval
-- and reviewer-edit functions, the guard trigger, catalog_history and the
-- plan_entries changes. Until then the catalog stays world-readable and
-- service-role-writable, exactly as before.
--
-- Nothing is migrated: the live project holds the schema and no catalog rows
-- (ADR-0017), so columns move by drop and add.

create extension if not exists pg_jsonschema;

-- ------------------------------------------------------------ categories
-- Seven values, several allowed per camp, on the camp (decision 9). The old
-- nine-value enum's `specialty` said nothing (every non-day camp is one) and
-- `theater_music` folds into `arts`. `nature_outdoors` becomes `outdoors`.
-- The type is recreated rather than altered: Postgres cannot drop enum values.
alter table sessions drop column category;
drop type camp_category;

create type camp_category as enum (
  'day_camp', 'sports', 'arts', 'stem', 'outdoors', 'academic', 'faith_based'
);

-- The three time options a session can offer (decision 3).
create type session_option_kind as enum ('full_day', 'morning', 'afternoon');

-- ------------------------------------------------------------ vocabulary
-- The details vocabulary, first version (decision 12). One immutable function
-- per column, so each check constraint reads as one line and the vocabulary
-- reads as one document. Facts only, never a camp's own prose (ADR-0010).
-- Unknown keys are refused at every level.
--
-- ⛔ Changing a vocabulary means a new migration that replaces the function,
-- and the typed parser in src/lib/db/details.ts changes with it.
--
-- Deliberately absent: staff ratios and licensing, which read as quality or
-- safety signals (we list camps, we don't vet them), and marketing touches.
-- A key becomes a column as soon as the app filters or sorts by it.

create function camp_details_schema() returns json
language sql immutable
as $$ select $schema$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "activities": {
      "type": "array",
      "items": { "type": "string", "minLength": 1, "maxLength": 40 }
    },
    "discounts": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["kind"],
        "properties": {
          "kind": { "enum": ["early_registration", "sibling", "multi_week", "member"] },
          "amount_cents": { "type": "integer", "minimum": 0 },
          "percent_off": { "type": "integer", "minimum": 1, "maximum": 100 },
          "deadline": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }
        },
        "oneOf": [
          { "required": ["amount_cents"], "not": { "required": ["percent_off"] } },
          { "required": ["percent_off"], "not": { "required": ["amount_cents"] } }
        ]
      }
    },
    "membership_required": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name"],
      "properties": {
        "name": { "type": "string", "minLength": 1, "maxLength": 100 },
        "price_cents": { "type": "integer", "minimum": 0 },
        "period": { "enum": ["month", "year"] }
      }
    },
    "skill_required": { "type": "string", "minLength": 1, "maxLength": 200 },
    "eligibility_wording": { "type": "string", "minLength": 1, "maxLength": 200 },
    "lunch": {
      "type": "object",
      "additionalProperties": false,
      "required": ["provision"],
      "properties": {
        "provision": { "enum": ["included", "sold_separately", "bring_own"] },
        "price_cents": { "type": "integer", "minimum": 0 }
      }
    },
    "policies": {
      "type": "object",
      "additionalProperties": false,
      "minProperties": 1,
      "properties": {
        "cancellation": { "type": "string", "minLength": 1, "maxLength": 300 },
        "switching_weeks": { "type": "string", "minLength": 1, "maxLength": 300 },
        "payment": { "type": "string", "minLength": 1, "maxLength": 300 }
      }
    },
    "financial_aid": { "type": "boolean" },
    "registration_opens": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }
  }
}
$schema$::json $$;

create function session_details_schema() returns json
language sql immutable
as $$ select $schema$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "field_trips": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["destination"],
        "properties": {
          "destination": { "type": "string", "minLength": 1, "maxLength": 100 },
          "min_grade": { "type": "integer", "minimum": -1, "maximum": 12 },
          "max_grade": { "type": "integer", "minimum": -1, "maximum": 12 }
        }
      }
    },
    "other_days": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["date", "location"],
        "properties": {
          "date": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
          "location": { "type": "string", "minLength": 1, "maxLength": 200 }
        }
      }
    }
  }
}
$schema$::json $$;

create function option_details_schema() returns json
language sql immutable
as $$ select $schema$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "daily_rate": {
      "type": "object",
      "additionalProperties": false,
      "required": ["price_cents"],
      "properties": { "price_cents": { "type": "integer", "minimum": 0 } }
    },
    "care_fees": {
      "type": "object",
      "additionalProperties": false,
      "minProperties": 1,
      "properties": {
        "drop_off": { "$ref": "#/$defs/fee" },
        "pickup": { "$ref": "#/$defs/fee" }
      }
    }
  },
  "$defs": {
    "fee": {
      "type": "object",
      "additionalProperties": false,
      "required": ["price_cents", "per"],
      "properties": {
        "price_cents": { "type": "integer", "minimum": 0 },
        "per": { "enum": ["day", "session"] }
      }
    }
  }
}
$schema$::json $$;

-- ------------------------------------------------------------- providers
-- The organization (decision 8). Carries the contact facts a camp used to, and
-- the same provenance as camps and sessions (ADR-0012).
create table providers (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  -- Nullable on purpose: a church, a rec league or a neighbour may have no site.
  website_url   text,
  phone         text,
  email         text,

  source_url            text,
  source_document_path  text,
  verified_at           timestamptz not null,
  verified_by           text        not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint providers_provenance_present
    check (source_url is not null or source_document_path is not null)
);

-- ----------------------------------------------------------------- camps
-- A program a provider runs (decision 8): acac's twelve themed weeks are one
-- camp, "acac Summer Camp", with twelve sessions. Categories and registration
-- live here, shared by every session (decisions 9 and 10).
alter table camps
  drop column website_url,
  drop column phone,
  drop column email,
  add column provider_id uuid not null references providers (id) on delete cascade,
  add column categories camp_category[] not null,
  -- Nullable: plenty of camps take a paper form, a phone call, or a walk-in.
  -- registration_note carries the instructions when there is no link.
  add column registration_url  text,
  add column registration_note text,
  add column details jsonb not null default '{}',
  add constraint camps_categories_present check (cardinality(categories) > 0),
  -- day_camp is a general program with varied activities, and stands alone.
  add constraint camps_day_camp_alone
    check (not ('day_camp' = any (categories) and cardinality(categories) > 1)),
  -- A parent must be told how to sign up, one way or the other.
  add constraint camps_registration_reachable
    check (registration_url is not null or registration_note is not null),
  add constraint camps_details_vocabulary
    check (jsonb_matches_schema(camp_details_schema(), details));

create index camps_provider_id_idx on camps (provider_id);
-- The category filter: `categories && $wanted`.
create index camps_categories_idx on camps using gin (categories);

-- ------------------------------------------------------------- locations
-- Standalone and shared (decision 7): acac Midlothian hosts fourteen camps,
-- and a public park hosts several organizations. One row per site means one
-- map pin, one "near me" result, and one place to fix an address.
--
-- `label` is the venue's own name ("Woodlake Community Center").
--
-- Duplicates are caught at review, not by a unique index (decision 17): a
-- "normalized address" can't be defined well enough to enforce, and real
-- venues share an address. address_key is a coarse, derived match key —
-- street and postal code, lower-cased, punctuation and spacing collapsed —
-- for find_location_duplicates() below. It is not unique.
drop index locations_camp_id_idx;
alter table locations
  drop column camp_id,
  add column address_key text generated always as (
    btrim(regexp_replace(lower(street || ' ' || postal_code), '[^a-z0-9]+', ' ', 'g'))
  ) stored;

create index locations_address_key_idx on locations (address_key);

-- Other locations a reviewer should check before approving this one: the same
-- address_key, or a pin within about 30 m (decision 17). Security invoker, so
-- it sees only what the caller may read.
create function find_location_duplicates(target_id uuid)
returns setof locations
language sql
stable
security invoker
set search_path = public
as $$
  select other.*
  from locations target
  join locations other
    on other.id <> target.id
   and (other.address_key = target.address_key
        or st_dwithin(other.point, target.point, 30))
  where target.id = target_id
  order by other.id;
$$;

-- -------------------------------------------------------------- sessions
-- A dated offering (decision 8): dates, one main location, an optional theme,
-- and its options. Hours, care and price moved to session_options; category
-- and registration moved to the camp.
--
-- A session meets every weekday of its date range (decision 1). An offering
-- that meets on some weekdays only is split into sessions that do, or is not
-- listed — see camp-record-spec.md.
alter table sessions
  drop column name,
  drop column daily_start,
  drop column daily_end,
  drop column before_care_start,
  drop column after_care_end,
  drop column price_cents,
  drop column price_note,
  drop column registration_url,
  drop column registration_note,
  -- acac's themed weeks: "Space Week". Optional; most sessions have none.
  add column theme text,
  -- Weekdays inside the range the camp is shut (Juneteenth, decision 19).
  -- Coverage subtracts them.
  add column closed_dates date[] not null default '{}',
  add column details jsonb not null default '{}',
  -- The null test is its own clause: `x <= all ('{NULL}')` is NULL, and a
  -- check constraint passes on NULL.
  add constraint sessions_closed_dates_within
    check (array_position(closed_dates, null) is null
           and start_date <= all (closed_dates) and end_date >= all (closed_dates)),
  add constraint sessions_details_vocabulary
    check (jsonb_matches_schema(session_details_schema(), details));

-- The date filter: sessions overlapping a window (decision 18).
create index sessions_dates_idx on sessions
  using gist (daterange(start_date, end_date, '[]'));

-- ------------------------------------------------------- session_options
-- One to three ways to attend a session (decision 3), unique on kind. Each has
-- its own price for the session as dated (decision 2): a week's price for a
-- week. There is no price-unit column; a day rate goes in details.daily_rate.
--
-- Hours are never filled with defaults. Unknown hours stay null and the card
-- says "Hours not stated"; they are known in pairs or not at all.
--
-- Care (decision 4): earliest drop-off and latest pickup, whether the camp
-- includes it or charges for it. Null means none is offered — not "didn't
-- check". Any fee goes in details.care_fees.
create table session_options (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid        not null references sessions (id) on delete cascade,
  kind          session_option_kind not null,

  -- ⛔ Integer cents. Never a float. The regular price: a time-limited
  -- discount goes in price_note, so the shown price never changes when a
  -- deadline passes.
  price_cents   integer,
  price_note    text,

  -- Wall-clock times, compared against the household workday in the same space.
  daily_start       time,
  daily_end         time,
  earliest_dropoff  time,
  latest_pickup     time,

  details       jsonb not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint session_options_one_per_kind unique (session_id, kind),
  constraint session_options_price_non_negative check (price_cents is null or price_cents >= 0),
  constraint session_options_hours_paired check ((daily_start is null) = (daily_end is null)),
  constraint session_options_hours_ordered check (daily_end > daily_start),
  constraint session_options_dropoff_before_start check (earliest_dropoff < daily_start),
  constraint session_options_pickup_after_end check (latest_pickup > daily_end),
  constraint session_options_details_vocabulary
    check (jsonb_matches_schema(option_details_schema(), details))
);

-- The price filter and from_price, per session (decision 18). Leads with
-- session_id, so it also serves the foreign key.
create index session_options_session_price_idx on session_options (session_id, price_cents);

-- --------------------------------------------------------------- search
-- The directory's one search (decision 18): one row per session overlapping
-- the window, with from_price_cents — its lowest option price, null when no
-- option states one. Every filter is optional; a null leaves it off.
--
--   wanted_categories  matches a camp holding ANY of them (checkboxes).
--   max_price_cents    matches a session with ANY option at or under it.
--
-- Security invoker, so RLS applies to every table it reads: once PR 2 limits
-- the public to verified rows, so does this.
create function search_sessions(
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
security invoker
set search_path = public
as $$
  select
    s.id, s.camp_id, s.location_id, s.start_date, s.end_date, s.theme,
    (select min(o.price_cents) from session_options o where o.session_id = s.id)
  from sessions s
  join camps c on c.id = s.camp_id
  -- A null bound makes the range open on that side.
  where daterange(s.start_date, s.end_date, '[]') && daterange(window_start, window_end, '[]')
    and (wanted_categories is null or c.categories && wanted_categories)
    and (max_price_cents is null or exists (
      select 1 from session_options o
      where o.session_id = s.id and o.price_cents <= max_price_cents
    ))
  order by s.start_date, s.id;
$$;

-- ------------------------------------------------------------------ RLS
-- The two new tables join the rest of the catalog: RLS on, world-readable,
-- no write policy, so only service_role writes (20260914000100_catalog.sql).
-- PR 2 replaces every catalog read policy with the verified-chain rule.
alter table providers       enable row level security;
alter table session_options enable row level security;

create policy "catalog is world readable" on providers       for select using (true);
create policy "catalog is world readable" on session_options for select using (true);

-- Grants to match, as 20260923000100/200 set them for the other catalog
-- tables: write grants exist so a refused client write surfaces as RLS, not as
-- a table-level permission error.
grant select, insert, update, delete on providers, session_options
  to anon, authenticated, service_role;

revoke all on function search_sessions(date, date, camp_category[], integer) from public;
grant execute on function search_sessions(date, date, camp_category[], integer)
  to anon, authenticated, service_role;

-- For reviewers. Until PR 2 adds is_reviewer(), a signed-in user; anon has no
-- reason to call it. anon is named as well as public: Supabase's default
-- privileges grant it execute on every new function directly.
revoke all on function find_location_duplicates(uuid) from public, anon;
grant execute on function find_location_duplicates(uuid) to authenticated, service_role;
