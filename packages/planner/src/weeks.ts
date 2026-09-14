import type { CalendarDate } from './calendarDate';
import {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  mondayOf,
  nextWeekday,
  previousWeekday,
} from './calendarDate';
import type { SchoolCalendar, SummerWeek } from './types';

const DAYS_PER_WEEK = 7;
const MONDAY_TO_FRIDAY = 4;

/**
 * Turn a district's school calendar into the ordered weeks of summer a parent
 * has to cover. Every other part of the planner indexes off this list.
 *
 * Summer runs from the first weekday after school lets out to the last weekday
 * before school returns. Those boundary days rarely land on a Monday, which is
 * where the interesting cases live:
 *
 *   - School ends **Friday** June 11. Nobody needs care that weekend, so summer
 *     starts Monday June 14 and week 0 is a full week.
 *   - School ends **Wednesday** June 9. Thursday and Friday still need cover, so
 *     week 0 is the week beginning Monday June 7 — a *partial* week, two days
 *     long. Dropping it would hide a real gap; treating it as full would report
 *     a gap on days the child was in school.
 *
 * The same logic runs in reverse at the end of summer.
 *
 * @throws RangeError if either date is malformed, if school returns before it
 *   lets out, or if the two dates leave no summer at all. Refusing is correct
 *   here: a silently empty summer renders an empty grid, and a parent reads that
 *   as "nothing to plan" (AGENTS.md §1 — Refuse rather than guess).
 */
export function summerWeeks(calendar: SchoolCalendar): readonly SummerWeek[] {
  const lastDay = assertCalendarDate(calendar.lastDayOfSchool, 'lastDayOfSchool');
  const firstDay = assertCalendarDate(calendar.firstDayOfSchool, 'firstDayOfSchool');

  if (compareDates(firstDay, lastDay) <= 0) {
    throw new RangeError(
      `School returns (${firstDay}) on or before it lets out (${lastDay}) for ${calendar.district} ${calendar.year}`,
    );
  }

  const summerStart = nextWeekday(lastDay);
  const summerEnd = previousWeekday(firstDay);

  if (compareDates(summerStart, summerEnd) > 0) {
    throw new RangeError(
      `No summer weekdays between ${lastDay} and ${firstDay} for ${calendar.district} ${calendar.year}`,
    );
  }

  const firstMonday = mondayOf(summerStart);
  const lastMonday = mondayOf(summerEnd);
  const weekCount = daysBetween(firstMonday, lastMonday) / DAYS_PER_WEEK + 1;

  const weeks: SummerWeek[] = [];
  for (let index = 0; index < weekCount; index += 1) {
    const monday = addDays(firstMonday, index * DAYS_PER_WEEK);
    const friday = addDays(monday, MONDAY_TO_FRIDAY);
    const firstDayNeedingCover = laterOf(monday, summerStart);
    const lastDayNeedingCover = earlierOf(friday, summerEnd);

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

/**
 * Which summer week a date falls in, or `null` if it falls outside summer.
 *
 * Returns the week's index rather than the week itself so callers can key a
 * grid cell by it without holding the whole object.
 */
export function summerWeekIndexOf(weeks: readonly SummerWeek[], date: CalendarDate): number | null {
  const target = assertCalendarDate(date, 'date');
  for (const week of weeks) {
    // Compare against the Sunday that closes the week, not Friday: a Saturday
    // session still belongs to the week it starts in.
    const weekEnd = addDays(week.monday, DAYS_PER_WEEK - 1);
    if (compareDates(target, week.monday) >= 0 && compareDates(target, weekEnd) <= 0) {
      return week.index;
    }
  }
  return null;
}

function laterOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareDates(a, b) >= 0 ? a : b;
}

function earlierOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareDates(a, b) <= 0 ? a : b;
}
