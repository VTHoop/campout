# Camp record spec

The field-by-field definition of a catalog record, what counts as verified, and what must never be stored. **Read this before entering camp data or writing code that touches `providers`, `camps`, `locations`, `sessions` or `session_options`.**

The schema is the authority; this document explains it. Where they disagree, the migration wins and this file is wrong — fix it. The shape below is `supabase/migrations/20260929000100_catalog_shape.sql` (CAM-27, ADR-0018) on top of `20260914000100_catalog.sql`; the numbered decisions it cites are CAM-27's.

> **This spec does not describe `src/lib/catalog/`** (CAM-1, CAM-42), the provisional TypeScript mock the Find camps page still reads. The mock was the tool for making the decisions below and is not reshaped to match them: CAM-28 imports it as drafts and deletes it. Read this spec as the schema, not as documentation of the mock.

---

## The shape

**A provider is an organization. A camp is a program it runs. A session is a dated offering of that program** (decision 8). A parent shops for "the week of July 12", not for an organization, so the directory searches sessions. acac's twelve themed weeks are one camp, "acac Summer Camp", with twelve sessions, each carrying its theme.

```
providers ──< camps ──< sessions ──< session_options
                           >──
                        locations   (shared: any camp's sessions can point at one)
```

Entering a new organization means: one `providers` row, one `camps` row per program, a `locations` row for each site that doesn't exist yet, then one `sessions` row per dated offering with one to three `session_options`. A program with eight weeks of day camp is **eight** session rows, not one.

---

## Scope: what gets listed

**A session meets every weekday of its date range** (decision 1). Meeting days are not modelled.

- An offering that meets on some weekdays only — a weekly class, Tue/Thu afternoons — is **split into sessions that do meet every weekday of their range, or not listed.** Entered as one long session it would show as weeks of daily coverage.
- **Confirm any session spanning more than two weeks** (more than 14 days, both ends counted) before approving it. Most camps run one week, occasionally two; a longer one is usually a weekly class or a mistyped end date. Today `findCatalogInconsistencies` flags it in the TypeScript mock only; the database's approval check gains the same flag with CAM-27's review gate. Until then, check it by eye.
- Weekdays inside the range the camp is shut (a Juneteenth closure) go in `closed_dates`, not in a split.

**A session falls inside the workday** (decision 11): a full day, a morning or an afternoon on a weekday.

- **Evening and weekend offerings are not listed** (a Friday night out, evening clinics).
- **On-demand days are not recorded at all** ("runs if five campers sign up", possible snow days).
- **A camp can exist with no sessions**, so a reviewer can track it, but it doesn't appear on `/camps` until it has dated sessions.

---

## `providers`

| Field | Required | Notes |
|---|---|---|
| `name` | yes | The organization's own name, spelled the way they spell it. |
| `website_url` | no | The organization's home page, when it has one. Many small providers do not. |
| `phone`, `email` | no | Only if published publicly. |
| `source_url` / `source_document_path` | **one of these two** | Same rule as a camp. |
| `verified_at`, `verified_by` | yes | Same rule as a camp. |

## `camps`

| Field | Required | Notes |
|---|---|---|
| `provider_id` | yes | The organization that runs it. |
| `name` | yes | The program's own name: "Junior Mini Tennis Camp", "acac Summer Camp". |
| `summary` | no | **A short description we wrote.** ⛔ Never paste the camp's marketing copy — that is someone else's copyrighted text in a public repo (ADR-0010). Two sentences of plain fact is the target. |
| `categories` | yes | One or more of `day_camp`, `sports`, `arts`, `stem`, `outdoors`, `academic`, `faith_based` (decision 9). Every session of the program shares them. **`day_camp` is for a general program with varied activities, and stands alone.** A program whose point is a subject gets that subject. `arts` covers dance, theater and music. |
| `registration_url` | **one of these two** | Where the parent goes to register, for every session of the program (decision 10). **Campout never handles registration or payment.** |
| `registration_note` | **one of these two** | How to register when there is no link: "paper form, mail by March 1", "call the parish office". |
| `details` | no | See **`details`** below. |
| `source_url` | **one of these two** | The exact page the facts came from. Not the home page — the page with the sessions on it. |
| `source_document_path` | **one of these two** | A file in the `camp-sources` bucket: a saved PDF, a photo of a paper flyer, a screenshot of a Facebook post. Use this whenever the facts did not come from a durable URL. |
| `verified_at` | yes | When a human last confirmed these facts. |
| `verified_by` | yes | Who. A name or initials is enough. |

