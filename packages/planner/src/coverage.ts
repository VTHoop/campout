import type { CalendarDate } from './calendarDate';
import type { CoveragePeriod, SchoolYearCalendar } from './types';

export function coveragePeriods(
  _calendars: readonly SchoolYearCalendar[],
  _from: CalendarDate,
  _to: CalendarDate,
): readonly CoveragePeriod[] {
  throw new Error('not implemented');
}

export function longestPeriod(
  _calendars: readonly SchoolYearCalendar[],
  _label: string,
): CoveragePeriod | undefined {
  throw new Error('not implemented');
}

export function coveragePeriodOf(
  _calendars: readonly SchoolYearCalendar[],
  _date: CalendarDate,
): CoveragePeriod | undefined {
  throw new Error('not implemented');
}
