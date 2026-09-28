import { assertCalendarDate, type CalendarDate } from '@campout/planner';

/**
 * Display formats for a `CalendarDate`. The date is read at UTC midnight and
 * formatted in UTC, so the day shown is the day stored, whatever the reader's
 * timezone (docs/ABSTRACTIONS.md → *CalendarDate*).
 */
function atUtcMidnight(date: CalendarDate): Date {
  return new Date(`${assertCalendarDate(date, 'date')}T00:00:00Z`);
}

function utcFormat(options: Intl.DateTimeFormatOptions): (date: CalendarDate) => string {
  const format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  return (date) => format.format(atUtcMidnight(date));
}

/** `2027-06-14` → `Jun`. */
export const shortMonth = utcFormat({ month: 'short' });

/** `2027-06-14` → `June`. */
export const longMonth = utcFormat({ month: 'long' });

/** `2027-06-14` → `14`. */
export const dayOfMonth = utcFormat({ day: 'numeric' });

/** `2027-06-14` → `Mon`. */
export const shortWeekday = utcFormat({ weekday: 'short' });

/** `2027-06-14` → `Monday`. */
export const longWeekday = utcFormat({ weekday: 'long' });

/** `2027-06-14` → `Jun 14`. */
export const shortMonthDay = utcFormat({ month: 'short', day: 'numeric' });

/** `2027-06-14` → `June 14`. */
export const longMonthDay = utcFormat({ month: 'long', day: 'numeric' });
