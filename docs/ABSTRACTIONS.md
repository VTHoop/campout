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
- It **throws** when we cannot say — the date is before the first calendar, after the last summer we can resolve, or in a summer whose preceding year is not held. A date we hold no calendar for is not "school is in session".
- `longestPeriod` returns `undefined` when there is no summer to show: the gap holds no weekday, or the following year is absent **and** its estimated first day fails the range check.

**When the following year is not published, summer's end is estimated** ([ADR-0014](./adr/0014-estimating-an-unpublished-first-day-back.md)). Richmond City and Hanover publish one year at a time, after camp registration opens. `estimateNextFirstDay` in `estimate.ts` applies the rules: a Labor Day anchor, then the same weekday counted back from the end of the month, then a Jul 1 – Sep 15 range check. Nothing is stored, so a published calendar replaces the estimate on the next read.

Every `CoveragePeriod` has a **`basis`**: `PeriodBasis.Published`, or `PeriodBasis.Estimated` with `estimatedBy` naming the `EstimateRule`. It is a union, so narrow on `basis` before reading `estimatedBy`. **Never present an estimated end date as the district's.** The published date always wins: with the following year held, nothing is estimated.

**Which summers a parent can pick** is `summerChoices(calendars, today)` in `summers.ts`. It offers every summer between two consecutive loaded years, earliest first, and adds an estimated summer only when that summer is the upcoming one: a published summer is never displaced by a guess. `upcoming` is the summer in progress on `today`, else the next to start, else the latest the calendars produce. Pass `today` in; the page reads it with `richmondDate(new Date())` at the request boundary (`src/lib/today.ts`).

A `CoveragePeriod` for the between-years gap carries a **derived** `Closure`: tagged `break`, with a `sourceLabel` that says so (and says the first day back is estimated when it is). The district never said it, so never show that label as the district's words.

The planner also **throws** on a calendar that contradicts itself — a closure outside its instructional days, two closures sharing a day, overlapping school years, a coverage window that does not contain its own school year. An empty grid reads to a parent as "nothing to plan", which is worse than a loud failure.

Years are neighbours when their **labels** follow each other (`2026-27`, then `2027-28`); a label that is not `YYYY-YY` throws. Pass calendars for **one district or school**. `coveragePeriods` sorts them for you, but it refuses a list that mixes owners, because a gap between a district's year and one school's own year is not a summer.

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

`providers`, `camps`, `locations`, `sessions` and `school_calendars` each carry their evidence (`source_url` or `source_document_path`), a `status`, and `verified_at`/`verified_by`, which are required once the row is verified.

**A read model that can represent an unverified record is a bug.** Build types so a record without `verifiedAt` cannot be constructed, rather than checking for it at every render site — the check you have to remember is the one that gets missed. `verified_at` is shown to the parent on every session: stale data here is not cosmetic, because a parent who shows up to a camp that moved has lost a workday.

**The one open exception is `SessionCardView`** (`src/lib/catalog/session-cards.ts`, CAM-32), which has no `verifiedAt` yet because it is built on the unverified mock catalog. CAM-28, which moves it onto Supabase, adds `verifiedAt` as a required field and the card's verified line with it.

## The catalog review gate

Nothing reaches a parent until a reviewer approves it (ADR-0017). Four pieces, all in the database:

- **`is_reviewer()`** — the reviewer counterpart of `is_household_member()`: `SECURITY DEFINER`, pinned `search_path`, reads `reviewers` for `auth.uid()`. Every catalog read policy is *verified (whole chain) **or** `is_reviewer()` **or** in my own plan*. The chain checks are definer predicates too (`camp_is_public()`, `session_is_public()`, …), so a policy can ask about a parent row without that row's policy recursing.
- **`approve_record(kind, id)`** — the only way to `verified`. It checks `is_reviewer()` itself and refuses anything not ready (unverified parents, no options, an unconfirmed long span).
- **`reviewer_edit(kind, id, changes)`** — the only way to change a verified row's facts. It names its columns statically and merges `changes` with `jsonb_populate_record`, so there is no dynamic SQL. An unknown or non-fact key is refused, not ignored.
- **The gate flag.** Both functions set the transaction-local `campout.catalog_gate` around their own writes. The guard triggers let a write through only while it's on, which is why the secret key can't publish by accident. It stops mistakes, not a key holder who disables the trigger.

**The general rule:** anything that changes what a parent sees goes through one of the two functions. A new reviewer action (adding an option to a verified session, say) is a new function that opens the gate, never a loosened trigger.

## Session cards come from one service

The Find camps page and `SessionCard` read session cards only as `SessionCardView`s from `listSessionCards()` (`src/lib/catalog/session-cards.ts`). Neither imports the catalog. The service joins each session to its camp, provider and location, picks the registration link (the camp's registration URL, else its phone, else the provider's website), and throws on a reference it cannot resolve. It is async already, so swapping the mock catalog for a Supabase read (CAM-28) touches neither the page nor the card.

