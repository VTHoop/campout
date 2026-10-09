import {
  addDays,
  type CalendarDate,
  compareDates,
  isWeekend,
  Weekday,
  weekdayOf,
} from '@campout/planner';
import type { AgeRange, GradeRange, WallClockTime } from './catalog/types';
import { dayOfMonth, longMonth, longWeekday, shortMonth, shortWeekday } from './dates';

/**
 * The session card's facts, as a parent reads them (CAM-32; DESIGN.md → *The
 * session card*). A fact the source did not state comes back `undefined`, never
 * as a default: the card says "Hours not stated" rather than implying all day.
 * Dates go through `./dates`, so the day shown is the day stored.
 */

export interface WeekTab {
  /** `Jun`, or `Jun–Jul` when the session crosses a month. */
  readonly month: string;
  /** `15–19`, or `17` for a one-day session. */
  readonly range: string;
  /** `Mon–Fri`, `Mon–Wed`, or `Wed` for one day. */
  readonly days: string;
  /** Monday to Friday. Anything else is a partial span, set in brick. */
  readonly fullWeek: boolean;
  /** The tab as one phrase: `June 15 to 19, Monday to Friday`. */
  readonly spoken: string;
}

const WEEKDAYS_IN_A_WEEK = 5;
const NOON: WallClockTime = '12:00';

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const DOLLARS_AND_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** `from–to` when the two differ, else just the one. */
function span(from: string, to: string, joiner: string): string {
  return from === to ? from : `${from}${joiner}${to}`;
}

/** `14:00` → `2:00pm`. */
function clockTime(time: WallClockTime): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'am' : 'pm';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(twelveHour)}:${String(minutes).padStart(2, '0')}${suffix}`;
}

export function formatHours(start?: WallClockTime, end?: WallClockTime): string | undefined {
  if (start === undefined || end === undefined) return undefined;
  return `${clockTime(start)} – ${clockTime(end)}`;
}

export function formatPrice(cents?: number): string | undefined {
  if (cents === undefined) return undefined;
  const format = cents % 100 === 0 ? WHOLE_DOLLARS : DOLLARS_AND_CENTS;
  return format.format(cents / 100);
}

/** `Ages 5–15`, `Ages 5 and up`, `Ages up to 15`; undefined when neither end is stated. */
function formatRange(
  noun: string,
  { min, max }: { readonly min?: number; readonly max?: number },
  label: (value: number) => string,
): string | undefined {
  if (min !== undefined && max !== undefined) return `${noun} ${label(min)}–${label(max)}`;
  if (min !== undefined) return `${noun} ${label(min)} and up`;
  if (max !== undefined) return `${noun} up to ${label(max)}`;
  return undefined;
}

export function formatAges(range?: AgeRange): string | undefined {
  return range && formatRange('Ages', range, String);
}

/** Grade 0 is kindergarten. */
export function formatGrades(range?: GradeRange): string | undefined {
  return range && formatRange('Grades', range, (grade) => (grade === 0 ? 'K' : String(grade)));
}

export function weekTab(start: CalendarDate, end: CalendarDate): WeekTab {
  return {
    month: span(shortMonth(start), shortMonth(end), '–'),
    range: span(dayOfMonth(start), dayOfMonth(end), '–'),
    days: span(shortWeekday(start), shortWeekday(end), '–'),
    fullWeek: weekdayOf(start) === Weekday.Monday && weekdayOf(end) === Weekday.Friday,
    spoken: `${spokenDates(start, end)}, ${span(longWeekday(start), longWeekday(end), ' to ')}`,
  };
}

/** `June 15 to 19`, `June 29 to July 3`, or `June 17`. */
function spokenDates(start: CalendarDate, end: CalendarDate): string {
  const from = `${longMonth(start)} ${dayOfMonth(start)}`;
  if (start === end) return from;
  const sameMonth = longMonth(start) === longMonth(end);
  return `${from} to ${sameMonth ? dayOfMonth(end) : `${longMonth(end)} ${dayOfMonth(end)}`}`;
}

function weekdaysCovered(start: CalendarDate, end: CalendarDate): number {
  let count = 0;
  for (let day = start; compareDates(day, end) <= 0; day = addDays(day, 1)) {
    if (!isWeekend(day)) count += 1;
  }
  return count;
}

/** `Covers 3 of 5 days, and ends at noon`, or undefined for a full week. */
export function partialWeekCallout(
  start: CalendarDate,
  end: CalendarDate,
  endTime?: WallClockTime,
): string | undefined {
  const covered = weekdaysCovered(start, end);
  if (covered >= WEEKDAYS_IN_A_WEEK) return undefined;
  const endsByNoon = endTime !== undefined && endTime <= NOON;
  return `Covers ${String(covered)} of ${String(WEEKDAYS_IN_A_WEEK)} days${endsByNoon ? ', and ends at noon' : ''}`;
}

/** The day a session was verified, as the card says it: `May 1, 2026`. */
export function formatVerifiedOn(_date: CalendarDate): string {
  throw new Error('not implemented');
}
