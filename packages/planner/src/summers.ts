import type { CalendarDate } from './calendarDate';
import { assertCalendarDate, compareDates, yearOf } from './calendarDate';
import { orderedCalendars } from './calendars';
import { longestPeriod } from './closures';
import type { CoveragePeriod, SchoolYearCalendar } from './types';
import { PeriodBasis } from './types';

/** One summer a parent can pick, named by the calendar year it starts in. */
export interface SummerChoice {
  readonly year: number;
  readonly period: CoveragePeriod;
}

export interface SummerChoices {
  /** Earliest first. `upcoming` is always one of them. */
  readonly summers: readonly SummerChoice[];
  readonly upcoming: SummerChoice;
}

/**
 * The summers a parent can choose between, and the one to show first.
 *
 * Offered: every summer between two consecutive loaded school years. An estimated
 * summer (ADR-0014) is offered only when it is the upcoming one, so a parent is
 * never shown a guess where a published summer would do.
 *
 * The upcoming summer is the one in progress on `today`, otherwise the next to
 * start. When today is past every summer, or the next one's estimate fails its
 * range check, it is the latest summer the calendars can produce.
 *
 * @throws RangeError if `today` is not a calendar date, if a calendar
 *   contradicts itself, or if the calendars produce no summer at all.
 */
export function summerChoices(
  calendars: readonly SchoolYearCalendar[],
  today: CalendarDate,
): SummerChoices {
  const day = assertCalendarDate(today, 'today');
  const candidates = everySummer(calendars);

  const upcoming =
    candidates.find(({ period }) => compareDates(period.closure.endDate, day) >= 0) ??
    candidates.at(-1);
  if (!upcoming) {
    throw new RangeError('The school calendars we hold produce no summer to choose');
  }

  return {
    summers: candidates.filter(
      (summer) => summer === upcoming || summer.period.basis === PeriodBasis.Published,
    ),
    upcoming,
  };
}

/** The summer after each held year that has one, published or estimated. */
function everySummer(calendars: readonly SchoolYearCalendar[]): readonly SummerChoice[] {
  const years = orderedCalendars(calendars);
  return years
    .map((year) => longestPeriod(years, year.label))
    .filter((period) => period !== undefined)
    .map((period) => ({ year: yearOf(period.closure.startDate), period }));
}