## The browser vault (`src/lib/vault/`, not yet built)

Emergency contacts, insurance, physician, medical history — everything camp registration forms want and Campout must never hold.

Browser storage only. Never sent to Supabase, never logged, never in an error report, never in a server component's props. Vault modules carry a `server-only` guard so importing one from server code is a **build error**, not a review comment somebody might miss.

**Cross-device sync is out of scope and needs a new ADR** (ADR-0006). It is not an implementation detail.

## Displaying a `CalendarDate`

```ts
import { longMonthDay, shortMonthDay } from '@/lib/dates'; // 'June 14', 'Jun 14'
import { districtName } from '@/lib/districts'; // 'Richmond City'
```

Format dates for display through `src/lib/dates.ts`, never with `new Date(date).toLocaleDateString()`: a bare `YYYY-MM-DD` parses as UTC midnight and prints as the day before anywhere west of Greenwich. The helpers validate the date and format it in UTC, so the day shown is the day stored.

## shadcn/ui and `cn`

Components live in `src/components/ui/`, restyled on Campout tokens (ADR-0015). Join classes with `cn` from `src/lib/utils.ts`: it knows our `text-*` type roles, which plain tailwind-merge would mistake for colours and drop. Style a pressed or selected state from its ARIA attribute (`aria-pressed:bg-ink`), as the week picker does, so the colour cannot drift from what a screen reader hears.

## Sign-in: one page, one callback, one check

Sign-in is a magic link (ADR-0003), and nothing in the app decides who a reviewer is: RLS and `is_reviewer()` do.

- **`createClient()` comes in two flavours.** `@/lib/supabase/server` for Server Components and route handlers, `@/lib/supabase/browser` for Client Components. Both hold the publishable key and the user's own session. The secret key never appears in `src/`.
- **`src/proxy.ts` keeps the session alive.** A Server Component cannot set cookies, so the proxy refreshes the token on each page request. Do not call `getSession()` to ask "who is this?" on the server; call `getUser()`, which checks the token with Supabase.
- **`safeNextPath(value)` is the only way to use a `?next=`.** It lets through a path on this site and sends everything else (a full URL, `//host`, `/\host`, a missing value) to `/`. The callback applies it again, so the form's own check is a convenience, not the boundary.
- **A link that does not work always ends the same way:** `/sign-in?error=link`, signed out.
- **Sign out is a POST** to `/auth/sign-out`, so another site cannot sign anyone out with a link.

## Server vs. Client Components

The boundary agents get wrong most often, so state it plainly:

- **Server Component (default):** catalog reads, anything touching the database, anything importing `server-only`.
- **Client Component (`"use client"`):** the planner grid, the map, anything with an event handler or local state, and the nav bar, which reads the current path to mark its active tab, and the summer's weeks (`SummerWeeks`), which read the selected week from `?week=` and change it with `history.pushState` — Next.js syncs that into `useSearchParams` with no server round trip.
- **The planner package runs in both.** That is the point of its purity.
- **The vault is client-only, always.** If you find yourself passing vault data across the boundary as props, stop — that is the leak ADR-0006 exists to prevent.

## Enums and the database

A finite set of internal values is a **TS string enum**, not a literal union — callers get a named symbol instead of a quoted string to typo.

The exception is anything persisted. **Postgres owns the persisted domain** (an enum type or a `CHECK`), and `src/lib/db/types.ts` is *generated* from the schema by `pnpm db:types` — never hand-edited. Where a TS enum and a database domain describe the same set, tie them together with a compile-time guard so the two cannot drift. The planner's `SchoolDistrict`, `CalendarType` and `ClosureTag` are locked in `src/lib/db/enum-mirrors.ts`; add a line there for any new mirror.

## `details` — one parser, one vocabulary

Facts a parent reads but the app never computes with live in `details` `jsonb` on camps, sessions and options (ADR-0017 §5, CAM-27 decision 12). The database refuses a write outside the vocabulary; **the app reads `details` only through `parseCampDetails` / `parseSessionDetails` / `parseOptionDetails`** in `src/lib/db/details.ts`, which throw a `DetailsError` naming the path on anything that has drifted. Nothing else touches a raw key. The parser's readers mirror the migration's schema functions and change in the same commit. **A key becomes a column when the app needs to filter or sort by it.**

## Avoiding the object-injection finding

Codacy flags every `obj[key]` with a non-literal key as a **Generic Object Injection Sink**. Three shapes cover every case:

| Situation | Shape |
|---|---|
| id / dynamic-key lookup | a `ReadonlyMap` |
| an exhaustive keyed table | declare with `satisfies Record<Key, V>`, read through a `Map` built from `Object.entries` |
| a small fixed field set | write the reads out, one per line |

**The tell:** if you are writing `as Record<string, T>` to make an index compile, you are about to introduce this finding *and* you have just turned off type checking on that read. Both have the same fix — narrow the type and read the field by name.
