-- Local seed: an INVENTED catalog in the provider → camp → session shape
-- (CAM-27). `supabase db reset` loads it after the migrations.
--
-- ⛔ Nothing here is a real camp, a real venue or a real family (ADR-0010).
-- Names, addresses and prices are made up; every URL is on example.test, a
-- domain reserved so it can never resolve. Real catalog data lives only in
-- the database, imported as drafts and reviewed there (ADR-0017, CAM-28).
--
-- It covers the shape rather than a realistic summer: a provider with two
-- programs, a location two providers share, all three time options, care
-- times, a closed day, a day away from the main site, and every details key.
-- Beside the verified rows sit drafts a reviewer hasn't approved — a camp, its
-- session, a location and a calendar — and an invented school calendar.
--
-- Verified rows can only be written with the review gate open (ADR-0017 §3,
-- 20260930000100_catalog_review_gate.sql). The seed is trusted local setup, so
-- it opens the gate for its own transaction, and marks the rows verified by
-- 'seed' the way approve_record() would.

begin;
select set_config('campout.catalog_gate', 'on', true);

-- Fixed ids, so a local query or a screenshot can name a row.
insert into providers (id, name, website_url, phone, source_url, verified_at, verified_by) values
  ('00000000-0000-4000-8000-000000000001', 'Maple Hollow Rec League', 'https://maple-hollow.example.test',
   '804-555-0101', 'https://maple-hollow.example.test/summer', '2026-09-01T12:00:00Z', 'seed'),
  ('00000000-0000-4000-8000-000000000002', 'Riverbend Arts Collective', null,
   null, 'https://riverbend.example.test/camps', '2026-09-01T12:00:00Z', 'seed');

insert into locations (id, label, street, city, state, postal_code, district, point, source_url) values
  -- Shared: both providers run sessions here (decision 7).
  ('00000000-0000-4000-8000-000000000101', 'Cedar Run Community Center', '4100 Cedar Run Pkwy',
   'Midlothian', 'VA', '23112', 'chesterfield', 'SRID=4326;POINT(-77.6490 37.4920)',
   'https://maple-hollow.example.test/summer'),
  ('00000000-0000-4000-8000-000000000102', 'Maple Hollow Pool', '250 Hollow Brook Rd',
   'Henrico', 'VA', '23233', 'henrico', 'SRID=4326;POINT(-77.5980 37.6320)',
   'https://maple-hollow.example.test/summer');

insert into camps (id, provider_id, name, summary, categories, registration_url, registration_note,
                   details, source_url, verified_at, verified_by) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001',
   'Maple Hollow Summer Camp', 'A general day camp with a different theme each week.',
   '{day_camp}', 'https://maple-hollow.example.test/register', null,
   '{
      "activities": ["swimming", "field games", "crafts"],
      "discounts": [
        {"kind": "sibling", "percent_off": 10},
        {"kind": "early_registration", "amount_cents": 2500, "deadline": "2027-03-31"}
      ],
      "membership_required": {"name": "Maple Hollow membership", "price_cents": 2000, "period": "year"},
      "lunch": {"provision": "bring_own"},
      "policies": {"switching_weeks": "Free until two weeks before the session"},
      "financial_aid": true,
      "registration_opens": "2027-01-15"
    }',
   'https://maple-hollow.example.test/summer', '2026-09-01T12:00:00Z', 'seed'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001',
   'Maple Hollow Swim Team Camp', 'Stroke work and relays for swimmers who already swim a length.',
   '{sports}', 'https://maple-hollow.example.test/register', null,
   '{
      "skill_required": "Swims one length of the pool unassisted",
      "eligibility_wording": "completed 2nd grade",
      "lunch": {"provision": "sold_separately", "price_cents": 700}
    }',
   'https://maple-hollow.example.test/summer', '2026-09-01T12:00:00Z', 'seed'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000002',
   'Riverbend Stage & Studio', 'Theater, dance and painting, ending in a Friday showcase.',
   '{arts}', null, 'Paper form at the front desk, or call the office',
   '{"policies": {"cancellation": "Full refund until May 1", "payment": "Deposit due at registration"}}',
   'https://riverbend.example.test/camps', '2026-09-01T12:00:00Z', 'seed');

insert into sessions (id, camp_id, location_id, theme, start_date, end_date, min_age, max_age,
                      min_grade, max_grade, closed_dates, details, source_url, verified_at, verified_by) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201',
   '00000000-0000-4000-8000-000000000101', 'Space Week', '2027-06-21', '2027-06-25',
   5, 12, 0, 6, '{}',
   '{"field_trips": [{"destination": "Science museum", "min_grade": 3, "max_grade": 6}]}',
   'https://maple-hollow.example.test/summer', '2026-09-01T12:00:00Z', 'seed'),
  -- A week with a closed day inside it (decision 19).
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000201',
   '00000000-0000-4000-8000-000000000101', 'Ocean Week', '2027-06-28', '2027-07-02',
   5, 12, 0, 6, '{2027-07-02}', '{}',
   'https://maple-hollow.example.test/summer', '2026-09-01T12:00:00Z', 'seed'),
  -- One day away from the main site (decision 6).
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000202',
   '00000000-0000-4000-8000-000000000102', null, '2027-07-12', '2027-07-16',
   7, 13, 3, 8, '{}',
   '{"other_days": [{"date": "2027-07-15", "location": "Cedar Run Community Center (4100 Cedar Run Pkwy)"}]}',
   'https://maple-hollow.example.test/summer', '2026-09-01T12:00:00Z', 'seed'),
  -- A second provider at the shared location.
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000203',
   '00000000-0000-4000-8000-000000000101', null, '2027-07-19', '2027-07-23',
   null, null, 1, 5, '{}', '{}',
   'https://riverbend.example.test/camps', '2026-09-01T12:00:00Z', 'seed');

