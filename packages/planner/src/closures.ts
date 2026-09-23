import type { CalendarDate } from './calendarDate';
import {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  firstWeekdayOnOrAfter,
  lastWeekdayOnOrBefore,
} from './calendarDate';
import { byStartDate, followingLabel, orderedCalendars } from './calendars';
import type { Closure, CoveragePeriod, SchoolYearCalendar } from './types';
import { ClosureTag, PeriodBasis } from './types';
import { weeksBetween } from './weeks';

/** No district publishes summer, so this closure has no district words to quote. */
const DERIVED_SOURCE_LABEL = 'Between school years (derived)';

/**
 * Every run of closed weekdays that touches `from`–`to`, in date order: each
 * stored closure, plus the summer between two adjacent school years.
 *
 * A period is returned whole, not clipped to the range, so a parent looking at one
 * December Tuesday still sees the whole of winter break.
 *
 * @throws RangeError if the range is backwards, if either end falls where we hold
 *   no calendar, or if a calendar contradicts itself. An empty list for a range
 *   we know nothing about would read as "nothing to plan" (AGENTS.md §1).
 */
export function coveragePeriods(
  calendars: readonly SchoolYearCalendar[],
  from: CalendarDate,
  to: CalendarDate,
): readonly CoveragePeriod[] {
  const start = assertCalendarDate(from, 'from');
  const end = assertCalendarDate(to, 'to');
  if (compareDates(end, start) < 0) {
    throw new RangeError(`Range starts (${start}) after it ends (${end})`);
  }

  const years = orderedCalendars(calendars);
  assertKnown(years, start);
  assertKnown(years, end);

  return periodsOf(years).filter(
    (period) =>
      compareDates(period.closure.startDate, end) <= 0 &&
      compareDates(period.closure.endDate, start) >= 0,
  );
}

/**
 * The gap between the labelled year and the one after it: summer, on a
 * traditional calendar. Derived from the two calendars, never stored.
 *
 * The following year is the one labelled next: "2027-28" after "2026-27". Returns
 * `undefined` when it is not held, or when school runs straight through with no
 * weekday between. It never invents an end date (ADR-0013).
 *
 * @throws RangeError if no calendar carries the label, or if a calendar
 *   contradicts itself.
 */
export function longestPeriod(
  calendars: readonly SchoolYearCalendar[],
  label: string,
): CoveragePeriod | undefined {
  const years = orderedCalendars(calendars);
  if (!years.some((year) => year.label === label)) {
    throw new RangeError(`No calendar is labelled "${label}"`);
  }

  const pair = adjacentYears(years).find(([earlier]) => earlier.label === label);
  const gap = pair && gapBetween(...pair);
  return gap && periodFor(gap);
}

/**
 * The period covering `date`, or `undefined` when school is in session that day.
 * A weekend inside a closure belongs to that closure.
 *
 * @throws RangeError when we cannot say whether school is open: the date is
 *   outside every calendar, or it falls in a summer whose neighbouring year is
 *   not held. That is not the same as "school is in session" (AGENTS.md §1).
 */
export function coveragePeriodOf(
  calendars: readonly SchoolYearCalendar[],
  date: CalendarDate,
): CoveragePeriod | undefined {
  const day = assertCalendarDate(date, 'date');
  const years = orderedCalendars(calendars);
  assertKnown(years, day);

  return periodsOf(years).find((period) => isWithin(period.closure, day));
}

function periodsOf(years: readonly SchoolYearCalendar[]): readonly CoveragePeriod[] {
  return closuresOf(years)
    .map(periodFor)
    .filter((period) => period !== undefined);
}

function closuresOf(years: readonly SchoolYearCalendar[]): readonly Closure[] {
  const stored = years.flatMap((year) => year.closures);
  return [...stored, ...gapsOf(years)].sort(byStartDate);
}

/** A closure's weekdays and weeks, or `undefined` when it falls entirely on a weekend. */
function periodFor(closure: Closure): CoveragePeriod | undefined {
  const first = firstWeekdayOnOrAfter(closure.startDate);
  const last = lastWeekdayOnOrBefore(closure.endDate);
  if (compareDates(first, last) > 0) return undefined;

  const weeks = weeksBetween(first, last);
  const weekdays = weeks.reduce(
    (total, week) => total + daysBetween(week.firstDayNeedingCover, week.lastDayNeedingCover) + 1,
    0,
  );
  return { closure, weekdays, weeks, basis: PeriodBasis.Published };
}

type YearPair = readonly [SchoolYearCalendar, SchoolYearCalendar];

/**
 * Each held year paired with the held year labelled next. A missing year breaks
 * the chain, so it is never bridged into a two-year "summer". Coverage windows
 * are not consulted: a window that stops at the last day of school is natural,
 * and must not make a summer we can derive look unknown.
 */
function adjacentYears(years: readonly SchoolYearCalendar[]): readonly YearPair[] {
  const byLabel = new Map(years.map((year) => [year.label, year] as const));
  const pairs: YearPair[] = [];
  for (const year of years) {
    const next = byLabel.get(followingLabel(year.label));
    if (next) pairs.push([year, next]);
  }
  return pairs;
}

function gapsOf(years: readonly SchoolYearCalendar[]): readonly Closure[] {
  return adjacentYears(years)
    .map((pair) => gapBetween(...pair))
    .filter((gap) => gap !== undefined);
}

/** The days between one year's last instructional day and the next year's first. */
function gapBetween(earlier: SchoolYearCalendar, later: SchoolYearCalendar): Closure | undefined {
  const startDate = addDays(earlier.lastInstructionalDay, 1);
  const endDate = addDays(later.firstInstructionalDay, -1);
  if (compareDates(endDate, startDate) < 0) return undefined;

  return { startDate, endDate, tags: [ClosureTag.Break], sourceLabel: DERIVED_SOURCE_LABEL };
}

function assertKnown(years: readonly SchoolYearCalendar[], day: CalendarDate): void {
  const inSchool = years.some((year) =>
    isWithin({ startDate: year.firstInstructionalDay, endDate: year.lastInstructionalDay }, day),
  );
  if (!inSchool && !gapsOf(years).some((gap) => isWithin(gap, day))) {
    throw new RangeError(`No school calendar we hold says whether school is open on ${day}`);
  }
}

function isWithin(range: Pick<Closure, 'startDate' | 'endDate'>, day: CalendarDate): boolean {
  return compareDates(day, range.startDate) >= 0 && compareDates(day, range.endDate) <= 0;
}
