# 14. Estimate an unpublished first day back rather than leave summer unknown

- Status: Accepted
- Date: 2026-09-23
- Supersedes one consequence of [ADR-0013](./0013-school-closures-as-the-coverage-primitive.md): *"Missing the later one means the period is unknown and the app says summer is not published yet, rather than inventing an end date."* The rest of ADR-0013 stands, including that summer is derived and never stored.

## Context

ADR-0013 derives summer from one year's `lastInstructionalDay` and the next year's `firstInstructionalDay`, and it refused to guess when the next year was missing. Its alternatives section defended that by saying next year is published early enough: *"CCPS published 2027-28 before September 2026, roughly two years ahead."*

That holds for Chesterfield and nowhere else we checked:

- **Richmond City** publishes only the current school year (2026-27).
- **Hanover** publishes only the current year, and its board approved 2026-27 on **Jan 18, 2026**.

Most summer camps open registration in the **first week of January**. Under ADR-0013 a Richmond City or Hanover family would see "summer not published yet" for the whole stretch in which everyone else is booking, which is the failure Campout exists to prevent. The last day of school is published a full year ahead; only the first day back is missing, so summer's start is always known and only its end has to be estimated.

## Decision

**When the year labelled next is not held, the planner estimates its first instructional day, and summer ends the day before it.** The first rule that applies wins:

1. **Labor Day anchor.** If this year's first day falls within **one week** of Labor Day, before or after, the estimate keeps the same offset from next year's Labor Day. This is the "Tuesday after Labor Day" pattern Virginia once required and some states still do.
2. **Weekday from the end of the month.** Otherwise, the estimate is the same weekday, the same number of whole weeks before the end of the same month. The second-to-last Monday of August stays the second-to-last Monday of August.

**Range check.** An estimate before **Jul 1** or after **Sep 15** is discarded, and summer stays unresolved exactly as ADR-0013 had it. The window is wide on purpose: RPS's 200-day schools start in late July, and no Richmond-metro district returns after mid-September.

**Where the rules live.** In code, as plain functions in `@campout/planner` (`estimate.ts`), not in the database or config. Nothing about an estimate is stored: no calendar row, no closure. It exists only in what `longestPeriod`, `coveragePeriods` and `coveragePeriodOf` return, so the day a real next-year calendar is loaded, the next read uses it and the estimate is gone with nothing to clean up.

**Every `CoveragePeriod` says where its dates came from.** `basis` is `published` or `estimated`, and an estimated period carries `estimatedBy`, the rule that produced it. The type is a union, so an estimated period without its rule cannot be built. An estimated summer's `sourceLabel` says the first day back is ours, so it is never shown as the district's words.

**Calendar type does not change estimation.** A year-round calendar still has a gap between one year's last day and the next year's first, and it is a real break when camps are open. `type` keeps its ADR-0013 role of telling the UI what length of summer it may promise.

**The published date always wins.** When the following year is held, summer is derived exactly as before and is never marked estimated.

## Validated against real data

Checked during refinement (Sep 2026) against the real first days of all four districts. The day given is the earliest day of each district's staggered start.

| School year | Labor Day | First day (RPS 180-day, Henrico, Hanover, Chesterfield) |
|---|---|---|
| 2024-25 | Sep 2 | Mon Aug 19 (Chesterfield not confirmed) |
| 2025-26 | Sep 1 | Mon Aug 18 |
| 2026-27 | Sep 7 | Mon Aug 24 |

Every district started on **the second-to-last Monday of August**, every year. Rule 2 as decided predicts 2025-26 and 2026-27 exactly. **Counting weeks from the start of the month instead would have said Aug 17 for 2026-27, a week early for every family**, because August 2026 has five Mondays. That miss is why rule 2 counts back from the end of the month.

None of these first days is within a week of Labor Day, so rule 1 does not fire for any v1 district today. It exists for a district that anchors to Labor Day, not for these four.

## Alternatives considered

**Keep ADR-0013's rule: show "not published yet".** Rejected for the reason above. It is honest, but it is honest at exactly the moment the family needed an answer.

**Store the estimate as a provisional calendar row.** Rejected. It puts arithmetic in the table a verifier checks against a document, the thing ADR-0013 refused for summer itself. It would also need cleaning up when the real calendar arrives.

**Nth weekday counted from the start of the month.** Rejected on the data: it misses 2026-27 by a week.

**Use a board-proposed draft calendar as a source, ranked between published and estimated.** Boards post a proposed calendar for comment before they vote. Hanover posted its 2025-26 draft in **October 2024**, months before approval. A draft is a document a verifier can check against, so it beats any rule. **Deferred, not rejected:** it needs someone watching board agendas every fall, and v1 does not have that capacity. It is the first thing to reach for if estimates prove wrong in practice.

## Consequences

- **+** Every district has a summer as soon as its current year is loaded, early enough to book camps.
- **+** Nothing new is stored, so there is no stale estimate to clean up and no new column for a verifier to check.
- **+** The UI can tell an estimated end from a published one and say so. How it shows that, and whether it shows *why*, is left to the summer grid and a later story.
- **−** An estimate can be wrong. A family could plan the last week of summer around an estimate the district later moves. The `estimated` basis exists so the UI never presents it as fact.
- **−** Dates after an estimated first day back are still unknown and still throw. The estimate extends what we can say by one summer, not by a school year.
- **−** The rules are fitted to four districts in one metro. A new market should repeat the check above before trusting them.
