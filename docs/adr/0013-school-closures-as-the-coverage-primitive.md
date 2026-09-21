# 13. A school closure is the coverage primitive, not a summer

- Status: Accepted
- Date: 2026-09-21
- Supersedes the `weeks.ts` row of [ADR-0008](./0008-planner-package.md) and the `school_calendars` shape in `20260914000100_catalog.sql`. The rest of ADR-0008 stands.

## Context

The product was scoped as summer planning, so the model was scoped to summer. `SchoolCalendar` holds two dates — the last day of school and the first day back — and `summerWeeks()` turns them into the grid.

That is the wrong shape for what we actually sell. School closes on roughly eighteen other days a year: holidays, teacher workdays, conference days, winter and spring break. Those are the days that go unnoticed. A parent who does not observe Yom Kippur has no reason to expect their district to close for it, and finding out on the Sunday night is the exact failure Campout exists to prevent. Summer is still the primary case, but it is not a different problem — it is the longest run of the same one.

Two dates cannot express eighteen scattered days. The question is what replaces them.

We are one PR into this project. No migration has been applied to any Supabase project, `@campout/planner` has one shipped module that depends on this shape, and the directory UI has not been built. The cost of changing the model now is a day. The cost of changing it after the grid ships is most of the grid.

## Decision

**The primitive is a closure: a contiguous run of days school is shut, with a reason. Summer is a closure like any other, distinguished only by its `kind` and its length.**

### The planner types

```ts
export enum ClosureKind {
  Summer = 'summer',
  Break = 'break',                  // winter, spring, fall
  Holiday = 'holiday',              // Labor Day, MLK, Yom Kippur
  TeacherWorkday = 'teacher_workday',
  Other = 'other',
}

/** A run of days school is closed. Inclusive on both ends; a single day has startDate === endDate. */
export interface Closure {
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  /** The district's own words: "Yom Kippur", "Teacher workday". Shown to the parent verbatim. */
  readonly reason: string;
  readonly kind: ClosureKind;
}

/** Everything one district says about one school year. */
export interface SchoolYearCalendar {
  readonly district: SchoolDistrict;
  /** "2026-27", as the district labels it. */
  readonly label: string;
  /** The window this record makes claims about. Outside it we do not know, and say so. */
  readonly coversFrom: CalendarDate;
  readonly coversTo: CalendarDate;
  readonly closures: readonly Closure[];
}
```

Derived, never stored:

```ts
/** One column. Shape is unchanged from SummerWeek — only the name and the source widened. */
export interface CoverageWeek {
  readonly index: number;
  readonly monday: CalendarDate;
  readonly friday: CalendarDate;
  readonly isPartial: boolean;
  readonly firstDayNeedingCover: CalendarDate;
  readonly lastDayNeedingCover: CalendarDate;
}

/** A closure resolved into the days and columns a parent has to fill. */
export interface CoveragePeriod {
  readonly closure: Closure;
  readonly weekdays: readonly CalendarDate[];
  readonly weeks: readonly CoverageWeek[];
}
```

| Function | Responsibility |
|---|---|
| `coveragePeriods(calendar)` | Every closure resolved, in date order. Summer is one entry among about sixteen. |
| `summerOf(calendar)` | The `kind: Summer` period, or `undefined` when the district has not published it yet. |
| `weeksBetween(start, end)` | Monday-anchored columns for any span. This is the surviving core of `weeks.ts`. |
| `weekIndexOf(period, date)` | Maps a date to a column within its period. Replaces `summerWeekIndexOf`. |
| `coveragePeriodOf(calendar, date)` | The closure covering a date. **Throws** outside `coversFrom`/`coversTo`. |

**One period type means one set of analyzers.** `coverage.ts`, `overlap.ts`, `hours.ts` and `logistics.ts` take a `CoveragePeriod` and never learn what summer is. A single day off is a period with one weekday and one partial week, which is why the same card renders a Tuesday in November and the week of July 13.

### The window, and refusing to guess

