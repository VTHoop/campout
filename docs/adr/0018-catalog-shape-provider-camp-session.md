# 18. Catalog shape: provider → camp → session, with time options and shared locations

- Status: Accepted
- Date: 2026-09-30
- Supersedes: [ADR-0012](./0012-provenance-url-or-stored-document.md)'s registration clause, *"A session adds `registration_note` for the instructions when there is no link, and a check constraint requires one or the other."* Registration and its check now live on the camp. The rest of ADR-0012 stands, including that evidence is a URL or a stored document and never neither, now on `providers` as well.

## Context
The first catalog schema (`20260914000100_catalog.sql`) had two levels: a camp was the organization, and a session was a dated offering carrying its own name, category, hours, care window, single price and registration. Locations belonged to one camp.

Transcribing four real camps into the mock catalog (acac, SwimRVA, SCOR and Richmond Ballet: CAM-1, CAM-42, PR #19) showed where that shape breaks:

- **An organization runs several programs.** acac runs a summer camp and a tennis camp, each with its own categories and registration. Twelve themed weeks of one program are not twelve programs.
- **A session is often offered more than one way.** SCOR sells a full day and a half day of the same week at different prices; others sell a morning and an afternoon that a parent can combine. One price and one set of hours per session can't say that.
- **Care is per option, not per session.** A half-day morning has no late pickup; the full day does.
- **Sites are shared.** acac Midlothian hosts fourteen camps, and a public park hosts several organizations. A location copied per camp stacks map pins, repeats "near me" results, and needs every copy fixed when an address is corrected.
- **Category and registration belong to the program.** Every session of a program shares them, and per-session copies drift.

CAM-27 records each of these as a numbered decision. This ADR keeps the structural ones in the repository, where the schema is.

## Decision

### 1. Three levels: provider → camp → session
- A **provider** is the organization: name, website, phone, email, and provenance.
- A **camp** is a program a provider runs: name, our summary, **categories**, **registration** and `details`. Several of the seven categories are allowed; `day_camp` is for a general program and stands alone.
- A **session** is a dated offering of a camp: dates, one main location, an optional theme, closed days and `details`. It meets every weekday of its range. Anything that doesn't is split into sessions that do, or isn't listed.

The directory still searches **sessions**. Nearly every planner query still starts there.

### 2. Time options carry price, hours and care
A session has **one to three `session_options`**: `full_day`, `morning` and/or `afternoon`, at most one of each. Each option has:

- its own **price, for the session as dated**: a week's price for a week, with no price-unit column;
- **optional hours**, never defaulted;
- **earliest drop-off and latest pickup**, where blank means none is offered.

Coverage is a slot fact. A full day, or a morning plus an afternoon, covers the week.

### 3. Locations are standalone and shared
A location belongs to no camp, and any camp's sessions can point at it. Duplicates are **flagged at review** by a derived, non-unique address key and a ~30 m proximity check (`find_location_duplicates`), not blocked by a unique index. Real venues share an address, and a "normalized address" can't be defined well enough to enforce.

## Consequences
- **+** The shape matches what camps actually publish, so a reviewer transcribes facts instead of squeezing them into the wrong column.
- **+** One row per site and one registration per program means one place to correct each fact.
- **+** Adding meeting days, per-day locations, or a second morning at one camp later is additive: a column with a Mon–Fri default, an override table, or a relaxed unique constraint. No existing row changes.
- **−** One more join on the main search (session → camp for categories, → options for price). `search_sessions()` and its indexes (GiST on the date range, GIN on categories, `(session_id, price_cents)` on options) keep it to one function call.
- **−** A location has no owner, so nothing cascades it away; an orphaned location stays until someone removes it.
- **−** "At least one option per session" can't be a check constraint. The approval step (CAM-27's review gate) enforces it.
- **−** The TypeScript mock catalog keeps its own older shape until CAM-28 deletes it.
