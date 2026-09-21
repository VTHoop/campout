/**
 * Calendar dates, not instants.
 *
 * A camp that runs June 15–19 runs those days in Richmond, regardless of where
 * the person reading the screen happens to be. Modelling that as a timestamp
 * moves it by a day for anyone west of us, so this module works in `YYYY-MM-DD`
 * strings and anchors every internal conversion to UTC midnight — not to make
 * the values UTC, but to make the arithmetic immune to the reader's timezone.
 *
 * ADR-0008. No function here reads the clock.
 */

/** An ISO calendar date, `YYYY-MM-DD`. Never an instant, never timezone-bearing. */
export type CalendarDate = string;

export enum Weekday {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/**
 * Validate a calendar date, throwing on anything malformed or impossible.
 *
 * "Refuse rather than guess" (AGENTS.md §1). A bad date silently coerced to
 * something plausible produces a summer week that is off by one, and a parent
 * plans around it.
 */
export function assertCalendarDate(value: string, label: string): CalendarDate {
  if (!ISO_DATE.test(value)) {
    throw new RangeError(`${label} must be a YYYY-MM-DD calendar date, received "${value}"`);
  }
  const ms = toEpochMs(value);
  if (Number.isNaN(ms)) {
    throw new RangeError(`${label} is not a real date: "${value}"`);
  }
  // Date.parse does NOT reject an impossible day-of-month — it rolls it over, so
  // "2027-02-30" silently becomes March 2nd. Round-tripping is the only way to
  // catch that, and a summer week built on a rolled-over date is off by days.
  if (fromEpochMs(ms) !== value) {
    throw new RangeError(`${label} is not a real date: "${value}"`);
  }
  return value;
}

function toEpochMs(date: CalendarDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromEpochMs(ms: number): CalendarDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Shift a calendar date by whole days. Negative shifts backwards. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromEpochMs(toEpochMs(date) + days * MS_PER_DAY);
}

export function weekdayOf(date: CalendarDate): Weekday {
  return new Date(toEpochMs(date)).getUTCDay() as Weekday;
}

/** Negative if `a` is earlier, positive if later, zero if the same day. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return toEpochMs(a) - toEpochMs(b);
}

/** Whole days from `a` to `b`. Negative when `b` precedes `a`. */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round((toEpochMs(b) - toEpochMs(a)) / MS_PER_DAY);
}

export function isWeekend(date: CalendarDate): boolean {
  const day = weekdayOf(date);
  return day === Weekday.Saturday || day === Weekday.Sunday;
}

/** The Monday of the week containing `date`. Weeks run Monday through Sunday. */
export function mondayOf(date: CalendarDate): CalendarDate {
  const day = weekdayOf(date);
  // Sunday (0) belongs to the week that started six days earlier, not the one
  // starting tomorrow — the usual off-by-one in Monday-anchored week math.
  const offset = day === Weekday.Sunday ? 6 : day - Weekday.Monday;
  return addDays(date, -offset);
}

/** The first weekday strictly after `date`, skipping Saturday and Sunday. */
export function nextWeekday(date: CalendarDate): CalendarDate {
  let candidate = addDays(date, 1);
  while (isWeekend(candidate)) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

/** The last weekday strictly before `date`, skipping Saturday and Sunday. */
export function previousWeekday(date: CalendarDate): CalendarDate {
  let candidate = addDays(date, -1);
  while (isWeekend(candidate)) {
    candidate = addDays(candidate, -1);
  }
  return candidate;
}

/** `date` itself when it is a weekday, otherwise the following Monday. */
export function firstWeekdayOnOrAfter(date: CalendarDate): CalendarDate {
  return isWeekend(date) ? nextWeekday(date) : date;
}

/** `date` itself when it is a weekday, otherwise the preceding Friday. */
export function lastWeekdayOnOrBefore(date: CalendarDate): CalendarDate {
  return isWeekend(date) ? previousWeekday(date) : date;
}
