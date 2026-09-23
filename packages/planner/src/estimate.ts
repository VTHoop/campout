import type { CalendarDate } from './calendarDate';
import {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  lastDayOfMonth,
  monthOf,
  monthStart,
  Weekday,
  weekdayOf,
  yearOf,
} from './calendarDate';
import { EstimateRule } from './types';

/**
 * Estimating the first day of a school year no district has published yet
 * (ADR-0014).
 *
 * Richmond City and Hanover publish one year at a time, after camp registration
 * opens. Without an estimate their families see "summer not published yet" exactly
 * when they need to book. The estimate is never stored: it exists only in what the
 * planner returns, so a published calendar replaces it on the next read.
 */

/** An estimated first instructional day for the school year after one we hold. */
export interface FirstDayEstimate {
  readonly firstDay: CalendarDate;
  readonly rule: EstimateRule;
}

/** How far from Labor Day a first day can fall and still be read as anchored to it. */
const LABOR_DAY_REACH_DAYS = 7;
const DAYS_PER_WEEK = 7;

/** Month and day bounds, inclusive. An estimate outside them is more likely wrong than useful. */
const EARLIEST_FIRST_DAY = { month: 7, day: 1 };
const LATEST_FIRST_DAY = { month: 9, day: 15 };

/**
 * The likely first day of the year after the one starting `firstDay`, by the
 * first rule that applies, or `undefined` when the estimate fails the range check.
 *
 * @throws RangeError if `firstDay` is not a calendar date.
 */
export function estimateNextFirstDay(firstDay: CalendarDate): FirstDayEstimate | undefined {
  const day = assertCalendarDate(firstDay, 'firstDay');
  const estimate = byLaborDay(day) ?? byMonthEnd(day);
  return isPlausible(estimate.firstDay) ? estimate : undefined;
}

/** "The Tuesday after Labor Day": keep the same offset from it next year. */
function byLaborDay(day: CalendarDate): FirstDayEstimate | undefined {
  const year = yearOf(day);
  const offset = daysBetween(laborDay(year), day);
  if (Math.abs(offset) > LABOR_DAY_REACH_DAYS) return undefined;

  return { firstDay: addDays(laborDay(year + 1), offset), rule: EstimateRule.LaborDayAnchor };
}

/**
 * The same weekday, the same number of whole weeks before the end of the same
 * month. Counted back from the end because districts plan toward September:
 * counting forward drifts a week whenever the month gains a fifth weekday.
 */
function byMonthEnd(day: CalendarDate): FirstDayEstimate {
  const weeksBeforeEnd = Math.floor(daysBetween(day, lastDayOfMonth(day)) / DAYS_PER_WEEK);
  const sameMonthNextYear = monthStart(yearOf(day) + 1, monthOf(day));
  const lastSameWeekday = lastWeekdayOfMonth(sameMonthNextYear, weekdayOf(day));

  return {
    firstDay: addDays(lastSameWeekday, -DAYS_PER_WEEK * weeksBeforeEnd),
    rule: EstimateRule.WeekdayFromMonthEnd,
  };
}

function isPlausible(date: CalendarDate): boolean {
  const year = yearOf(date);
  const earliest = addDays(monthStart(year, EARLIEST_FIRST_DAY.month), EARLIEST_FIRST_DAY.day - 1);
  const latest = addDays(monthStart(year, LATEST_FIRST_DAY.month), LATEST_FIRST_DAY.day - 1);
  return compareDates(date, earliest) >= 0 && compareDates(date, latest) <= 0;
}

/** The first Monday of September. */
function laborDay(year: number): CalendarDate {
  const september = monthStart(year, 9);
  const daysToMonday = (Weekday.Monday - weekdayOf(september) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(september, daysToMonday);
}

function lastWeekdayOfMonth(anyDayInMonth: CalendarDate, weekday: Weekday): CalendarDate {
  const last = lastDayOfMonth(anyDayInMonth);
  const daysBack = (weekdayOf(last) - weekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(last, -daysBack);
}
