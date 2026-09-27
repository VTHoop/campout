import type { CalendarDate } from './calendarDate';
import type { CoveragePeriod, SchoolYearCalendar } from './types';

/** One summer a parent can pick, named by the calendar year it starts in. */
export interface SummerChoice {
  readonly year: number;
  readonly period: CoveragePeriod;
}

export interface SummerChoices {
  readonly summers: readonly SummerChoice[];
  readonly upcoming: SummerChoice;
}

export function summerChoices(
  _calendars: readonly SchoolYearCalendar[],
  _today: CalendarDate,
): SummerChoices {
  throw new Error('Not implemented');
}
