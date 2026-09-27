import { assertCalendarDate, type CalendarDate } from '@campout/planner';

/**
 * The calendar date in Richmond at an instant. Every Campout district is in
 * Richmond, so "today" for a planner is Richmond's today, whatever the server's
 * or the reader's timezone. The instant is passed in: the wall clock is read at
 * the request boundary, never in here (AGENTS.md → *Time is data, not ambient*).
 */
const RICHMOND = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function richmondDate(instant: Date): CalendarDate {
  return assertCalendarDate(RICHMOND.format(instant), 'Richmond date');
}