**Every record needs evidence, and it does not have to be a link.** The database enforces `source_url OR source_document_path` — a record with neither cannot be inserted. A camp whose only published information is a flyer on a parish noticeboard is perfectly listable; somebody just has to keep a copy of the flyer (ADR-0012).

## `locations`

**A location belongs to no camp** (decision 7). acac Midlothian hosts fourteen camps, and a public park hosts several organizations: one row per site means one map pin, one "near me" result, and one place to fix an address.

| Field | Required | Notes |
|---|---|---|
| `label` | yes | The venue's own name ("Woodlake Community Center"). |
| `street`, `city`, `state`, `postal_code` | yes | The physical site, not a mailing address. A PO box is not a location. |
| `district` | no | The school district the site sits in, where it matters. |
| `point` | yes | Geocoded **once, at verification time** (ADR-0007). |
| `address_key` | derived | Street and postal code, lower-cased, punctuation collapsed. Generated; never written. |

**Look for the site before adding it.** `find_location_duplicates(id)` lists other locations with the same `address_key` or a pin within about 30 m (decision 17). Duplicates are caught at review, not blocked: real venues share an address, so there is no unique index. Merge a true duplicate by pointing its sessions at the survivor.

**Confirm the pin, not just the address.** A geocoder that lands on the wrong side of a highway produces a wrong distance, and distance is how parents filter. Look at the map before saving.

## `sessions`

| Field | Required | Notes |
|---|---|---|
| `camp_id` | yes | The program this is a dated offering of. |
| `location_id` | yes | **One main location** (decision 6). Days elsewhere go in `details.other_days`. The planner's drop-off distance check uses this one only. |
| `theme` | no | The week's theme, when the program has them ("Space Week"). |
| `start_date`, `end_date` | yes | **Calendar dates**, `YYYY-MM-DD`. Inclusive. A Monday–Friday week ends Friday, not Saturday. The session meets every weekday in between (see **Scope**). |
| `closed_dates` | no | Weekdays inside the range the camp is shut (decision 19). Each must fall within the range. Coverage subtracts them. |
| `min_age`, `max_age` | no | Integer years: the child's age **on the session's first day** (decision 5). A different stated cutoff ("age by Sept 1") goes in the camp's `details`. |
| `min_grade`, `max_grade` | no | `-1` is pre-K, `0` is kindergarten. The grade of the school year the session belongs to, **summer counting toward the coming year**: "rising 5th" and "entering Fall 2026, grade 5" are both 5 for summer 2026. A December holiday day uses the current grade. Convert other phrasings ("completed 4th") and keep the camp's wording in `details.eligibility_wording`. |
| `capacity_note` | no | Waitlist status, "fills in January", lottery. |
| `details` | no | See **`details`** below. |
| `verified_at`, `verified_by` | yes | Per-session, because sessions change independently of the program. |
| `source_url` / `source_document_path` | **one of these two** | Same rule as a camp. Per-session, because sessions change independently. |

**Age and grade are filter-only**, optional, and independent — never derive one from the other. Campout doesn't book camps, so a borderline match isn't hidden; the camp's own registration makes the final call.

## `session_options`

**One to three ways to attend a session** (decision 3): a `full_day`, a `morning` and/or an `afternoon`, at most one of each. A full day, or a morning plus an afternoon, covers the week.

| Field | Required | Notes |
|---|---|---|
| `kind` | yes | `full_day`, `morning` or `afternoon`. |
| `price_cents` | no | ⛔ **Integer cents, never a float.** $325 is `32500`. **The price of the session as dated** (decision 2): a week's price for a week, a day's for a day, four days' for a four-day week. There is no price unit. |
| `price_note` | no | What the number can't carry. **A time-limited discount goes here**, never in the price ("$329 if booked by May 31"), so the shown price doesn't change when a deadline passes. |
| `daily_start`, `daily_end` | no | Wall-clock. The option's day as the camp states it. **Both or neither.** Never filled with a default: unknown hours show as "Hours not stated". |
| `earliest_dropoff`, `latest_pickup` | no | Care (decision 4), whether included (an 8–9 check-in) or charged (a $10 early drop-off). **Blank means none is offered — not "didn't check"**; if you didn't check, the record is not verified. Any fee goes in `details.care_fees`. A camp "open 7–6" records 7–6 as its day, with no drop-off or pickup. They may be filled while the hours are blank, when that's all the camp states. |
| `details` | no | See **`details`** below. |

