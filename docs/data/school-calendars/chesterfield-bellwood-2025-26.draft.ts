import { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import type { CalendarDraft } from '../../../src/lib/calendars/validateCalendarDraft';

/**
 * Drafted from Chesterfield's "2025-26 Bellwood Year-Round Calendar Dates"
 * accordion panel. Only a 2025-26 Bellwood calendar is currently published —
 * no 2026-27 Bellwood year exists yet to pair with the traditional-calendar
 * draft, so summer will not resolve for this calendar alone; that is
 * expected, not a defect in this draft.
 *
 * A year-round calendar uses short "intersession breaks" between terms
 * instead of one long summer — the whole reason ADR-0013 keeps `type` on
 * `SchoolYearCalendar` rather than assuming every calendar looks like summer
 * plus scattered days.
 */
export const chesterfieldBellwood202526Draft: CalendarDraft = {
  calendar: {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.YearRound,
    school: 'Bellwood Elementary',
    label: '2025-26',
    firstInstructionalDay: '2025-07-21',
    lastInstructionalDay: '2026-06-03',
    coversFrom: '2025-07-21',
    coversTo: '2026-06-03',
    closures: [
      {
        startDate: '2025-08-29',
        endDate: '2025-08-29',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2025-09-01',
        endDate: '2025-09-01',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Labor Day',
      },
      {
        startDate: '2025-09-29',
        endDate: '2025-10-10',
        tags: [ClosureTag.Break],
        sourceLabel: 'intersession break',
      },
      {
        startDate: '2025-11-03',
        endDate: '2025-11-03',
        tags: [ClosureTag.ConferenceDay],
        sourceLabel: 'student holiday and parent-teacher conference day',
      },
      {
        startDate: '2025-11-04',
        endDate: '2025-11-04',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2025-11-26',
        endDate: '2025-11-28',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Thanksgiving break',
      },
      {
        startDate: '2025-12-22',
        endDate: '2026-01-02',
        tags: [ClosureTag.Break],
        sourceLabel: 'winter break',
        commonName: 'Winter break',
      },
      {
        startDate: '2026-01-05',
        endDate: '2026-01-09',
        tags: [ClosureTag.Break],
        sourceLabel: 'intersession break',
      },
      {
        startDate: '2026-01-19',
        endDate: '2026-01-19',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Martin Luther King Jr. Day',
      },
      {
        startDate: '2026-03-16',
        endDate: '2026-03-27',
        tags: [ClosureTag.Break],
        sourceLabel: 'intersession break',
      },
      {
        startDate: '2026-03-30',
        endDate: '2026-04-03',
        tags: [ClosureTag.Break],
        sourceLabel: 'spring break',
      },
      {
        startDate: '2026-04-21',
        endDate: '2026-04-21',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'special election; students will not come to school',
      },
      {
        startDate: '2026-05-25',
        endDate: '2026-05-25',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Memorial Day',
      },
    ],
  },
  sourceUrl: 'https://www.oneccps.org/page/calendars',
  flags: [
    'Oct. 2, 2025 is separately labelled "holiday" but falls inside the already-recorded Sept. 29 – Oct. 10 intersession break; represented as one closure (the broader span) rather than an invalid overlapping pair — reviewer should confirm this is the right call, or whether Oct. 2 deserves its own commonName within the break.',
    'March 20, 2026 is separately labelled "holiday" but falls inside the already-recorded March 16–27 intersession break; same treatment as Oct. 2 above.',
    'April 21, 2026 ("special election; students will not come to school") does not fit any ClosureTag value (holiday/teacher_workday/conference_day/break) — tagged Holiday as the closest existing fit. Worth deciding whether ClosureTag needs a fifth value for civic closures, or whether Holiday is intentionally the catch-all.',
    'The source lists its final two lines under "July 2027" (holiday July 5, last day of summer school July 15) immediately after "June 2026" — almost certainly a typo for "July 2026" given the surrounding chronology. Both dates fall after this calendar\'s lastInstructionalDay regardless, so neither produces a closure row here; noted for the record in case the typo matters elsewhere.',
  ],
};
