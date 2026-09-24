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
import { estimateNextFirstDay } from './estimate';
import type {
  Closure,
  CoveragePeriod,
  EstimatedPeriod,
  PublishedPeriod,
  SchoolYearCalendar,
} from './types';
import { ClosureTag, PeriodBasis } from './types';
import { weeksBetween } from './weeks';

/** No district publishes summer, so this closure has no district words to quote. */
const DERIVED_SOURCE_LABEL = 'Between school years (derived)';
/** As above, but the first day back is ours, not the district's (ADR-0014). */
const ESTIMATED_SOURCE_LABEL = 'Between school years (derived; first day back estimated)';

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
 * traditional calendar. Derived, never stored.
 *
 * The following year is the one labelled next: "2027-28" after "2026-27". When it
 * is held, summer ends the day before its first instructional day. When it is not,
 * summer ends the day before an estimated first day back, and the period is marked
 * `PeriodBasis.Estimated` with the rule used (ADR-0014).
 *
 * Returns `undefined` when school runs straight through with no weekday between,
 * or when the following year is not held and the estimate fails its range check.
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

  const summer = summersOf(years).find(({ after }) => after.label === label);
  return summer && periodFor(summer);
}

/**
 * The period covering `date`, or `undefined` when school is in session that day.
 * A weekend inside a closure belongs to that closure.
 *
 * @throws RangeError when we cannot say whether school is open: the date is
 *   before every calendar, after the last summer we can resolve (published or
 *   estimated, ADR-0014), or in a summer whose preceding year is not held. That is
 *   not the same as "school is in session" (AGENTS.md §1).
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
  const stored = years
    .flatMap((year) => year.closures)
    .map((closure): Sourced => ({ closure, provenance: PUBLISHED }));
  return [...stored, ...summersOf(years)]
    .sort((a, b) => byStartDate(a.closure, b.closure))
    .map(periodFor)
    .filter((period) => period !== undefined);
}

/** A closure's weekdays and weeks, or `undefined` when it falls entirely on a weekend. */
function periodFor({ closure, provenance }: Sourced): CoveragePeriod | undefined {
  const first = firstWeekdayOnOrAfter(closure.startDate);
  const last = lastWeekdayOnOrBefore(closure.endDate);
  if (compareDates(first, last) > 0) return undefined;

  const weeks = weeksBetween(first, last);
  const weekdays = weeks.reduce(
    (total, week) => total + daysBetween(week.firstDayNeedingCover, week.lastDayNeedingCover) + 1,
    0,
  );
  return { closure, weekdays, weeks, ...provenance };
}

/** Where a period's dates came from. Spread into the period, so the two cannot disagree. */
type Provenance = Pick<PublishedPeriod, 'basis'> | Pick<EstimatedPeriod, 'basis' | 'estimatedBy'>;

const PUBLISHED: Provenance = { basis: PeriodBasis.Published };

interface Sourced {
  readonly closure: Closure;
  readonly provenance: Provenance;
}

/** The time between a school year and the next: summer, on a traditional calendar. */
interface Summer extends Sourced {
  readonly after: SchoolYearCalendar;
}

/**
 * The summer after each held year. It ends before the year labelled next when
 * that year is held — coverage windows are not consulted, so a window that stops
 * at the last day of school cannot make a derivable summer look unknown. When it
 * is not held, the summer ends before an estimated first day (ADR-0014), or is
 * left out when no estimate passes the range check.
 */
function summersOf(years: readonly SchoolYearCalendar[]): readonly Summer[] {
  const byLabel = new Map(years.map((year) => [year.label, year] as const));
  return years
    .map((year) => summerAfter(year, byLabel.get(followingLabel(year.label))))
    .filter((summer) => summer !== undefined);
}

function summerAfter(
  year: SchoolYearCalendar,
  next: SchoolYearCalendar | undefined,
): Summer | undefined {
  if (next) return gapBefore(year, next.firstInstructionalDay, PUBLISHED);

  const estimate = estimateNextFirstDay(year.firstInstructionalDay);
  return (
    estimate &&
    gapBefore(year, estimate.firstDay, {
      basis: PeriodBasis.Estimated,
      estimatedBy: estimate.rule,
    })
  );
}

/** The days between `year`'s last instructional day and the next year's first. */
function gapBefore(
  year: SchoolYearCalendar,
  firstDayBack: CalendarDate,
  provenance: Provenance,
): Summer | undefined {
  const startDate = addDays(year.lastInstructionalDay, 1);
  const endDate = addDays(firstDayBack, -1);
  if (compareDates(endDate, startDate) < 0) return undefined;

  const sourceLabel =
    provenance.basis === PeriodBasis.Published ? DERIVED_SOURCE_LABEL : ESTIMATED_SOURCE_LABEL;
  return {
    after: year,
    closure: { startDate, endDate, tags: [ClosureTag.Break], sourceLabel },
    provenance,
  };
}

function assertKnown(years: readonly SchoolYearCalendar[], day: CalendarDate): void {
  const inSchool = years.some((year) =>
    isWithin({ startDate: year.firstInstructionalDay, endDate: year.lastInstructionalDay }, day),
  );
  if (!inSchool && !summersOf(years).some(({ closure }) => isWithin(closure, day))) {
    throw new RangeError(`No school calendar we hold says whether school is open on ${day}`);
  }
}

function isWithin(range: Pick<Closure, 'startDate' | 'endDate'>, day: CalendarDate): boolean {
  return compareDates(day, range.startDate) >= 0 && compareDates(day, range.endDate) <= 0;
}
