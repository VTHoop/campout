import { assertCalendarDate, type CalendarDate } from '@campout/planner';

/**
 * Display formats for a `CalendarDate`. The date is read at UTC midnight and
 * formatted in UTC, so the day shown is the day stored, whatever the reader's
 * timezone (docs/ABSTRACTIONS.md → *CalendarDate*).
 */
const SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function atUtcMidnight(date: CalendarDate): Date {
  return new Date(`${assertCalendarDate(date, 'date')}T00:00:00Z`);
}

/** `2027-06-14` → `Jun 14`. */
export function shortMonthDay(date: CalendarDate): string {
  return SHORT.format(atUtcMidnight(date));
}

/** `2027-06-14` → `June 14`. */
export function longMonthDay(date: CalendarDate): string {
  return LONG.format(atUtcMidnight(date));
}
