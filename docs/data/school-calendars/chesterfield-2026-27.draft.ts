import { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import type { CalendarDraft } from '../../../src/lib/calendars/validateCalendarDraft';

/**
 * Drafted by the school-calendar-parser skill from Chesterfield's own page —
 * the "2026-27 Calendar Dates" accordion panel, read with a real browser
 * session (the page is plain HTML, no bot-check). Not yet reviewed: this is
 * the draft a human clears before it becomes real seed data (CAM-4).
 *
 * Staggered start (Aug. 24 for most grades, Aug. 25 for the rest) and every
 * "three-hour early release" / "end of quarter" line are out of scope per
 * ADR-0013/CAM-22 and are not recorded here, even though the source dates
 * them precisely.
 */
export const chesterfield202627Draft: CalendarDraft = {
  calendar: {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.Traditional,
    label: '2026-27',
    firstInstructionalDay: '2026-08-24',
    lastInstructionalDay: '2027-06-04',
    coversFrom: '2026-08-24',
    coversTo: '2027-06-04',
    closures: [
      {
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2026-09-07',
        endDate: '2026-09-07',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Labor Day',
      },
      {
        startDate: '2026-09-21',
        endDate: '2026-09-21',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Yom Kippur',
      },
      {
        startDate: '2026-11-02',
        endDate: '2026-11-02',
        tags: [ClosureTag.ConferenceDay],
        sourceLabel: 'holiday; parent-teacher conference day',
      },
      {
        startDate: '2026-11-03',
        endDate: '2026-11-03',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Election Day',
      },
      {
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Thanksgiving break',
      },
      {
        startDate: '2026-12-21',
        endDate: '2027-01-01',
        tags: [ClosureTag.Break],
        sourceLabel: 'winter break',
        commonName: 'Winter break',
      },
      {
        startDate: '2027-01-18',
        endDate: '2027-01-18',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Martin Luther King Jr. Day',
      },
      {
        startDate: '2027-02-15',
        endDate: '2027-02-15',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Presidents Day',
      },
      {
        startDate: '2027-03-09',
        endDate: '2027-03-09',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2027-03-26',
        endDate: '2027-03-26',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2027-03-29',
        endDate: '2027-04-02',
        tags: [ClosureTag.Break],
        sourceLabel: 'spring break',
        commonName: 'Spring break',
      },
      {
        startDate: '2027-05-31',
        endDate: '2027-05-31',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Memorial Day',
      },
    ],
  },
  sourceUrl: 'https://www.oneccps.org/page/calendars',
  flags: [
    'The HTML page\'s per-line closure text is just "holiday" (no fuller phrase like the iCal feed\'s "Holiday, schools and offices closed") — sourceLabel reflects that verbatim, which makes the label-collision problem worse from the primary source itself, not only from the feed.',
    'Sept. 4, March 9, and March 26, 2026-27 are listed only as "holiday" with no way to confirm what they mark from this source alone; left commonName unset rather than guess.',
    'Nov. 2 ("holiday; parent-teacher conference day") is tagged ConferenceDay only — treated the word "holiday" here as describing "no school that day" rather than a second, independent closure reason. Worth a second opinion.',
  ],
};
