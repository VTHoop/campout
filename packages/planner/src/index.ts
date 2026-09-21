/**
 * @campout/planner — the pure coverage engine (ADR-0008).
 *
 * No database client, no fetch, no React, no environment access, and no reading
 * of the wall clock. Plain data in, plain data out, so the same code runs in a
 * route handler and in the browser as a parent drags a session into a cell.
 *
 * Shipped: the closure model (ADR-0013) — school-year calendars in, the periods a
 * parent has to cover out — and the calendar-date primitives it rests on.
 */

export type { CalendarDate } from './calendarDate';
export {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  firstWeekdayOnOrAfter,
  isWeekend,
  lastWeekdayOnOrBefore,
  mondayOf,
  nextWeekday,
  previousWeekday,
  Weekday,
  weekdayOf,
} from './calendarDate';
export { coveragePeriodOf, coveragePeriods, longestPeriod } from './closures';
export type {
  Closure,
  CoveragePeriod,
  CoverageWeek,
  SchoolYearCalendar,
} from './types';
export { CalendarType, ClosureTag, SchoolDistrict } from './types';
export { weeksBetween } from './weeks';
