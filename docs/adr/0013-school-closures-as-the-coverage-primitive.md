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

**The primitive is a closure: a contiguous run of days school is shut. Summer is the longest one, not a separate type.** That survived contact with real data. The rest of this section is what the data forced.

**Store what the district publishes. Derive what the planner needs.** Districts do not publish summer. They publish a first day, a last day, and a list of dated exceptions. Storing a shape the source does not have means a verifier cannot check a row against the document in front of them, which is the point of verifying by hand.

### Stored: the calendar and its closures

```ts
/** How a school year is shaped. Chesterfield publishes both. */
export enum CalendarType {
  Traditional = 'traditional',
  YearRound = 'year_round',
}

/** Facts a district attaches to a closed day. A closure carries a set, never one. */
export enum ClosureTag {
  Holiday = 'holiday',
  TeacherWorkday = 'teacher_workday',
  ConferenceDay = 'conference_day',
  Break = 'break',
}

/** A run of days school is shut. Inclusive; a single day repeats startDate. */
export interface Closure {
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly tags: readonly ClosureTag[];
  /** The district's exact words. Often useless alone: CCPS says "Holiday" nine times. */
  readonly sourceLabel: string;
  /** What a parent would call it. Ours, not the district's, and separately sourced. */
  readonly commonName?: string;
}

export interface SchoolYearCalendar {
  readonly district: SchoolDistrict;
  readonly type: CalendarType;
  /** Null for the district-wide calendar; set for a school on its own, e.g. Bellwood. */
  readonly school?: string;
  readonly label: string;                  // "2026-27"
  readonly firstInstructionalDay: CalendarDate;
  readonly lastInstructionalDay: CalendarDate;
  /** The window this record speaks for. Outside it we do not know, and say so. */
  readonly coversFrom: CalendarDate;
  readonly coversTo: CalendarDate;
  readonly closures: readonly Closure[];
}
```

**`type` is an expectation signal, not a second algorithm.** Everything below runs identically on both. What changes is what the UI may promise: a traditional calendar has one long summer and about fifteen scattered days, so it gets the twelve-week grid. A year-round calendar has several shorter intersessions instead, so promising "12 weeks of summer" to a Bellwood family would be wrong. The type is how the app knows which it is holding.

### Derived: what the planner and the UI consume

`CoveragePeriod` and `CoverageWeek` are unchanged, and `weeksBetween(start, end)` still carries the partial-boundary-week logic out of `weeks.ts`. What changes is where periods come from:

| Function | Responsibility |
|---|---|
| `coveragePeriods(calendars, from, to)` | Every run of closed weekdays in the range, the between-years gap included. Takes **a list**, because that gap sits between two school years. |
| `longestPeriod(calendars, label)` | The gap between one year's `lastInstructionalDay` and the next year's `firstInstructionalDay`. Summer, on a traditional calendar. Derived, never stored. |
| `coveragePeriodOf(calendars, date)` | The period covering a date. Throws outside every `coversFrom`/`coversTo`. Refuse rather than guess (AGENTS.md §1). |

### Schema

```sql
create type calendar_type as enum ('traditional', 'year_round');
create type closure_tag   as enum ('holiday', 'teacher_workday', 'conference_day', 'break');

create table school_calendars (
  id       uuid primary key default gen_random_uuid(),
  district school_district not null,
  type     calendar_type   not null,
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

create table school_closures (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references school_calendars (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  tags        closure_tag[] not null default '{}',
  source_label text not null,                     -- the district's exact words
  common_name  text,                              -- ours, and only with its own source
  constraint school_closures_ordered check (end_date >= start_date),
  exclude using gist (
    calendar_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index on school_closures (calendar_id, start_date);
```

`btree_gist` is required for the exclusion constraint, which makes two closures covering the same day in one calendar impossible. Two rows both claiming December 21st starts winter break is a data-entry mistake we would otherwise make, and it would double-count a gap.

Both tables are catalog-side: world-readable, `service_role` writes only, RLS enabled with a select policy, per ADR-0004.

**What the database does not enforce:** that a closure falls inside its calendar's window. A check constraint cannot read the parent row, and a trigger would hide the rule where nobody reads it. Following [ADR-0012](./0012-provenance-url-or-stored-document.md) we state the limit rather than half-enforce it. Containment is the verification workflow's job, and a closure outside its window is a data-quality bug.

### Replacing rather than migrating

