# 13. A school closure is the coverage primitive, not a summer

- Status: Accepted
- Date: 2026-09-21
- Supersedes the `weeks.ts` row of [ADR-0008](./0008-planner-package.md) and the `school_calendars` shape in `20260914000100_catalog.sql`. The rest of ADR-0008 stands.

## Context

The product was scoped as summer planning, so the model was scoped to summer. `SchoolCalendar` holds two dates — the last day of school and the first day back — and `summerWeeks()` turns them into the grid.

That is the wrong shape for what we actually sell. School closes on roughly eighteen other days a year: holidays, teacher workdays, conference days, winter and spring break. Those are the days that go unnoticed. A parent who does not observe Yom Kippur has no reason to expect their district to close for it, and finding out on the Sunday night is the exact failure Campout exists to prevent. Summer is still the primary case, but it is not a different problem — it is the longest run of the same one.

Two dates cannot express eighteen scattered days. The question is what replaces them.

This ADR was drafted from reasoning, then tested against Chesterfield’s published calendar (<https://www.oneccps.org/page/calendars>, and the Google Calendar iCal feed it links). Real data confirmed the central idea and killed three of the specifics. Both are recorded below, because the next district will break something too.

We are one PR into this project. No migration has been applied to any Supabase project, `@campout/planner` has one shipped module that depends on this shape, and the directory UI has not been built. The cost of changing the model now is a day. The cost of changing it after the grid ships is most of the grid.

## Decision

**The primitive is a closure: a contiguous run of days school is shut. Summer is the longest one, not a separate type.** That much survived contact with real data. The rest of this section is what the data forced.

**Store what the district publishes. Derive what the planner needs.** Districts do not publish summer. They publish a first day, a last day, and a list of dated exceptions. Storing a shape the source does not have means a verifier cannot check a row against the document in front of them, which is the whole point of hand verification.

### Stored: the school year and its entries

```ts
/** What a dated entry does to a school day. */
export enum DayShape {
  Closed = 'closed',
  EarlyRelease = 'early_release',
}

/** Facts a district attaches to a day. A day carries a set, never one. */
export enum EntryTag {
  Holiday = 'holiday',
  TeacherWorkday = 'teacher_workday',
  ConferenceDay = 'conference_day',
  Break = 'break',
  FirstDay = 'first_day',
  LastDay = 'last_day',
  GradingPeriodEnd = 'grading_period_end',
}

export interface CalendarEntry {
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;          // inclusive; a single day repeats startDate
  readonly shape: DayShape;
  readonly tags: readonly EntryTag[];
  /** The district's exact words. Often useless on its own: CCPS says "Holiday" nine times. */
  readonly sourceLabel: string;
  /** What a parent would call it. Ours, not the district's, and separately sourced. */
  readonly commonName?: string;
  /** Wall-clock dismissal, only when shape is EarlyRelease. */
  readonly dismissalTime?: WallClockTime;
  /**
   * Set only when the entry applies to some grades and not others. An explicit
   * list, not a range: CCPS starts grades 1-5, 6 and 9 a day before 7-8 and
   * 10-12, which no single min/max can express. -1 is pre-K, 0 is kindergarten,
   * matching camp-record-spec.md.
   */
  readonly grades?: readonly number[];
}

export interface SchoolYearCalendar {
  readonly district: SchoolDistrict;
  /** Null for the district calendar; set for a school on its own, e.g. Bellwood year-round. */
  readonly school?: string;
  readonly label: string;                  // "2026-27"
  readonly firstInstructionalDay: CalendarDate;
  readonly lastInstructionalDay: CalendarDate;
  /** The window this record speaks for. Outside it we do not know, and say so. */
  readonly coversFrom: CalendarDate;
  readonly coversTo: CalendarDate;
  readonly entries: readonly CalendarEntry[];
}
```

### Derived: what the planner and the UI consume

`CoveragePeriod` and `CoverageWeek` are unchanged from the first draft, and `weeksBetween(start, end)` still carries the partial-boundary-week logic out of `weeks.ts`. What changes is where periods come from:

| Function | Responsibility |
|---|---|
| `coveragePeriods(calendars, from, to)` | Every run of closed weekdays in the range, summer included. Takes **a list** of calendars, because summer sits between two school years. |
| `summerOf(calendars, year)` | The period between one year’s `lastInstructionalDay` and the next year’s `firstInstructionalDay`. Derived, never stored. |
| `earlyReleases(calendar)` | The partial days. Modelled now, not surfaced in v1. |
| `coveragePeriodOf(calendars, date, grade?)` | Throws outside every `coversFrom`/`coversTo`. Refuse rather than guess (AGENTS.md §1). |

### Schema

```sql
create extension if not exists btree_gist;

create type day_shape as enum ('closed', 'early_release');
create type entry_tag as enum (
  'holiday', 'teacher_workday', 'conference_day', 'break',
  'first_day', 'last_day', 'grading_period_end'
);

create table school_calendars (
  id       uuid primary key default gen_random_uuid(),
  district school_district not null,
  school   text,                                  -- null = the district-wide calendar
  label    text not null,                         -- '2026-27'
  first_instructional_day date not null,
  last_instructional_day  date not null,
  covers_from date not null,
  covers_to   date not null,
  source_url            text,
  source_document_path  text,
  verified_at           timestamptz not null,
  verified_by           text        not null,
  unique nulls not distinct (district, school, label),
  constraint school_calendars_instruction_ordered
    check (last_instructional_day > first_instructional_day),
  constraint school_calendars_window check (covers_to > covers_from),
  constraint school_calendars_provenance_present
    check (source_url is not null or source_document_path is not null)
);

create table school_calendar_entries (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references school_calendars (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  shape       day_shape not null,
  tags        entry_tag[] not null default '{}',
  source_label text not null,                     -- the district's exact words
  common_name  text,                              -- ours, and only with its own source
  dismissal_time time,
  grades       smallint[],                        -- null = every grade
  constraint entries_ordered check (end_date >= start_date),
  constraint entries_dismissal_matches_shape
    check ((shape = 'early_release') = (dismissal_time is not null))
);

create index on school_calendar_entries (calendar_id, start_date);
```

Both tables are catalog-side: world-readable, `service_role` writes only, RLS enabled with a select policy, per ADR-0004.

**What the database does not enforce.** That an entry falls inside its calendar's window, and that two entries do not cover the same date for the same grade. A check constraint cannot read the parent row, and grade-scoped entries legitimately share a date — Aug 24 2026 is closed for grades 7-8 and for 10-12, two rows, one day. Following [ADR-0012](./0012-provenance-url-or-stored-document.md), we state the limit rather than half-enforce it with a trigger nobody reads. Both are verification-workflow concerns and a violation is a data-quality bug.

### Replacing rather than migrating

No migration has been applied to any Supabase project, so `20260914000100_catalog.sql` is **edited in place** and `pnpm supabase:reset` reapplies from scratch. The decision rule if that changes: the moment any shared environment has run it, this becomes an additive migration instead.

## Validated against real data

Chesterfield’s 2026-27 calendar, 29 events in the iCal feed plus the HTML page.

**What held.** Multi-day closures arrive as one dated range and map onto `CalendarEntry` exactly: winter break is `20261221–20270101`, spring break `20270329–20270402`, Thanksgiving `20261125–20261127`. One row each, as published. The range primitive was right.

**What broke, and the fix:**

1. **`reason` as "the district’s own words" is worthless.** CCPS labels Yom Kippur, Labor Day, MLK Day and six others identically: *"Holiday, schools and offices closed."* A days-off list built from that shows nine indistinguishable rows. Hence `sourceLabel` (verbatim, what we can cite) **and** `commonName` (ours, separately sourced). We do not get to put "Yom Kippur" in a field and imply the district said it.
2. **A single `kind` cannot hold a real day.** `"End of Q4; 3-hour early release; final day of school"` is one event with three facts. `"Holiday; parent-teacher conferences"` is two. Hence a tag set.
3. **Early release is not an edge case.** Seven in 2026-27, eight in 2027-28 — as many as full holidays, and a three-hour dismissal wrecks a workday as thoroughly as a closure. Excluding it from the product was a scope call; excluding it from the *model* would have been a mistake we paid for with a migration. `DayShape.EarlyRelease` exists now and v1 does not render it.
4. **Summer is never published as an event.** It has to be derived from `lastInstructionalDay` of one year and `firstInstructionalDay` of the next. This is the opposite of the first draft, which stored summer as a closure.
5. **Start dates stagger by grade.** Grades 1-5, 6 and 9 start Aug 24; grades 7-8 and 10-12 start Aug 25. For a seventh-grader, Aug 24 is an unnoticed day off — exactly the case this product exists for. Hence optional `grades` on an entry.
6. **A district is not always one calendar.** Bellwood Elementary runs year-round on its own calendar, so a Bellwood family’s summer is not Chesterfield’s. Hence nullable `school`.

**What we still cannot answer.** Prekindergarten and kindergarten stagger across the first week per child, and the district says so without saying which child. That is unknowable from any published source, and the honest response is to say so rather than assume.

## Alternatives considered

**Keep `SchoolCalendar` and add a `days_off` table.** Two models of one fact, two code paths, every analyzer written twice and drifting. This is the pigeonholing the change exists to avoid.

**Store closures directly, including summer as a closure.** This ADR’s own first draft. Rejected on contact with the source: no district publishes a summer event, so every summer row would be a verifier’s arithmetic rather than a transcription. The first draft justified it by claiming next year’s start date is published too late to derive summer. **That claim was wrong** — CCPS published 2027-28 before September 2026, roughly two years ahead.

**One row per closed date.** Summer alone is about sixty rows, each hand-verified. "Jun 7 through Aug 20" becomes sixty facts to get right instead of two.

## Consequences

- **+** One primitive, one set of analyzers, one card component. A Tuesday in November and the week of July 13 are the same shape all the way down.
- **+** Stored rows are a transcription of the published calendar, so a human can check a row against the document without doing date arithmetic.
- **+** `weeks.ts` is re-seated, not rewritten. The partial-boundary-week logic — the subtlest code in the repo — survives behind `weeksBetween(start, end)` with its tests.
- **+** The iCal feed makes ingestion cheap. A calendar skill parses it into entries for review; per AGENTS.md §2 a human clears the queue, and nothing automated publishes.
- **−** The feed is a rolling window of roughly thirteen months, while the HTML page carries two full years. **The HTML is the authoritative source; the feed is a convenience.** A skill that reads only the feed will silently miss next year.
- **−** Summer needs two adjacent school-year records. Missing the later one means `summerOf()` returns nothing and the app says summer is not published yet, rather than inventing an end date.
- **−** Reference data grows from 2 fields to roughly 25 entries per district-year. Parsing makes that cheap to draft and no cheaper to verify.
- **−** Early release is modelled and unused. Dead weight until the product wants it, which is the cheaper of the two mistakes available.
- **−** Calendars change. CCPS states the board may modify them and the superintendent sets snow makeup days, so `verified_at` staleness is real and re-checking has to be a scheduled job, not a one-off.