A date inside no closure could mean school is in session, or it could mean nobody has entered that year yet. Those must not be the same answer. `coversFrom`/`coversTo` state the span the record speaks for; a query outside it throws, per AGENTS.md §1 — *refuse rather than guess*. A silently in-session answer is how a parent gets told a day is fine when we have never looked.

### Schema

```sql
create extension if not exists btree_gist;

create type closure_kind as enum ('summer', 'break', 'holiday', 'teacher_workday', 'other');

create table school_calendars (
  id           uuid primary key default gen_random_uuid(),
  district     school_district not null,
  label        text not null,                    -- '2026-27'
  covers_from  date not null,
  covers_to    date not null,
  source_url            text,
  source_document_path  text,
  verified_at           timestamptz not null,
  verified_by           text        not null,
  unique (district, label),
  constraint school_calendars_window check (covers_to > covers_from),
  constraint school_calendars_provenance_present
    check (source_url is not null or source_document_path is not null)
);

create table school_closures (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references school_calendars (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text not null,
  kind        closure_kind not null,
  constraint school_closures_ordered check (end_date >= start_date),
  exclude using gist (
    calendar_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);
```

The exclusion constraint makes overlapping closures within one calendar impossible. Two rows both claiming December 21st is the start of winter break is a data-entry mistake we will otherwise make, and it would double-count a gap.

**What the database does not enforce:** that a closure falls inside its calendar's window. A check constraint cannot read the parent row, and a trigger would hide the rule somewhere nobody reads. Following [ADR-0012](./0012-provenance-url-or-stored-document.md), we state the limit rather than half-enforce it: containment is the verification workflow's job, and a closure outside its window is a data-quality bug.

Both tables are catalog-side — world-readable, `service_role` writes only, RLS enabled with a select policy, exactly as ADR-0004 requires.

### Replacing rather than migrating

No migration has been applied to any Supabase project, so `20260914000100_catalog.sql` is **edited in place** and `pnpm supabase:reset` reapplies from scratch. The decision rule if that changes: the moment any shared environment has run it, this becomes an additive migration instead.

## Alternatives considered

**Keep `SchoolCalendar` and add a `days_off` table.** The cheapest change and the one we rejected hardest. It creates two models of one fact. "Is this day covered?" gets answered down two code paths, summer through the grid and days off through a list, and every analyzer gets written twice and drifts. This is the pigeonholing the model change exists to avoid.

**Store instructional days, derive closures from the gaps.** Closest to how districts publish, and genuinely tempting. It fails on summer: summer 2027 sits between the 2026-27 and 2027-28 calendars, so deriving it needs two rows, and districts publish the following year's start date late. The primary use case would be blocked on a PDF we do not control. Storing closures directly keeps summer in one row.

**One row per closed date.** Simplest to query, worst to enter and to read. Summer alone is about sixty rows, a human verifies every one of them by eye in Supabase's table editor, and "Jun 12 through Aug 21" becomes sixty facts to get right instead of two.

## Consequences

- **+** One primitive, one set of analyzers, one card component. The Tuesday in November and the week of July 13 are the same shape all the way down.
- **+** `weeks.ts` is re-seated, not rewritten. The partial-boundary-week logic — the subtlest code in the repo — survives intact behind `weeksBetween(start, end)`; its tests move with it.
- **+** Data entry matches the source document. A verifier reads a published calendar and enters about sixteen rows, one of which is summer.
- **+** A one-day camp needs no catalog change. It is already a `sessions` row with `start_date == end_date`.
- **−** `SummerWeek`, `SchoolCalendar` and `summerWeeks()` are renamed and re-sourced. `src/app/page.tsx` and its tests move with them. Contained, but not free.
- **−** Reference data grows from 2 fields to roughly 16 rows per district per year. Four districts is about 64 closure rows a year, hand-verified. That is the real recurring cost of this decision, and it is a people problem rather than a code one.
- **−** Summer only appears once the district publishes the following year's first day. Until then `summerOf()` returns `undefined` and the app says summer is not published yet. We prefer that to inventing an end date.
