import { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import type { CalendarDraft } from '../../../src/lib/calendars/validateCalendarDraft';

/**
 * Drafted by the school-calendar-parser skill from Chesterfield's own page —
 * the "2027-28 Calendar Dates" accordion panel, read with a real browser
 * session (plain HTML, no bot-check). Not yet reviewed: this is the draft a
 * human clears before it becomes real seed data (CAM-4). Drafted for CAM-31,
 * so summer 2027 ends on a published first day back rather than a placeholder.
 *
 * Staggered start (Aug. 23 for most grades, Aug. 24 for the rest), every
 * "three-hour early release" / "end of quarter" line, and the June 19 and
 * July 4 holidays (after the last day of school) are out of scope per
 * ADR-0013/CAM-22 and are not recorded here.
 */
export const chesterfield202728Draft: CalendarDraft = {
  calendar: {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.Traditional,
    label: '2027-28',
    firstInstructionalDay: '2027-08-23',
    lastInstructionalDay: '2028-06-02',
    coversFrom: '2027-08-23',
    coversTo: '2028-06-02',
    closures: [
      {
        startDate: '2027-09-03',
        endDate: '2027-09-03',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2027-09-06',
        endDate: '2027-09-06',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Labor Day',
      },
      {
        startDate: '2027-10-11',
        endDate: '2027-10-11',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2027-11-01',
        endDate: '2027-11-01',
        tags: [ClosureTag.ConferenceDay],
        sourceLabel: 'holiday for students; parent-teacher conference day',
      },
      {
        startDate: '2027-11-02',
        endDate: '2027-11-02',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday for students',
        commonName: 'Election Day',
      },
      {
        startDate: '2027-11-24',
        endDate: '2027-11-26',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Thanksgiving Break',
      },
      {
        startDate: '2027-12-20',
        endDate: '2027-12-31',
        tags: [ClosureTag.Break],
        sourceLabel: 'winter break',
        commonName: 'Winter Break',
      },
      {
        startDate: '2028-01-17',
        endDate: '2028-01-17',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Martin Luther King Jr. Day',
      },
      {
        startDate: '2028-02-21',
        endDate: '2028-02-21',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Presidents Day',
      },
      {
        startDate: '2028-04-03',
        endDate: '2028-04-07',
        tags: [ClosureTag.Break],
        sourceLabel: 'spring break',
        commonName: 'Spring Break',
      },
      {
        startDate: '2028-04-14',
        endDate: '2028-04-14',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
      },
      {
        startDate: '2028-05-29',
        endDate: '2028-05-29',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'holiday',
        commonName: 'Memorial Day',
      },
    ],
  },
  sourceUrl: 'https://www.oneccps.org/page/calendars',
  flags: [
    'Sept. 3, Oct. 11 and April 14 are listed only as "holiday"; left commonName unset rather than guess. Oct. 11 is both Columbus Day and Yom Kippur in 2027; April 14 is Good Friday.',
    'Winter break is listed as Dec. 20–31 with nothing in January; Jan. 1, 2028 is a Saturday, so school resumes Monday Jan. 3.',
    'Nov. 1 ("holiday for students; parent-teacher conference day") is tagged ConferenceDay only, matching the 2026-27 draft.',
  ],
};
