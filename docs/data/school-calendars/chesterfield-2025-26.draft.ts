import { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import type { CalendarDraft } from '../../../src/lib/calendars/validateCalendarDraft';

/**
 * Drafted by the school-calendar-parser skill from Chesterfield's own page —
 * the "2025-26 Traditional Calendar Dates" accordion panel, read with a real
 * browser session (plain HTML, no bot-check). Not yet reviewed: this is the
 * draft a human clears before it becomes real seed data (CAM-4). Drafted for
 * CAM-31, so summer 2026 can be derived from the gap before 2026-27.
 *
 * Staggered start (Aug. 18 for most grades, Aug. 19 for the rest), every
 * "three-hour early release" / "end of quarter" line, and the summer-school
 * dates and July holiday are out of scope per ADR-0013/CAM-22 and are not
 * recorded here.
 */
export const chesterfield202526Draft: CalendarDraft = {
  calendar: {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.Traditional,
    label: '2025-26',
    firstInstructionalDay: '2025-08-18',
    lastInstructionalDay: '2026-05-29',
    coversFrom: '2025-08-18',
    coversTo: '2026-05-29',
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
        startDate: '2025-10-02',
        endDate: '2025-10-02',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Yom Kippur',
      },
      {
        startDate: '2025-11-03',
        endDate: '2025-11-03',
        tags: [ClosureTag.ConferenceDay],
        sourceLabel: 'student holiday; parent-teacher conference day',
      },
      {
        startDate: '2025-11-04',
        endDate: '2025-11-04',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'student holiday',
        commonName: 'Election Day',
      },
      {
        startDate: '2025-11-26',
        endDate: '2025-11-28',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Thanksgiving Break',
      },
      {
        startDate: '2025-12-22',
        endDate: '2026-01-02',
        tags: [ClosureTag.Break],
        sourceLabel: 'winter break',
        commonName: 'Winter Break',
      },
      {
        startDate: '2026-01-19',
        endDate: '2026-01-19',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Martin Luther King Jr. Day',
      },
      {
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday (CCPS will review this holiday date and adjust if necessary)',
      },
      {
        startDate: '2026-03-30',
        endDate: '2026-04-03',
        tags: [ClosureTag.Break],
        sourceLabel: 'spring break',
        commonName: 'Spring Break',
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
    'Aug. 29 and March 20 are listed only as "holiday" with no way to confirm what they mark from this source alone; left commonName unset rather than guess. March 20 carries the district\'s own caveat that it may move — worth re-checking now the date has passed.',
    'Oct. 2 is marked Yom Kippur from the date alone; the source says only "holiday".',
    'Nov. 3 ("student holiday; parent-teacher conference day") is tagged ConferenceDay only, matching the treatment of Nov. 2 in the 2026-27 draft.',
    'No Presidents Day closure appears in the 2025-26 list (2026-27 has one). Recorded as published, not added.',
    'The page also carries a "2025-26 Bellwood Year-Round Calendar Dates" section, but it renders empty. No year-round draft was made (skill Rule 8).',
  ],
};
