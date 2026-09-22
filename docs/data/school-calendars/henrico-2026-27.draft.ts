import { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import type { CalendarDraft } from '../../../src/lib/calendars/validateCalendarDraft';

/**
 * Drafted from Henrico's calendar for 2026-27. The rendered HTML page
 * (https://www.henricoschools.us/page/school-calendar) sits behind a Fastly
 * bot-check that blocks a plain fetch but renders fine in a real browser.
 *
 * That HTML page turned out to be missing "June 4: ...Last day of school" —
 * present nowhere in its rendered text — while the printable PDF it links to
 * (via an image wrapped around an `aptg.co` short link, not a direct `.pdf`
 * href) has it. This is the opposite failure from Chesterfield's ICS feed
 * (which drops future years): here the HTML page itself silently drops a
 * fact the PDF carries. `lastInstructionalDay` below is sourced from the PDF
 * for that reason; see `henrico-2026-27.source.pdf` alongside this file.
 */
export const henrico202627Draft: CalendarDraft = {
  calendar: {
    district: SchoolDistrict.Henrico,
    type: CalendarType.Traditional,
    label: '2026-27',
    firstInstructionalDay: '2026-08-24',
    lastInstructionalDay: '2027-06-04',
    coversFrom: '2026-08-24',
    coversTo: '2027-06-04',
    closures: [
      {
        startDate: '2026-09-04',
        endDate: '2026-09-07',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Labor Day weekend',
      },
      {
        startDate: '2026-09-21',
        endDate: '2026-09-21',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Student and teacher holiday - Yom Kippur/Jewish High Holiday',
      },
      {
        startDate: '2026-09-28',
        endDate: '2026-09-28',
        tags: [ClosureTag.TeacherWorkday],
        sourceLabel:
          'Student holiday - Teacher professional learning (in person, division-based, may be off-site)',
      },
      {
        startDate: '2026-11-02',
        endDate: '2026-11-02',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Schools and central offices closed - Wellness Day',
      },
      {
        startDate: '2026-11-03',
        endDate: '2026-11-03',
        tags: [ClosureTag.TeacherWorkday],
        sourceLabel:
          'Election Day - Student holiday - Teacher Professional Learning (in person, school-based, may be off-site)',
      },
      {
        startDate: '2026-11-09',
        endDate: '2026-11-09',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Student and teacher holiday - Diwali',
      },
      {
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Schools closed - Thanksgiving Holiday',
      },
      {
        startDate: '2026-12-21',
        endDate: '2027-01-01',
        tags: [ClosureTag.Break],
        sourceLabel: 'Schools closed - Winter Break',
        commonName: 'Winter break',
      },
      {
        startDate: '2027-01-18',
        endDate: '2027-01-18',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Schools closed - Martin Luther King Jr. Day',
      },
      {
        startDate: '2027-01-25',
        endDate: '2027-01-25',
        tags: [ClosureTag.TeacherWorkday],
        sourceLabel: 'Student holiday - In-person clerical day',
      },
      {
        startDate: '2027-02-15',
        endDate: '2027-02-15',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Schools and central offices closed - Wellness Day',
      },
      {
        startDate: '2027-02-16',
        endDate: '2027-02-16',
        tags: [ClosureTag.TeacherWorkday],
        sourceLabel: 'Student holiday - Teacher professional learning (in person, school-based)',
      },
      {
        startDate: '2027-03-10',
        endDate: '2027-03-10',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Student and teacher holiday - Eid al-Fitr',
      },
      {
        startDate: '2027-03-29',
        endDate: '2027-04-02',
        tags: [ClosureTag.Break],
        sourceLabel: 'Schools closed - Spring Break',
        commonName: 'Spring break',
      },
      {
        startDate: '2027-05-31',
        endDate: '2027-05-31',
        tags: [ClosureTag.Holiday],
        sourceLabel: 'Schools closed - Memorial Day',
      },
    ],
  },
  sourceUrl: 'https://www.henricoschools.us/page/school-calendar',
  sourceDocumentPath: 'docs/data/school-calendars/henrico-2026-27.source.pdf',
  flags: [
    'lastInstructionalDay (June 4, 2027) is sourced from the PDF, not the HTML page — the HTML page\'s rendered text has no "last day of school" line at all for this year. Reviewer should double-check this against a second source before treating it as settled.',
    '"Wellness Day" (Nov. 2, Feb. 15) does not fit any ClosureTag value — tagged Holiday as the closest existing fit, same open question as Bellwood\'s "special election" case.',
    "No evidence found of a Henrico year-round elementary calendar (checked the page directly); this draft validates the single-calendar-per-district path, not Chesterfield's multi-calendar one.",
    "The public ICS feed (calendar.google.com/.../hcpswebdev%40henrico.k12.va.us/public/basic.ics) was not used as a source: it is not a rolling closures-only window like Chesterfield's, it is Henrico's entire public events calendar — 2,300+ events back to 2012, real closures mixed in among awareness days and open houses.",
    'sourceDocumentPath points into this repo, not the private camp-sources bucket ADR-0012 specifies — no Supabase project is deployed yet to hold it. Move the PDF into the real bucket and update this path when CAM-4 promotes this draft.',
  ],
};
