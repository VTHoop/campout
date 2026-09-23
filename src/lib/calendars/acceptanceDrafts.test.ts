import { describe, expect, it } from 'vitest';
import { chesterfield202627Draft } from '../../../docs/data/school-calendars/chesterfield-2026-27.draft';
import { henrico202627Draft } from '../../../docs/data/school-calendars/henrico-2026-27.draft';
import { findDraftIssues } from './validateCalendarDraft';

/**
 * CAM-23's acceptance case: the skill's drafts for both required districts
 * pass the same structural gate a human reviewer relies on. Not a test of
 * the skill's judgment calls (recorded as `flags` on each draft, for a human
 * to weigh) — only that the shape the skill promises is the shape it wrote.
 *
 * No year-round draft here: no v1 district or school runs a year-round
 * calendar. `CalendarType.YearRound` stays in the model so one can be added
 * if it appears.
 */
describe('CAM-23 acceptance-case drafts', () => {
  it.each([
    ['Chesterfield 2026-27 traditional', chesterfield202627Draft],
    ['Henrico 2026-27 traditional', henrico202627Draft],
  ])('%s has no structural or provenance issues', (_label, draft) => {
    expect(findDraftIssues(draft)).toEqual([]);
  });
});
