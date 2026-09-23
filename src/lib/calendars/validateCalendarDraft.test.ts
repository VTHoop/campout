import type { SchoolYearCalendar } from '@campout/planner';
import { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import { describe, expect, it } from 'vitest';
import type { CalendarDraft } from './validateCalendarDraft';
import { findDraftIssues } from './validateCalendarDraft';

// Small, purpose-built fixture — not real district data. Each test overrides
// just the field it needs to break, so a failure points at exactly one issue.

const calendar: SchoolYearCalendar = {
  district: SchoolDistrict.Chesterfield,
  type: CalendarType.Traditional,
  label: '2026-27',
  firstInstructionalDay: '2026-08-24',
  lastInstructionalDay: '2027-06-09',
  coversFrom: '2026-07-01',
  coversTo: '2027-06-30',
  closures: [
    {
      startDate: '2026-09-07',
      endDate: '2026-09-07',
      tags: [ClosureTag.Holiday],
      sourceLabel: 'Holiday, schools and offices closed',
      commonName: 'Labor Day',
    },
  ],
};

const draftWithUrl: CalendarDraft = {
  calendar,
  sourceUrl: 'https://www.oneccps.org/page/calendars',
  flags: [],
};

describe('findDraftIssues', () => {
  it('reports no issues for a consistent draft with a sourceUrl', () => {
    expect(findDraftIssues(draftWithUrl)).toEqual([]);
  });

  it('reports no issues for a consistent draft with only a sourceDocumentPath', () => {
    const draft: CalendarDraft = {
      calendar,
      sourceDocumentPath: 'camp-sources/henrico-2026-27.pdf',
      flags: [],
    };
    expect(findDraftIssues(draft)).toEqual([]);
  });

  it('flags a draft with neither sourceUrl nor sourceDocumentPath', () => {
    const draft: CalendarDraft = { calendar, flags: [] };
    expect(findDraftIssues(draft)).toEqual([
      'chesterfield 2026-27 has neither sourceUrl nor sourceDocumentPath; ADR-0012 requires at least one',
    ]);
  });

  it('surfaces a structurally inconsistent calendar as an issue, not a throw', () => {
    const draft: CalendarDraft = {
      ...draftWithUrl,
      calendar: { ...calendar, lastInstructionalDay: calendar.firstInstructionalDay },
    };
    expect(findDraftIssues(draft)).toEqual([
      'chesterfield 2026-27 ends instruction (2026-08-24) on or before it starts (2026-08-24)',
    ]);
  });

  it('names the school in a structural issue for a school-scoped calendar', () => {
    const draft: CalendarDraft = {
      calendar: {
        ...calendar,
        school: 'Fixture Elementary',
        lastInstructionalDay: calendar.firstInstructionalDay,
      },
      sourceUrl: draftWithUrl.sourceUrl,
      flags: [],
    };
    expect(findDraftIssues(draft)).toEqual([
      'chesterfield Fixture Elementary 2026-27 ends instruction (2026-08-24) on or before it starts (2026-08-24)',
    ]);
  });

  it('reports every issue at once rather than stopping at the first', () => {
    const draft: CalendarDraft = {
      calendar: { ...calendar, lastInstructionalDay: calendar.firstInstructionalDay },
      flags: [],
    };
    expect(findDraftIssues(draft)).toEqual([
      'chesterfield 2026-27 ends instruction (2026-08-24) on or before it starts (2026-08-24)',
      'chesterfield 2026-27 has neither sourceUrl nor sourceDocumentPath; ADR-0012 requires at least one',
    ]);
  });
});