insert into session_options (session_id, kind, price_cents, price_note, daily_start, daily_end,
                             earliest_dropoff, latest_pickup, details) values
  -- Full day with care on both ends, and a day rate (decisions 2 and 4).
  ('00000000-0000-4000-8000-000000000301', 'full_day', 32500, null, '09:00', '16:00', '07:30', '18:00',
   '{"daily_rate": {"price_cents": 7500}, "care_fees": {"drop_off": {"price_cents": 1000, "per": "day"}}}'),
  -- Two half days that together cover the week (decision 3).
  ('00000000-0000-4000-8000-000000000301', 'morning', 19500, null, '09:00', '12:30', null, null, '{}'),
  ('00000000-0000-4000-8000-000000000301', 'afternoon', 19500, null, '13:00', '16:00', null, '18:00', '{}'),
  -- Priced for the four days it meets.
  ('00000000-0000-4000-8000-000000000302', 'full_day', 26000, 'Four days: closed Friday', '09:00', '16:00',
   '07:30', '18:00', '{}'),
  -- Hours not stated: left blank, never defaulted.
  ('00000000-0000-4000-8000-000000000303', 'morning', 21000, '$200 if registered by March 31',
   null, null, null, null, '{}'),
  ('00000000-0000-4000-8000-000000000304', 'full_day', 29500, null, '09:30', '15:30', null, null, '{}');

-- Everything above is verified, as approve_record() would leave it.
update providers set status = 'verified';
update locations set status = 'verified', verified_at = '2026-09-01T12:00:00Z', verified_by = 'seed';
update camps     set status = 'verified';
update sessions  set status = 'verified';

-- ------------------------------------------------------------------ drafts
-- A reviewer's queue: a new program from a verified provider, at a location
-- nobody has checked yet. Invisible to everyone but reviewers.
insert into locations (id, label, street, city, state, postal_code, district, point, source_url) values
  ('00000000-0000-4000-8000-000000000103', 'Riverbend Clay Barn', '18 Kiln Hill Ln',
   'Ashland', 'VA', '23005', 'hanover', 'SRID=4326;POINT(-77.4790 37.7590)',
   'https://riverbend.example.test/clay');

insert into camps (id, provider_id, name, summary, categories, registration_url, source_url) values
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000002',
   'Riverbend Clay Week', 'Wheel throwing and hand building for older kids.',
   '{arts}', 'https://riverbend.example.test/register', 'https://riverbend.example.test/clay');

insert into sessions (id, camp_id, location_id, start_date, end_date, min_grade, max_grade, source_url) values
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000204',
   '00000000-0000-4000-8000-000000000103', '2027-08-02', '2027-08-06', 4, 8,
   'https://riverbend.example.test/clay');

insert into session_options (session_id, kind, price_cents, daily_start, daily_end) values
  ('00000000-0000-4000-8000-000000000305', 'morning', 24000, '09:00', '12:00');

-- ---------------------------------------------------------------- calendars
-- Invented school years, far enough out that they read as fixtures, not as a
-- real district's calendar. One verified, the next still a draft.
insert into school_calendars (id, district, type, label, first_instructional_day,
                              last_instructional_day, covers_from, covers_to, source_url,
                              status, verified_at, verified_by) values
  ('00000000-0000-4000-8000-000000000401', 'richmond_city', 'traditional', '2096-97',
   '2096-08-27', '2097-06-14', '2096-07-01', '2097-06-30',
   'https://district.example.test/calendar-2096-97', 'verified', '2026-09-01T12:00:00Z', 'seed'),
  ('00000000-0000-4000-8000-000000000402', 'richmond_city', 'traditional', '2097-98',
   '2097-08-26', '2098-06-13', '2097-07-01', '2098-06-30',
   'https://district.example.test/calendar-2097-98', 'draft', null, null);

insert into school_closures (calendar_id, start_date, end_date, tags, source_label, common_name) values
  ('00000000-0000-4000-8000-000000000401', '2096-09-03', '2096-09-03', '{holiday}', 'Holiday', 'Labor Day'),
  ('00000000-0000-4000-8000-000000000401', '2096-11-21', '2096-11-23', '{holiday,break}',
   'Thanksgiving Break', null),
  ('00000000-0000-4000-8000-000000000401', '2096-12-24', '2097-01-04', '{break}', 'Winter Break', null),
  ('00000000-0000-4000-8000-000000000402', '2097-09-02', '2097-09-02', '{holiday}', 'Holiday', 'Labor Day');

commit;
