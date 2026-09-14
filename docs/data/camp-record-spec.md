# Camp record spec

The field-by-field definition of a catalog record, what counts as verified, and what must never be stored. **Read this before entering camp data or writing code that touches `camps`, `locations`, or `sessions`.**

The schema is the authority; this document explains it. Where they disagree, the migration wins and this file is wrong — fix it.

---

## The shape

**A camp is an organization. A session is a dated offering.** A parent shops for "the week of July 12", not for an organization, so the directory searches sessions. One camp has many sessions, possibly at several locations.

```
camps ──< locations ──< sessions
  └──────────────────────┘
```

Entering a new provider means: one `camps` row, at least one `locations` row, then one `sessions` row per dated offering. A camp with eight weeks of day camp and a separate overnight week is **nine** session rows, not one.

---

## `camps`

| Field | Required | Notes |
|---|---|---|
| `name` | yes | The organization's own name, spelled the way they spell it. |
| `summary` | no | **A short description we wrote.** ⛔ Never paste the camp's marketing copy — that is someone else's copyrighted text in a public repo (ADR-0010). Two sentences of plain fact is the target. |
| `website_url` | yes | The organization's home page. |
| `phone`, `email` | no | Only if published publicly by the camp. |
| `source_url` | yes | The exact page the facts came from. Not the home page — the page with the sessions on it. |
| `verified_at` | yes | When a human last confirmed these facts. |
| `verified_by` | yes | Who. A name or initials is enough. |

## `locations`

| Field | Required | Notes |
|---|---|---|
| `label` | yes | How the camp refers to the site ("Main campus", "Fall Line Park"). |
| `street`, `city`, `state`, `postal_code` | yes | The physical site, not a mailing address. A PO box is not a location. |
| `district` | no | The school district the site sits in, where it matters. |
| `point` | yes | Geocoded **once, at verification time** (ADR-0007). |

**Confirm the pin, not just the address.** A geocoder that lands on the wrong side of a highway produces a wrong distance, and distance is how parents filter. Look at the map before saving.

## `sessions`

| Field | Required | Notes |
|---|---|---|
| `name` | yes | The camp's own name for the session ("Junior Explorers, Week 3"). |
| `category` | yes | One of the `camp_category` enum values. Pick the one a parent would filter by. |
| `start_date`, `end_date` | yes | **Calendar dates**, `YYYY-MM-DD`. Inclusive. A Monday–Friday week ends Friday, not Saturday. |
| `daily_start`, `daily_end` | yes | Wall-clock. The core day, excluding extended care. |
| `before_care_start`, `after_care_end` | no | Only when the camp actually offers it. Leaving these null means "not offered", which is different from "we did not check" — if you did not check, the record is not verified. |
| `min_age`, `max_age` | no | Integer years, as the camp states them. |
| `min_grade`, `max_grade` | no | `-1` is pre-K, `0` is kindergarten. |
| `price_cents` | no | ⛔ **Integer cents, never a float.** $325 is `32500`. |
| `price_note` | no | Everything the number cannot carry: member pricing, sibling discount, sliding scale, deposit terms. |
| `registration_url` | yes | Where the parent goes to register. **Campout never handles registration or payment.** |
| `capacity_note` | no | Waitlist status, "fills in January", lottery. |
| `source_url`, `verified_at`, `verified_by` | yes | Per-session, because sessions change independently of the organization. |

**Constraints the database enforces**, so you will hit them rather than silently storing something wrong: `end_date >= start_date`, `daily_end > daily_start`, `max_age >= min_age`, `price_cents >= 0`.

## `school_calendars`

Keyed by `(district, year)`. `last_day_of_school`, `first_day_of_school`, plus `source_url` and `verified_at`.

This is the reference data every summer week is derived from. A wrong date here shifts every coverage gap for every family in that district, so it gets the same verification discipline as a camp record — from the district's published calendar, not from a news article about it.

---

## What "verified" means

`verified_at` means: **a human opened `source_url` on that date and confirmed every fact in the record against it.**

It does **not** mean, and must never be presented as meaning, that Campout inspected the camp, checked its licensing or staffing, endorsed it, or judged its quality. We list camps; we do not vet them (AGENTS.md §2).

A record is ready to go live when:

1. Every required field is filled from the source page, not inferred.
2. `source_url` points at the page carrying the session facts.
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
