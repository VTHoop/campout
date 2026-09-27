import type { SchoolYearCalendar } from '@campout/planner';
import { chesterfield202526Draft } from '../../../docs/data/school-calendars/chesterfield-2025-26.draft';
import { chesterfield202627Draft } from '../../../docs/data/school-calendars/chesterfield-2026-27.draft';
import { chesterfield202728Draft } from '../../../docs/data/school-calendars/chesterfield-2027-28.draft';

/**
 * Chesterfield's school years, read straight from the parser's drafts (CAM-31).
 *
 * Real district calendars are reference data and belong in Postgres (CAM-4).
 * Until they are there, the Summer page reads the drafts, so a reviewer can
 * check a draft by looking at the summer it produces.
 */
export const CHESTERFIELD_CALENDARS: readonly SchoolYearCalendar[] = [
  chesterfield202526Draft.calendar,
  chesterfield202627Draft.calendar,
  chesterfield202728Draft.calendar,
];
