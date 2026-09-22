---
name: school-calendar-parser
description: Turn a Richmond-metro district's published school calendar into a draft SchoolYearCalendar/Closure file for human review (CAM-23). Use when given a district name or calendar URL and asked to draft its closures for a school year. Does not write to the database — output is a reviewed-by-diff draft file, never a publish.
---

# Purpose
Reads a district's published school calendar — the part no deterministic parser should be trusted with, because two real districts (Chesterfield, Henrico) turned out to publish it in structurally different, genuinely ambiguous ways — and drafts a `SchoolYearCalendar` with its `Closure` rows, in the shape [ADR-0013](../../../docs/adr/0013-school-closures-as-the-coverage-primitive.md) defines. The draft is for a human to review in a PR diff, the same pattern CAM-1 established for camp data. Nothing this skill produces is published directly (AGENTS.md §2) — `school_calendars`/`school_closures` require `verified_at`/`verified_by` on every row (ADR-0012) and structurally cannot hold an unverified draft.

A thin, already-written TypeScript validator (`src/lib/calendars/validateCalendarDraft.ts`, `findDraftIssues`) gates the draft before it's considered done. That module owns structural correctness — it reuses `orderedCalendars()` from `@campout/planner`, the same checks CAM-22 already ships (span consistency, no overlapping or out-of-window closures, `YYYY-YY` label format) — plus provenance. This skill owns everything that requires reading unstructured text: which is not something to hand-code per district.

# When to use
Given a district name (or its calendar URL) and a school year, or two adjacent years. Not for entering already-verified data into Postgres — that promotion step belongs to CAM-4, once a human has cleared the draft this skill produces.