**Constraints the database enforces**, so you will hit them rather than silently storing something wrong: `end_date >= start_date`, every closed date inside the range, `max_age >= min_age`, one option per kind, `price_cents >= 0`, hours in pairs with `daily_end > daily_start`, `earliest_dropoff < daily_start`, `latest_pickup > daily_end`, every camp with at least one category and `day_camp` alone, and every camp reachable for registration.

## `details`

Facts a parent reads but the app never computes with (decision 12, ADR-0017 §5). `jsonb`, checked on every write against a fixed vocabulary; **an unknown key is refused.** The app reads it through one typed parser, `src/lib/db/details.ts`. **Facts only, never the camp's own wording** — the one exception is `eligibility_wording`, kept so a reviewer can see what was converted.

| On | Key | Shape |
|---|---|---|
| camp | `activities` | Short tags, up to 40 characters each: `["swimming", "field games"]`. |
| camp | `discounts` | A list of `{kind, amount_cents or percent_off, deadline?}`. `kind` is `early_registration`, `sibling`, `multi_week` or `member`. Exactly one of the two amounts. |
| camp | `membership_required` | `{name, price_cents?, period?}`, `period` being `month` or `year`. |
| camp | `skill_required` | Our short summary: "Swims one length unassisted". |
| camp | `eligibility_wording` | The camp's own phrasing when it was converted (decision 5): "completed 4th grade", "age by Sept 1". |
| camp | `lunch` | `{provision, price_cents?}`: `included`, `sold_separately` (with its price) or `bring_own`. |
| camp | `policies` | Our summaries of `cancellation`, `switching_weeks` and `payment`; at least one. |
| camp | `financial_aid` | `true` or `false`. |
| camp | `registration_opens` | A `YYYY-MM-DD` date. |
| session | `field_trips` | A list of `{destination, min_grade?, max_grade?}`. |
| session | `other_days` | A list of `{date, location}` for days away from the main location (decision 6), shown on the card: "Thu Jun 25 at SwimRVA Meadowbrook (3700 Cogbill Rd)". |
| option | `daily_rate` | `{price_cents}`: a day rate beside a longer session's price (decision 2). |
| option | `care_fees` | `{drop_off?, pickup?}`, each `{price_cents, per}` with `per` being `day` or `session`. |

