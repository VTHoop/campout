import type { CalendarDate } from './calendarDate';
import {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  firstWeekdayOnOrAfter,
  lastWeekdayOnOrBefore,
  mondayOf,
} from './calendarDate';
import type { CoverageWeek } from './types';

const DAYS_PER_WEEK = 7;
const MONDAY_TO_FRIDAY = 4;

/**
 * Turn a run of closed days into the ordered weeks a parent has to cover. Every
 * other part of the planner indexes off this list.
 *
 * `start` and `end` are the first and last day school is shut, inclusive. Weekend
 * days at either edge are dropped: nobody needs care on a Saturday. That leaves a
 * first and last weekday that rarely land on a Monday and a Friday, which is
 * where the interesting cases live:
 *
 *   - School ends **Friday** June 11. Nobody needs care that weekend, so the run
 *     starts Monday June 14 and week 0 is a full week.
 *   - School ends **Wednesday** June 9. Thursday and Friday still need cover, so
 *     week 0 is the week beginning Monday June 7 — a *partial* week, two days
 *     long. Dropping it would hide a real gap; treating it as full would report
 *     a gap on days the child was in school.
 *
 * The same logic runs in reverse at the end of the run. A single Tuesday off is
 * the same case at its smallest: one partial week, one day long.
 *
 * @throws RangeError if either date is malformed, if the run ends before it
 *   starts, or if it holds no weekdays at all. Refusing is correct here: a
 *   silently empty run renders an empty grid, and a parent reads that as
 *   "nothing to plan" (AGENTS.md §1 — Refuse rather than guess).
 */
export function weeksBetween(start: CalendarDate, end: CalendarDate): readonly CoverageWeek[] {
  const firstDay = assertCalendarDate(start, 'start');
  const lastDay = assertCalendarDate(end, 'end');

  if (compareDates(lastDay, firstDay) < 0) {
    throw new RangeError(`Run starts (${firstDay}) after it ends (${lastDay})`);
  }

  const periodStart = firstWeekdayOnOrAfter(firstDay);
  const periodEnd = lastWeekdayOnOrBefore(lastDay);

  if (compareDates(periodStart, periodEnd) > 0) {
    throw new RangeError(`No weekdays between ${firstDay} and ${lastDay}`);
  }

  const firstMonday = mondayOf(periodStart);
  const lastMonday = mondayOf(periodEnd);
  const weekCount = daysBetween(firstMonday, lastMonday) / DAYS_PER_WEEK + 1;

  const weeks: CoverageWeek[] = [];
  for (let index = 0; index < weekCount; index += 1) {
    const monday = addDays(firstMonday, index * DAYS_PER_WEEK);
    const friday = addDays(monday, MONDAY_TO_FRIDAY);
    const firstDayNeedingCover = laterOf(monday, periodStart);
    const lastDayNeedingCover = earlierOf(friday, periodEnd);

    weeks.push({
      index,
      monday,
      friday,
      isPartial: firstDayNeedingCover !== monday || lastDayNeedingCover !== friday,
      firstDayNeedingCover,
      lastDayNeedingCover,
    });
  }

  return weeks;
}

function laterOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareDates(a, b) >= 0 ? a : b;
}

function earlierOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareDates(a, b) <= 0 ? a : b;
}