# Inputs
- **District** — one of the four `SchoolDistrict` enum values (`richmond_city`, `chesterfield`, `henrico`, `hanover`), or a URL to that district's published calendar.
- **School year(s)** — one label (`2026-27`) or two adjacent ones. Two adjacent years are strongly preferred: summer never publishes as an event anywhere seen so far, so it only resolves once both years are held (see `longestPeriod` in `@campout/planner`).
- If a Linear ticket number is given (e.g. `CAM-23`, or the district's slice of `CAM-4`), read its TC section first — it carries source-specific findings from prior runs against that exact district, and this skill should not rediscover them from scratch.

# Rules learned from two real, structurally different sources
These held for both Chesterfield (HTML page + a clean 29-event ICS feed + a separate year-round calendar) and Henrico (HTML page + a PDF reached only through a redirect + an unfiltered 2,300-event general-events ICS feed). Treat them as general, not Chesterfield-specific — that they held for two differently-shaped sources is the evidence they generalize. A third district may still break one; when it does, flag rather than force it, and record what actually happened in that ticket's TC.

1. **The HTML page is the default primary source, not any feed.** Confirmed for two districts for two different reasons: Chesterfield's ICS is a rolling ~13-month window that silently drops next year; Henrico's ICS isn't closure data at all, it's the district's whole public events calendar, with real closures needle-in-a-haystacked among thousands of unrelated events. A feed is useful for **re-checking** a calendar already held, never for first ingest. If a PDF exists and is clearer than the HTML, prefer it — but confirm it's the same content, not a stale prior year.
2. **A bot-check or "client challenge" page blocking a plain fetch is not a dead end.** A real browser session (e.g. headless Chromium) usually renders the actual page; check `robots.txt` first and stay within it.
3. **A "printable calendar" link is often an image wrapped in a link to a redirector, not a direct `<a href=".pdf">`.** Follow redirects; confirm the final `content-type` is actually a PDF before treating it as one.
4. **Compound summaries are normal.** One event, several facts, only some of them closures (e.g. "End of Q4; 3-hour early release; final day of school"). Split it; store only what ADR-0013 models. An early-release day or a grade-staggered start date is out of scope (ADR-0013/CAM-22) even when the district gives it a specific date — do not record it as a `Closure`.
5. **Identical labels are common and mean nothing on their own.** A district may reuse one literal string ("Holiday, schools and offices closed") for many unrelated holidays. `sourceLabel` is always that literal string, verbatim — never edited, never invented. `commonName` is filled in only when there's a real, citable reason to know which holiday it is (a date that's unambiguously Labor Day, a month name in an otherwise generic entry); if there's genuinely no way to tell, leave `commonName` unset rather than guess, and add a flag so a reviewer can look it up.
6. **A policy statement about absences is not a closure.** Districts sometimes publish things like "religious-holiday absences will be excused" near the calendar. That is not a day school is shut; do not create a `Closure` for it.
7. **A multi-day closure is one row**, `startDate` through `endDate` inclusive — never one row per day.
8. **A district may publish more than one calendar** (e.g. Chesterfield's Bellwood Elementary year-round calendar). Check explicitly for a school-specific variant before assuming a single district-wide calendar is the whole picture; absence of evidence after checking is fine to record as such in TC, but don't skip the check.
9. **Grade-stagger and pre-K/kindergarten start dates are out of scope even when a district is unusually specific about them** (ADR-0013/CAM-22). Don't record them as closures or let precision tempt you into treating them as a placeable fact — the ticket's TC decides this per district; when in doubt, flag it instead of deciding.

# Workflow

## 1. Gather source-specific context
Read the calling ticket's TC notes for this district if given one. Note the calendar URL(s), whether a bot-check blocks a plain fetch, and whether a PDF or ICS feed exists alongside the HTML page.

## 2. Fetch the primary source
Prefer the rendered HTML page. If blocked by a bot-check, use a real browser session. Capture the two adjacent school years if both are published (most districts seen so far publish at least the current and next year on one page).

## 3. Extract
Walk the page month by month. For each entry:
- Decide whether it's a closure at all (§ Rules 4 and 6).
- Record `startDate`/`endDate` (inclusive), `tags` (`holiday` / `teacher_workday` / `conference_day` / `break` — a closure can carry more than one), `sourceLabel` (verbatim), and `commonName` only when justified.
- Track `firstInstructionalDay` and `lastInstructionalDay` for the year, and set `coversFrom`/`coversTo` to a window that contains them (the natural choice is to let the window start/end where the published calendar itself starts/ends).
- Check for a second, school-specific calendar (§ Rule 8).

## 4. Flag, don't guess
Anything that doesn't cleanly resolve — an ambiguous date, a closure that seems to fall outside the year's instructional window, a missing first or last instructional day, an unclear compound summary — goes into the draft's `flags: string[]` as a plain-language question for the reviewer. Do not default, omit silently, or invent a value to make the shape complete.

## 5. Assemble and validate
Build a `CalendarDraft` (from `src/lib/calendars/validateCalendarDraft.ts`):
```ts
interface CalendarDraft {
  readonly calendar: SchoolYearCalendar; // from @campout/planner
  readonly sourceUrl?: string;
  readonly sourceDocumentPath?: string; // relative path to a captured copy, when the source isn't a durable URL
  readonly flags: readonly string[];
}
```
Run `findDraftIssues(draft)`. **Do not write the draft file until this returns an empty array.** Its issues are structural defects (per `orderedCalendars`) or missing provenance — both are bugs in the draft, not judgment calls, and belong in `flags` only if they're genuinely unresolvable from the source, never as a way to skip validation.

## 6. Capture provenance
If the source is a durable, stable URL, set `sourceUrl` and leave `sourceDocumentPath` unset. If it's not durable — a redirector, a page that's known to change without an archived history, a PDF behind a short link — save a copy alongside the draft (`docs/data/school-calendars/<district>-<label>.source.pdf` or `.html`) and set `sourceDocumentPath` to that relative path. **This is a stopgap, not ADR-0012's real destination** — the private `camp-sources` Supabase bucket doesn't exist yet (no project is deployed). Add a flag noting the path will need to move into the bucket when the draft is promoted.

## 7. Write the draft
One file per district per school year: `docs/data/school-calendars/<district>-<label>.draft.ts`, e.g. `chesterfield-2026-27.draft.ts`, `chesterfield-bellwood-2026-27.draft.ts`, `henrico-2026-27.draft.ts`. Export the validated `CalendarDraft`.

## 8. Report
Summarize for the human reviewer: how many closures were drafted, what (if anything) got flagged and why, and where the draft file and any captured source document landed. The PR diff is the review — there is no separate queue to submit to.