**Deliberately left out:** staff ratios and licensing, which read as quality or safety signals (we list camps, we don't vet them), and marketing touches like parent showings. **A key becomes a column as soon as the app filters or sorts by it.** Changing the vocabulary is a migration that replaces the schema function, with the parser changed in the same commit.

## Searching

`search_sessions(window_start, window_end, wanted_categories, max_price_cents)` is the directory's one search (decision 18). It returns one row per session overlapping the window, with `from_price_cents`: its lowest option price. A camp matches when it holds **any** wanted category; a session matches the price when **any** option is at or under it. Every argument is optional. It runs as the caller, so row-level security applies to everything it reads.

## `school_calendars` and `school_closures`

One `school_calendars` row per school year per district — or per school, when a school runs its own calendar. No v1 calendar is school-specific or year-round; the shape exists so one can be added without a migration. Unique on `(district, school, label)`, and `school` is null for the district-wide calendar.

| Field | Required | Notes |
|---|---|---|
| `district`, `label` | yes | `label` is the district's name for the year, **written `YYYY-YY`**: `2026-27`. The planner pairs a year with the next one by label and refuses any other format. The database does not check it, so check it by eye. |
| `type` | yes | `traditional` or `year_round`. Tells the UI what it may promise; it does not change how days are counted. |
| `school` | no | Set only for a school on its own calendar. |
| `first_instructional_day`, `last_instructional_day` | yes | Copied from the published calendar. The earlier date when grades start on different days. |
| `covers_from`, `covers_to` | yes | The window this record speaks for. It must contain the school year (first to last instructional day). It does **not** need to reach across summer: the summer is derived from the next year's calendar. |
| `verified_at`, `verified_by` | yes | Same rule as a camp. |
| `source_url` / `source_document_path` | **one of these two** | Districts usually publish a PDF, and saving a copy is worth the ten seconds: they get replaced in place when the calendar changes. |

Each `school_closures` row is a run of days school is shut, inclusive at both ends. A single day repeats `start_date` as `end_date`.

| Field | Required | Notes |
|---|---|---|
| `start_date`, `end_date` | yes | `end_date >= start_date`. |
| `source_label` | yes | **The district's exact words, verbatim.** CCPS labels nine different closures "Holiday, schools and offices closed", so this is often useless alone. That is why it is a quote and never rewritten. |
| `tags` | no | Any of `holiday`, `teacher_workday`, `conference_day`, `break`. One closure can carry several. |
| `common_name` | no | What a parent would call it ("Yom Kippur"). Ours, not the district's — only fill it with its own source. |

**Never store summer.** No district publishes it. It is derived from one year's `last_instructional_day` and the next year's `first_instructional_day`, so a verifier copies dates off the document and does no arithmetic. Adding the next year's calendar is what makes this year's summer known.

**Constraints the database enforces:** `last_instructional_day > first_instructional_day`, `covers_to > covers_from`, `end_date >= start_date`, and **no two closures in one calendar may cover the same day**.

**What it does not enforce**, so the verification workflow must: every closure sits inside its calendar's instructional days, and the calendar's window contains its school year. The planner refuses a calendar that breaks either, so a mistake here shows up as an error, not a wrong day on a grid. A closure before the first day of school or after the last — CCPS teacher workdays before opening day, for instance — is not stored; that time is already part of the derived summer.

**Out of scope, deliberately** (ADR-0013): early-release days and grade-staggered first days. Record `first_instructional_day` as the earliest date any grade starts.

This is the reference data every closed day is derived from. A wrong date here shifts every coverage gap for every family in that district, so it gets the same verification discipline as a camp record — from the district's published calendar, not from a news article about it. The HTML calendar page is authoritative; a district's iCal feed is a convenience and can miss next year.

---

## What "verified" means

`verified_at` means: **a human looked at the evidence on that date and confirmed every fact in the record against it.** The evidence is whichever of `source_url` or `source_document_path` the record carries — a live page, or a saved copy of a flyer, PDF, or post. `verified_by` records who did it, and both stay mandatory whichever form the evidence takes.

It does **not** mean, and must never be presented as meaning, that Campout inspected the camp, checked its licensing or staffing, endorsed it, or judged its quality. We list camps; we do not vet them (AGENTS.md §2).

A record is ready to go live when:

1. Every required field is filled from the source page, not inferred.
2. Evidence is attached: `source_url` points at the page carrying the session facts, **or** `source_document_path` points at a saved copy of what the camp said. A written claim with nothing behind it does not count.
3. The geocoded pin has been looked at on a map.
4. Dates, ages, and hours have been read twice — these are the three fields a parent acts on.
5. `verified_at` and `verified_by` are set.

**If you could not confirm a fact, leave the field null.** A null means "not offered" or "not stated", and the UI can say so honestly. A guess renders as fact, and a parent plans a workday around it.

**Never mark a record verified because it looks plausible.** A wrong drop-off time costs a parent a workday, and that is the failure this whole discipline exists to prevent.

---

## Re-verification

Camp dates change every year, and hours and prices change within a year. `verified_at` is shown to the parent on every session precisely because staleness here is not cosmetic.

Treat a record as stale once its `verified_at` predates the current planning season. Re-verifying is the same checklist, against the same `source_url`, with the dates re-read from scratch — not a glance to confirm the page still exists.

---

## What must never be stored

- **Anything about a child.** This spec covers the catalog only. The `children` rules are in ADR-0006 and are cardinal.
- **A camp's marketing prose, copied.** Facts are not copyrightable; their paragraphs are (ADR-0010).
- **Staff names**, beyond a published director or contact the camp lists publicly.
- **Anything behind a login.** If a fact required credentials to see, it is not ours to publish.
