# Abstractions

The patterns you are expected to reuse rather than reinvent. **Reuse before recreating** (AGENTS.md §1).

## `CalendarDate` — a date, not an instant

```ts
import type { CalendarDate } from '@campout/planner';
```

A `YYYY-MM-DD` string. Not a `Date`, not a timestamp, not timezone-bearing.

A camp running June 15–19 runs those days in Richmond regardless of where the person reading the screen happens to be. Model it as an instant and it moves by a day for anyone in a different timezone — a parent in the Pacific sees a camp start on the 14th. Every date primitive lives in `packages/planner/src/calendarDate.ts` and anchors to UTC midnight internally, which is an implementation detail that exists to make the arithmetic timezone-immune, not a claim that the values are UTC.

**Validate at the boundary.** `assertCalendarDate(value, label)` throws on anything malformed. It also catches the case `Date.parse` misses: `2027-02-30` parses fine and silently becomes March 2nd. A summer week built on a rolled-over date is off by days, and a parent plans around it.

## The closure model

```ts
const periods = coveragePeriods(calendars, '2026-08-24', '2027-09-30'); // readonly CoveragePeriod[]
const summer = longestPeriod(calendars, '2026-27'); // CoveragePeriod | undefined
const period = coveragePeriodOf(calendars, '2027-07-15'); // CoveragePeriod | undefined
```

**Every screen in the app indexes off these.** Grid columns, coverage gaps, the directory's "which week?" filter — all of them.

A **closure** is a run of days school is shut, and a `CoveragePeriod` is a closure plus its `weekdays` count and its `weeks`. **Summer is not a separate type and is never stored**: it is the gap between one `SchoolYearCalendar`'s `lastInstructionalDay` and the next one's `firstInstructionalDay`, so `coveragePeriods` takes a *list* of calendars. A Tuesday in November and the week of July 13 are the same shape. **[ADR-0013](./adr/0013-school-closures-as-the-coverage-primitive.md) is the decision and the reasoning.**

Weeks are Monday-anchored and run to Sunday, so a Saturday session belongs to the week it starts in. The boundary weeks are the interesting part: when school ends on a Wednesday, that week still needs Thursday and Friday covered, so it appears as a **partial** week. Dropping it would hide a real gap; treating it as full would report a gap on days the child was in school. `CoverageWeek.isPartial`, `firstDayNeedingCover`, and `lastDayNeedingCover` carry that distinction — use them rather than assuming Monday-to-Friday. `weeksBetween(start, end)` in `weeks.ts` owns that logic; call it rather than re-deriving it.

**Three answers, and the difference between them matters:**

- `coveragePeriodOf` returns `undefined` when school is in session that day.
- It **throws** when we cannot say — the date is before the first calendar or after the last, or it falls in a summer whose neighbouring year is not held. A date we hold no calendar for is not "school is in session".
- `longestPeriod` returns `undefined` when the following year's calendar is absent, so the app can say summer is not published yet. **It never invents an end date.**

A `CoveragePeriod` for the between-years gap carries a **derived** `Closure`: tagged `break`, with a `sourceLabel` that says so. The district never said it, so never show that label as the district's words.

The planner also **throws** on a calendar that contradicts itself — a closure outside its instructional days, two closures sharing a day, overlapping school years, a coverage window that does not contain its own school year. An empty grid reads to a parent as "nothing to plan", which is worse than a loud failure.

Years are neighbours when their **labels** follow each other (`2026-27`, then `2027-28`); a label that is not `YYYY-YY` throws. Pass calendars for **one district or school**. `coveragePeriods` sorts them for you, but it refuses a list that mixes owners, because a gap between Chesterfield's year and Bellwood's is not a summer.

## Purity in `@campout/planner`

No database client, no `fetch`, no React, no `process.env`, **no `new Date()` with no argument**. Every function that reasons about time takes the date it needs as a parameter.