No migration has been applied to any Supabase project, so `20260914000100_catalog.sql` is **edited in place** and `pnpm supabase:reset` reapplies from scratch. The decision rule if that changes: the moment any shared environment has run it, this becomes an additive migration instead.

## Validated against real data

Chesterfield's 2026-27 calendar: 29 events in the iCal feed, plus the HTML page. <https://www.oneccps.org/page/calendars>

**What held.** Multi-day closures arrive as one dated range and map onto `Closure` exactly: winter break is `20261221–20270101`, spring break `20270329–20270402`, Thanksgiving `20261125–20261127`. One row each, as published.

**What the data changed:**

1. **A `reason` field holding "the district's own words" is worthless.** CCPS labels Yom Kippur, Labor Day, MLK Day and six others identically: *"Holiday, schools and offices closed."* A days-off list built from that shows nine indistinguishable rows. Hence `sourceLabel` (verbatim, citable) **and** `commonName` (ours, separately sourced). We do not get to put "Yom Kippur" in a field and imply the district said it.
2. **One closure can carry several facts.** *"Holiday; parent-teacher conferences"* is two. Hence a tag set rather than a single kind.
3. **Summer is never published as an event.** It is derived from `lastInstructionalDay` of one year and `firstInstructionalDay` of the next. This is the opposite of this ADR's first draft, which stored summer as a closure.
4. **A district is not always one calendar.** Chesterfield publishes a traditional calendar and a separate year-round one for Bellwood Elementary, so a Bellwood family's summer is not Chesterfield's. Hence `type` and a nullable `school`.

**Deliberately out of scope, and the cost of that:**

- **Early release.** CCPS has seven three-hour dismissals in 2026-27 and eight in 2027-28 — as many as full holidays, and three hours' notice wrecks a workday. We are not storing them. Adding them later means a migration and a `shape` column; that is the accepted price of a smaller v1.
- **Staggered first days.** Grades 1-5, 6 and 9 start Aug 24 2026; grades 7-8 and 10-12 start Aug 25. `firstInstructionalDay` records the earlier date, so **a seventh-grader's genuine day off on Aug 24 is not reported as a gap.** One or two days a year, at a known boundary, and recording the later date instead would invent a false gap for the majority who do have school.
- **Prekindergarten and kindergarten** stagger per child across the first week, and the district says so without saying which child. Unknowable from any published source.

## Alternatives considered

**Keep `SchoolCalendar` and add a `days_off` table.** Two models of one fact, two code paths, every analyzer written twice and drifting. This is the pigeonholing the change exists to avoid.

**Store closures directly, including summer as a closure.** This ADR's own first draft. Rejected on contact with the source: no district publishes a summer event, so every summer row would be a verifier's arithmetic rather than a transcription. The first draft justified it by claiming next year's start date is published too late to derive summer. **That claim was wrong** — CCPS published 2027-28 before September 2026, roughly two years ahead.

**One row per closed date.** Summer alone is about sixty rows, each hand-verified. "Jun 7 through Aug 20" becomes sixty facts to get right instead of two.

## Consequences

- **+** One primitive, one set of analyzers, one card component. A Tuesday in November and the week of July 13 are the same shape all the way down.
- **+** Stored rows are a transcription of the published calendar, so a human can check a row against the document without doing date arithmetic.
- **+** `weeks.ts` is re-seated, not rewritten. The partial-boundary-week logic — the subtlest code in the repo — survives behind `weeksBetween(start, end)` with its tests.
- **+** The iCal feed makes ingestion cheap. A calendar skill parses it into closures for review; per AGENTS.md §2 a human clears the queue and nothing automated publishes.
- **+** Dropping early release and grade scope leaves a closure table with no nullable behaviour columns. Every row means one thing.
- **−** The feed is a rolling window of roughly thirteen months, while the HTML page carries two full years. **The HTML is authoritative; the feed is a convenience.** A skill reading only the feed will silently miss next year.
- **−** Summer needs two adjacent school-year records. Missing the later one means the period is unknown and the app says summer is not published yet, rather than inventing an end date.
- **−** Reference data grows from 2 fields to roughly 16 closures per calendar per year, and Chesterfield alone has two calendars. Parsing makes that cheap to draft and no cheaper to verify.
- **−** Calendars change. CCPS states the board may modify them and the superintendent sets snow makeup days, so `verified_at` staleness is real and re-checking has to be a scheduled job.
