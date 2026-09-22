import { describe, expect, it } from 'vitest';
import { chesterfield202627Draft } from '../../../docs/data/school-calendars/chesterfield-2026-27.draft';
import { chesterfieldBellwood202526Draft } from '../../../docs/data/school-calendars/chesterfield-bellwood-2025-26.draft';
import { henrico202627Draft } from '../../../docs/data/school-calendars/henrico-2026-27.draft';
import { findDraftIssues } from './validateCalendarDraft';

/**
 * CAM-23's acceptance case: the skill's drafts for both required districts
 * pass the same structural gate a human reviewer relies on. Not a test of
 * the skill's judgment calls (recorded as `flags` on each draft, for a human
 * to weigh) — only that the shape the skill promises is the shape it wrote.
 */
describe('CAM-23 acceptance-case drafts', () => {
  it.each([
    ['Chesterfield 2026-27 traditional', chesterfield202627Draft],
    ['Chesterfield Bellwood 2025-26 year-round', chesterfieldBellwood202526Draft],
    ['Henrico 2026-27 traditional', henrico202627Draft],
  ])('%s has no structural or provenance issues', (_label, draft) => {
    expect(findDraftIssues(draft)).toEqual([]);
  });
});