This is not style. A planner that reads the wall clock has tests that pass in September and fail in July, and that failure surfaces in the one month of the year when the product matters. The package compiles with **no DOM lib**, so a violation is a compile error rather than something discovered in production.

When you add an analyzer, follow the existing shape: **a plain snapshot in, findings out.** Analyzers compose; none calls another.

## `is_household_member(uuid)` — the single access primitive

Every household-side RLS policy resolves identity through this one `SECURITY DEFINER` function. Household membership is the only concept of access in the app.

**Never inline an equivalent check into a policy.** Two spellings of the same rule drift, and the drift is a privacy bug rather than a rendering bug. It is `SECURITY DEFINER` with a pinned `search_path` because it reads `household_members`, which is itself RLS-protected — without that, the policies recurse.

When you add a household-scoped table: add the `household_id` column, enable RLS in the same migration, write the policies through this function, and ship the **negative-case test in the same PR** (ADR-0004).

## `create_household()` — the only way to make a household

`households` has no `INSERT` policy. Creating one goes through the `create_household` RPC, which inserts the household and its first membership row together (ADR-0011).

**Do not add an `INSERT` policy to work around this.** It was tried as a permissive policy plus an `AFTER INSERT` trigger and it fails: Postgres evaluates the SELECT policy on a `RETURNING` clause *before* after-row triggers fire, so `insert … returning id` is rejected even though the insert itself is allowed. The policy suite caught it on the first run.

The general rule this leaves behind: **if a policy depends on state a trigger creates, the trigger is too late.**

## Catalog provenance

`camps` and `sessions` both carry `source_url`, `verified_at`, and `verified_by`, all `NOT NULL`.

**A read model that can represent an unverified record is a bug.** Build types so a record without `verifiedAt` cannot be constructed, rather than checking for it at every render site — the check you have to remember is the one that gets missed. `verified_at` is shown to the parent on every session: stale data here is not cosmetic, because a parent who shows up to a camp that moved has lost a workday.

## The browser vault (`src/lib/vault/`, not yet built)

Emergency contacts, insurance, physician, medical history — everything camp registration forms want and Campout must never hold.

Browser storage only. Never sent to Supabase, never logged, never in an error report, never in a server component's props. Vault modules carry a `server-only` guard so importing one from server code is a **build error**, not a review comment somebody might miss.

**Cross-device sync is out of scope and needs a new ADR** (ADR-0006). It is not an implementation detail.

## Server vs. Client Components

The boundary agents get wrong most often, so state it plainly:

- **Server Component (default):** catalog reads, anything touching the database, anything importing `server-only`.
- **Client Component (`"use client"`):** the planner grid, the map, anything with an event handler or local state.
- **The planner package runs in both.** That is the point of its purity.
- **The vault is client-only, always.** If you find yourself passing vault data across the boundary as props, stop — that is the leak ADR-0006 exists to prevent.

## Enums and the database

A finite set of internal values is a **TS string enum**, not a literal union — callers get a named symbol instead of a quoted string to typo.

The exception is anything persisted. **Postgres owns the persisted domain** (an enum type or a `CHECK`), and `src/lib/db/types.ts` is *generated* from the schema by `pnpm db:types` — never hand-edited. Where a TS enum and a database domain describe the same set, tie them together with a compile-time `AssertEqual` guard so the two cannot drift.

## Avoiding the object-injection finding

Codacy flags every `obj[key]` with a non-literal key as a **Generic Object Injection Sink**. Three shapes cover every case:

| Situation | Shape |
|---|---|
| id / dynamic-key lookup | a `ReadonlyMap` |
| an exhaustive keyed table | declare with `satisfies Record<Key, V>`, read through a `Map` built from `Object.entries` |
| a small fixed field set | write the reads out, one per line |

**The tell:** if you are writing `as Record<string, T>` to make an index compile, you are about to introduce this finding *and* you have just turned off type checking on that read. Both have the same fix — narrow the type and read the field by name.
