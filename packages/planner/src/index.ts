/**
 * @campout/planner — the pure coverage engine (ADR-0008).
 *
 * No database client, no fetch, no React, no environment access, and no reading
 * of the wall clock. Plain data in, plain data out, so the same code runs in a
 * route handler and in the browser as a parent drags a session into a cell.
 *
 * Shipped: the summer-week model and the calendar-date primitives it rests on.
 */

export type { CalendarDate } from './calendarDate';
export {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  isWeekend,
  mondayOf,
  nextWeekday,
  previousWeekday,
  Weekday,
  weekdayOf,
} from './calendarDate';
export type { SchoolCalendar, SummerWeek } from './types';
export { SchoolDistrict } from './types';
export { summerWeekIndexOf, summerWeeks } from './weeks';
